import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  label: text("label").notNull().default("未命名會員"),
  expiresAt: text("expires_at").notNull(),
  dailyLimit: integer("daily_limit").notNull().default(10),
  liveAnalysisEnabled: integer("live_analysis_enabled", { mode: "boolean" }).notNull().default(false),
  learningEnabled: integer("learning_enabled", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["active", "paused"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastLoginAt: text("last_login_at"),
  lastLoginDevice: text("last_login_device"),
  lastSeenAt: text("last_seen_at"),
}, (table) => [
  uniqueIndex("members_username_unique").on(table.username),
  index("members_status_idx").on(table.status),
  index("members_expires_at_idx").on(table.expiresAt),
]);

export const analysisUsage = sqliteTable("analysis_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  usageDate: text("usage_date").notNull(),
  count: integer("count").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("analysis_usage_member_date_unique").on(table.memberId, table.usageDate),
  index("analysis_usage_date_idx").on(table.usageDate),
]);

export const trialUsage = sqliteTable("trial_usage", {
  ipHash: text("ip_hash").primaryKey(),
  ipAddress: text("ip_address").notNull().default("未記錄"),
  device: text("device").notNull().default("未知裝置"),
  count: integer("count").notNull().default(0),
  status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
  firstUsedAt: text("first_used_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("trial_usage_status_idx").on(table.status),
  index("trial_usage_updated_at_idx").on(table.updatedAt),
]);

export const trialRequestReceipts = sqliteTable("trial_request_receipts", {
  requestId: text("request_id").primaryKey(),
  ipHash: text("ip_hash").notNull().references(() => trialUsage.ipHash, { onDelete: "cascade" }),
  recorded: integer("recorded", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const learningPredictions = sqliteTable("learning_predictions", {
  id: text("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id, { onDelete: "cascade" }),
  trialIpHash: text("trial_ip_hash").references(() => trialUsage.ipHash, { onDelete: "cascade" }),
  modelVersion: text("model_version").notNull(),
  captureMode: text("capture_mode", { enum: ["upload", "live"] }).notNull(),
  predictedSide: text("predicted_side", { enum: ["B", "P"] }).notNull(),
  bankerTenths: integer("banker_tenths").notNull(),
  signalClass: text("signal_class", { enum: ["ask", "composite", "basic"] }).notNull(),
  strengthClass: text("strength_class", { enum: ["watch", "low", "medium"] }).notNull(),
  featureBucket: text("feature_bucket").notNull(),
  snapshotHash: text("snapshot_hash").notNull(),
  actualOutcome: text("actual_outcome", { enum: ["B", "P", "T"] }),
  isCorrect: integer("is_correct", { mode: "boolean" }),
  feedbackSource: text("feedback_source", { enum: ["manual", "detected-confirmed", "automatic"] }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  feedbackAt: text("feedback_at"),
}, (table) => [
  index("learning_predictions_member_idx").on(table.memberId, table.createdAt),
  index("learning_predictions_trial_idx").on(table.trialIpHash, table.createdAt),
  index("learning_predictions_bucket_idx").on(table.featureBucket, table.feedbackAt),
  index("learning_predictions_created_at_idx").on(table.createdAt),
]);
