import { type H3Event, createError } from "h3";
import { getDb } from "~/server/database";
import { teamMembers } from "~/server/database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, getAuthUser, type SessionUser } from "./auth";

export type TeamRole = "admin" | "product_manager" | "tech_writer" | "viewer";

const ROLE_LEVELS: Record<TeamRole, number> = {
  admin: 3,
  product_manager: 2,
  tech_writer: 1,
  viewer: 0,
};

export function getRoleLevel(role: TeamRole): number {
  return ROLE_LEVELS[role] ?? 0;
}

/**
 * Get the team member record for the currently authenticated user.
 * Matches by userId first, then falls back to email.
 * Only returns active members.
 */
export async function getCurrentMember(event: H3Event) {
  const user = await getAuthUser(event);
  const db = getDb();

  // Try match by userId first
  if (user.id) {
    const byUserId = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, user.id), eq(teamMembers.status, "active")))
      .limit(1)
      .then((rows) => rows[0]);
    if (byUserId) return byUserId;
  }

  // Fallback to email match
  if (user.email) {
    const byEmail = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.email, user.email), eq(teamMembers.status, "active")))
      .limit(1)
      .then((rows) => rows[0]);
    if (byEmail) return byEmail;
  }

  return null;
}

/**
 * Require the current user to be an active team member with at least the given role level.
 * Throws 403 if the user is not a member or their role is insufficient.
 */
export async function requireTeamAccess(
  event: H3Event,
  minRole: TeamRole = "viewer"
): Promise<SessionUser> {
  const user = await requireAuth(event);
  const member = await getCurrentMember(event);

  if (!member) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "You are not a member of this workspace.",
    });
  }

  const userLevel = getRoleLevel(member.role as TeamRole);
  const requiredLevel = getRoleLevel(minRole);

  if (userLevel < requiredLevel) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: `You need ${minRole} access to perform this action.`,
    });
  }

  return user;
}

/**
 * Check if a team member role can manage (invite/update/delete) other members.
 * Admins and Product Managers can manage members.
 */
export function canManageMembers(role: TeamRole): boolean {
  return getRoleLevel(role) >= getRoleLevel("product_manager");
}

/**
 * Check if a team member role can invite a specific target role.
 * Admin can invite any role.
 * Product Manager can invite tech_writer and viewer.
 */
export function canInviteRole(inviterRole: TeamRole, targetRole: TeamRole): boolean {
  const inviterLevel = getRoleLevel(inviterRole);
  const targetLevel = getRoleLevel(targetRole);

  if (inviterLevel >= getRoleLevel("admin")) return true;
  if (inviterLevel >= getRoleLevel("product_manager")) {
    return targetLevel < getRoleLevel("product_manager");
  }
  return false;
}

/**
 * Ensure the authenticated user has an active team member record.
 * If a pending invitation exists for their email/userId, it is activated.
 * Otherwise a new admin member is created so the registering user
 * becomes the workspace owner.
 */
export async function ensureTeamMember(user: SessionUser) {
  const db = getDb();
  const name = user.name || user.email || "Unknown";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Already active?
  if (user.id) {
    const byUserId = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, user.id), eq(teamMembers.status, "active")))
      .limit(1)
      .then((rows) => rows[0]);
    if (byUserId) return byUserId;
  }
  if (user.email) {
    const byEmail = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.email, user.email), eq(teamMembers.status, "active")))
      .limit(1)
      .then((rows) => rows[0]);
    if (byEmail) return byEmail;
  }

  // Pending invitation waiting for them?
  let pending = null;
  if (user.id) {
    pending = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, user.id), eq(teamMembers.status, "pending")))
      .limit(1)
      .then((rows) => rows[0]);
  }
  if (!pending && user.email) {
    pending = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.email, user.email), eq(teamMembers.status, "pending")))
      .limit(1)
      .then((rows) => rows[0]);
  }

  if (pending) {
    const [updated] = await db
      .update(teamMembers)
      .set({
        status: "active",
        name,
        initials,
        userId: user.id || pending.userId,
        lastActive: "just now",
      })
      .where(eq(teamMembers.id, pending.id))
      .returning();
    return updated;
  }

  // Create new admin — first user to join becomes workspace owner
  const [member] = await db
    .insert(teamMembers)
    .values({
      id: crypto.randomUUID(),
      name,
      email: user.email || null,
      initials,
      role: "admin",
      status: "active",
      userId: user.id || null,
      lastActive: "just now",
    })
    .returning();

  return member;
}
