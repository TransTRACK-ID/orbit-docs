import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { apps } from "./apps";

export type DocEmbeddingScheduleStatus = "idle" | "running" | "success" | "error";

export type DocEmbeddingScheduleRunResult = {
  indexed: number;
  skipped: number;
  failed: number;
  candidates: number;
  finishedAt: string;
};

export const docEmbeddingSchedule = pgTable("doc_embedding_schedule", {
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
  lastRunResult: jsonb("last_run_result").$type<DocEmbeddingScheduleRunResult | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const docEmbeddingScheduleRelations = relations(docEmbeddingSchedule, ({ one }) => ({
  app: one(apps, {
    fields: [docEmbeddingSchedule.appId],
    references: [apps.id],
  }),
}));
