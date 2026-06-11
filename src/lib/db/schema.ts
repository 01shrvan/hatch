import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const deployStatusEnum = pgEnum("deploy_status", [
  "QUEUED",
  "BUILDING",
  "STARTING",
  "RUNNING",
  "FAILED",
  "STOPPED",
]);

export const logStreamEnum = pgEnum("log_stream", ["system", "stdout", "stderr"]);

export const projects = pgTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  repoPath: text("repo_path").notNull(),
  defaultPort: integer("default_port").default(3000).notNull(),
  activeDeploymentId: text("active_deployment_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deployments = pgTable("deployments", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  status: deployStatusEnum("status").default("QUEUED").notNull(),
  commitSha: text("commit_sha").notNull(),
  imageTag: text("image_tag"),
  containerName: text("container_name"),
  appPort: integer("app_port").default(3000).notNull(),
  hostPort: integer("host_port"),
  liveUrl: text("live_url"),
  failureReason: text("failure_reason"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deploymentLogs = pgTable("deployment_logs", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  deploymentId: text("deployment_id").notNull().references(() => deployments.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  stream: logStreamEnum("stream").default("system").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
