import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { apps } from "./apps";

export type DocGenerationScheduleStatus = "idle" | "running" | "success" | "error";

export const docGenerationSchedule = pgTable("doc_generation_schedule", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text("app_id")
    .notNull()
    .references(() => apps.id, { onDelete: "cascade" })
    .unique(),
  scheduleEnabled: boolean("schedule_enabled").notNull().default(false),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastRunStatus: text("last_run_status", {
    enum: ["idle", "running", "success", "error"],
  })
    .notNull()
    .default("idle"),
  lastRunJobId: text("last_run_job_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const docGenerationScheduleRelations = relations(docGenerationSchedule, ({ one }) => ({
  app: one(apps, {
    fields: [docGenerationSchedule.appId],
    references: [apps.id],
  }),
}));
