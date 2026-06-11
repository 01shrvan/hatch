import { db } from "@/lib/db";
import { deployments, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(
  req: Request,
  { params }: { params: Promise<{ slug: string; path?: string[] }> },
) {
  const { slug, path } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.slug, slug));
  if (!project?.activeDeploymentId) {
    return new Response("app not found", { status: 404 });
  }

  const [deployment] = await db
    .select()
    .from(deployments)
    .where(eq(deployments.id, project.activeDeploymentId));

  if (!deployment?.hostPort || deployment.status !== "RUNNING") {
    return new Response("app is not running", { status: 503 });
  }

  const source = new URL(req.url);
  const targetPath = `/${(path ?? []).join("/")}`;
  const target = new URL(`http://127.0.0.1:${deployment.hostPort}${targetPath}`);
  target.search = source.search;

  const headers = new Headers(req.headers);
  headers.set("host", `127.0.0.1:${deployment.hostPort}`);

  try {
    return await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
      redirect: "manual",
      // @ts-expect-error required for streaming request bodies in Node fetch
      duplex: "half",
    });
  } catch {
    return new Response("app gateway error", { status: 502 });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
