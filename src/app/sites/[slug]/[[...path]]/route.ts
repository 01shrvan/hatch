import { db } from "@/lib/db";
import { projects, files } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findFile(deployId: string, path: string) {
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.deployId, deployId), eq(files.path, path)));
  return file ?? null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string; path?: string[] }> },
) {
  const { slug, path } = await params;

  const [project] = await db.select().from(projects).where(eq(projects.slug, slug));
  if (!project || !project.activeDeployId) {
    return new Response("Site not found", { status: 404 });
  }

  const deployId = project.activeDeployId;
  let rel = (path ?? []).join("/");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";

  let file = await findFile(deployId, rel);
  if (!file && !rel.includes(".")) {
    file = await findFile(deployId, `${rel}/index.html`);
  }

  if (!file) {
    const notFound = await findFile(deployId, "404.html");
    const body = notFound ? Buffer.from(notFound.content, "base64") : "404 — Not found";
    return new Response(body, {
      status: 404,
      headers: { "Content-Type": notFound?.contentType ?? "text/plain; charset=utf-8" },
    });
  }

  const etag = `"${deployId}:${rel}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(Buffer.from(file.content, "base64"), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=0, must-revalidate",
      ETag: etag,
    },
  });
}
