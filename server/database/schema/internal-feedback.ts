import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const internalAppFeedback = pgTable("internal_app_feedback", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id"),
  userName: text("user_name").notNull(),
  userEmail: text("user_email"),
  category: text("category", { enum: ["general", "bug", "feature", "docs"] })
    .notNull()
    .default("general"),
  comment: text("comment").notNull(),
  status: text("status", { enum: ["open", "resolved", "closed"] })
    .notNull()
    .default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
