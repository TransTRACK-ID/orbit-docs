import { defineEventHandler, createError } from "h3";
import { getDb } from "~/server/database";
import { integrationSettings } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const db = getDb();

  let rows = await db.select().from(integrationSettings).limit(1);
  let row = rows[0];

  if (!row) {
    const inserted = await db.insert(integrationSettings).values({
      id: crypto.randomUUID(),
      githubActions: false,
      gitlabCI: false,
      jenkins: false,
      circleCI: false,
    }).returning();
    row = inserted[0];
  }

  return { data: row };
});
