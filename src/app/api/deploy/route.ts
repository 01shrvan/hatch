import { db } from "@/lib/db";
import { projects, deploys, files } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { contentTypeFor } from "@/lib/mime";

export const runtime = "nodejs";
export const maxDuration = 60;

function stripCommonPrefix(paths: string[]) {
  const segs = paths.map((p) => p.split("/"));
  if (segs.length === 0) return paths;
  const allHavePrefix = segs.every((s) => s.length > 1);
  if (!allHavePrefix) return paths;
  const first = segs[0][0];
  const shared = segs.every((s) => s[0] === first);
  return shared ? segs.map((s) => s.slice(1).join("/")) : paths;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const slug = String(form.get("slug") ?? "");
  if (!slug) return Response.json({ error: "Missing slug" }, { status: 400 });

  const [project] = await db.select().from(projects).where(eq(projects.slug, slug));
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const fileEntries = form.getAll("files").filter((f): f is File => f instanceof File);
  const rawPaths = form.getAll("paths").map(String);
  if (fileEntries.length === 0) return Response.json({ error: "No files" }, { status: 400 });

  const paths = stripCommonPrefix(
    fileEntries.map((f, i) => (rawPaths[i] || f.name).replace(/^\/+/, "")),
  );

  const [deploy] = await db
    .insert(deploys)
    .values({ projectId: project.id, status: "READY" })
    .returning();

  let totalBytes = 0;
  const rows = [];
  for (let i = 0; i < fileEntries.length; i++) {
    const buf = Buffer.from(await fileEntries[i].arrayBuffer());
    const path = paths[i];
    totalBytes += buf.byteLength;
    rows.push({
      deployId: deploy.id,
      path,
      contentType: contentTypeFor(path),
      content: buf.toString("base64"),
      size: buf.byteLength,
    });
  }

  for (let i = 0; i < rows.length; i += 50) {
    await db.insert(files).values(rows.slice(i, i + 50));
  }

  await db
    .update(deploys)
    .set({ fileCount: rows.length, totalBytes })
    .where(eq(deploys.id, deploy.id));

  await db
    .update(projects)
    .set({ activeDeployId: deploy.id })
    .where(eq(projects.id, project.id));

  return Response.json({ deployId: deploy.id, fileCount: rows.length, totalBytes });
}
