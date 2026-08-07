import { pgTable, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    role: text("role", {
      enum: ["viewer", "tech_writer", "product_manager", "admin"],
    }).notNull(),
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
