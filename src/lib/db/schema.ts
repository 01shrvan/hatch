import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const deployStatusEnum = pgEnum("deploy_status", ["READY", "BUILDING", "FAILED"]);

export const projects = pgTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  activeDeployId: text("active_deploy_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deploys = pgTable("deploys", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  status: deployStatusEnum("status").default("READY").notNull(),
  fileCount: integer("file_count").default(0).notNull(),
  totalBytes: integer("total_bytes").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const files = pgTable("files", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  deployId: text("deploy_id").notNull().references(() => deploys.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  contentType: text("content_type").notNull(),
  content: text("content").notNull(),
  size: integer("size").default(0).notNull(),
});
