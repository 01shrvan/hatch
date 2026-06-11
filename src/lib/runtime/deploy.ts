import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { deploymentLogs, deployments, projects } from "@/lib/db/schema";
import { worktreePathForDeployment } from "@/lib/hatch-paths";
import { runCommand } from "./process";

type Stream = "system" | "stdout" | "stderr";

async function findFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("could not allocate a local port"));
      });
    });
    server.on("error", reject);
  });
}

async function waitForHttp(port: number) {
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (res.status < 500) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
  throw new Error(`container did not respond on ${url}`);
}

async function writeFallbackDockerfile(worktreePath: string, appPort: number) {
  const dockerfile = path.join(worktreePath, "Dockerfile");
  try {
    await fs.access(dockerfile);
    return;
  } catch {
    await fs.writeFile(
      dockerfile,
      `FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY pnpm-lock.yaml* package-lock.json* yarn.lock* ./
RUN corepack enable && if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; elif [ -f package-lock.json ]; then npm ci; elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; else npm install; fi
COPY . .
RUN if npm run | grep -q " build"; then npm run build; fi
EXPOSE ${appPort}
CMD if npm run | grep -q " start"; then npm run start; else npm run dev -- --hostname 0.0.0.0; fi
`,
      "utf8",
    );
  }
}

function tailRuntimeLogs(deploymentId: string, containerName: string, startSequence: number) {
  let sequence = startSequence;
  const child = spawn("docker", ["logs", "-f", containerName], {
    windowsHide: true,
    shell: false,
  });

  const write = (chunk: Buffer, stream: Stream) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (!line.trim()) continue;
      sequence += 1;
      void db.insert(deploymentLogs).values({
        deploymentId,
        sequence,
        stream,
        message: line,
      });
    }
  };

  child.stdout.on("data", (chunk: Buffer) => write(chunk, "stdout"));
  child.stderr.on("data", (chunk: Buffer) => write(chunk, "stderr"));
}

export async function deployProjectCommit(slug: string, commitSha: string) {
  const [project] = await db.select().from(projects).where(eq(projects.slug, slug));
  if (!project) throw new Error(`project ${slug} not found`);

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const [deployment] = await db
    .insert(deployments)
    .values({
      projectId: project.id,
      commitSha,
      appPort: project.defaultPort,
      liveUrl: `http://${project.slug}.${root}`,
    })
    .returning();

  let sequence = 0;
  const log = async (message: string, stream: Stream = "system") => {
    sequence += 1;
    await db.insert(deploymentLogs).values({
      deploymentId: deployment.id,
      sequence,
      stream,
      message,
    });
  };

  const worktreePath = worktreePathForDeployment(deployment.id);
  const imageTag = `hatch-${project.slug}:${commitSha.slice(0, 12)}`;
  const containerName = `hatch-${project.slug}-${deployment.id.slice(0, 8)}`;
  let hostPort: number | null = null;

  try {
    await db.update(deployments).set({ status: "BUILDING" }).where(eq(deployments.id, deployment.id));
    await log(`checkout ${commitSha.slice(0, 12)}`);
    await fs.rm(worktreePath, { recursive: true, force: true });
    await fs.mkdir(worktreePath, { recursive: true });
    await runCommand("git", ["--git-dir", project.repoPath, "--work-tree", worktreePath, "checkout", "-f", commitSha], {
      onLine: log,
    });

    await writeFallbackDockerfile(worktreePath, project.defaultPort);
    await log(`docker build ${imageTag}`);
    await runCommand("docker", ["build", "-t", imageTag, "."], {
      cwd: worktreePath,
      onLine: log,
    });

    hostPort = await findFreePort();
    await db
      .update(deployments)
      .set({ status: "STARTING", imageTag, containerName, hostPort })
      .where(eq(deployments.id, deployment.id));
    await log(`docker run ${containerName} on :${hostPort}`);
    await runCommand("docker", [
      "run",
      "-d",
      "--name",
      containerName,
      "--label",
      `hatch.project=${project.slug}`,
      "-p",
      `127.0.0.1:${hostPort}:${project.defaultPort}`,
      imageTag,
    ], { onLine: log });

    await waitForHttp(hostPort);

    const previousActiveId = project.activeDeploymentId;
    await db
      .update(deployments)
      .set({ status: "RUNNING", startedAt: new Date(), finishedAt: new Date() })
      .where(eq(deployments.id, deployment.id));
    await db
      .update(projects)
      .set({ activeDeploymentId: deployment.id })
      .where(eq(projects.id, project.id));
    await log("deployment promoted");

    if (previousActiveId) {
      const [previous] = await db.select().from(deployments).where(eq(deployments.id, previousActiveId));
      if (previous?.containerName) {
        await log(`stopping previous container ${previous.containerName}`);
        await runCommand("docker", ["rm", "-f", previous.containerName], { onLine: log });
        await db.update(deployments).set({ status: "STOPPED" }).where(eq(deployments.id, previous.id));
      }
    }

    tailRuntimeLogs(deployment.id, containerName, sequence);
    return deployment.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "deployment failed";
    await log(message, "stderr");
    if (containerName) {
      await runCommand("docker", ["rm", "-f", containerName]).catch(() => undefined);
    }
    await db
      .update(deployments)
      .set({ status: "FAILED", failureReason: message, finishedAt: new Date(), imageTag, containerName, hostPort })
      .where(eq(deployments.id, deployment.id));
    throw error;
  }
}
