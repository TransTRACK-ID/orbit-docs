import { pgTable, text, boolean, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const roles = pgTable("roles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  kind: text("kind").notNull().default("member"),
  isSystem: boolean("is_system").notNull().default(false),
  level: integer("level").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    role: text("role").notNull(),
    permission: text("permission").notNull(),
    allowed: boolean("allowed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    rolePermissionUnique: uniqueIndex("role_permissions_role_permission_unique").on(
      table.role,
      table.permission
    ),
  })
);
