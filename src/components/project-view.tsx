"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { toast } from "sonner";

type Picked = { file: File; path: string };

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function readEntry(entry: any, prefix: string, out: Picked[]): Promise<void> {
  if (entry.isFile) {
    await new Promise<void>((resolve) =>
      entry.file((f: File) => {
        out.push({ file: f, path: prefix + entry.name });
        resolve();
      }),
    );
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    await new Promise<void>((resolve) => {
      const batch = () =>
        reader.readEntries(async (entries: any[]) => {
          if (!entries.length) return resolve();
          for (const e of entries) await readEntry(e, `${prefix}${entry.name}/`, out);
          batch();
        });
      batch();
    });
  }
}

export function ProjectView({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: project, isLoading } = useQuery(trpc.projects.get.queryOptions({ slug }));
  const { data: deploys } = useQuery(
    trpc.projects.deploys.queryOptions(
      { projectId: project?.id ?? "" },
      { enabled: !!project?.id },
    ),
  );

  const setActive = useMutation(
    trpc.projects.setActiveDeploy.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Live deploy switched");
      },
    }),
  );

  function refresh() {
    qc.invalidateQueries({ queryKey: trpc.projects.get.queryOptions({ slug }).queryKey });
    if (project?.id) {
      qc.invalidateQueries({
        queryKey: trpc.projects.deploys.queryOptions({ projectId: project.id }).queryKey,
      });
    }
  }

  async function upload(picked: Picked[]) {
    if (!project || picked.length === 0) return;
    const fd = new FormData();
    fd.append("slug", project.slug);
    for (const p of picked) {
      fd.append("files", p.file);
      fd.append("paths", p.path);
    }
    setUploading(true);
    try {
      const res = await fetch("/api/deploy", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      toast.success(`Deployed ${data.fileCount} files (${fmtBytes(data.totalBytes)})`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const items = Array.from(e.dataTransfer.items);
    const out: Picked[] = [];
    await Promise.all(
      items.map((it) => {
        const entry = it.webkitGetAsEntry?.();
        return entry ? readEntry(entry, "", out) : Promise.resolve();
      }),
    );
    upload(out);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    upload(files.map((f) => ({ file: f, path: (f as any).webkitRelativePath || f.name })));
    e.target.value = "";
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-16">
          <div className="h-40 animate-pulse rounded-lg border border-border bg-muted/40" />
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-sm text-muted-foreground">Project not found.</p>
          <Link href="/" className="mt-3 inline-block text-sm underline">
            ← back
          </Link>
        </main>
      </div>
    );
  }

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-muted-foreground hover:text-foreground">
          ← projects
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <div className="mt-2 flex items-center gap-2">
              {project.activeDeployId ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                  <span className="size-1.5 rounded-full bg-success" /> live
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  no deploy yet
                </span>
              )}
              <a
                href={`/sites/${project.slug}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                {project.slug}.{root} ↗
              </a>
            </div>
          </div>
          {project.activeDeployId && (
            <Button asChild variant="outline" size="sm">
              <a href={`/sites/${project.slug}`} target="_blank" rel="noreferrer">
                Visit site
              </a>
            </Button>
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-8 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-16 text-center transition-colors ${
            dragging ? "border-foreground bg-muted/50" : "border-border"
          }`}
        >
          <p className="text-sm font-medium">
            {uploading ? "Deploying…" : "Drop your build folder here"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            the output folder from your build (dist, out, build…)
          </p>
          <Button
            className="mt-5"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            Choose folder
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            // @ts-expect-error non-standard but widely supported
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={onPick}
          />
        </div>

        <div className="mt-12">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Deploys
          </h2>
          {!deploys?.length ? (
            <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">No deploys yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              {deploys.map((d, i) => {
                const isLive = d.id === project.activeDeployId;
                return (
                  <div
                    key={d.id}
                    className={`flex items-center justify-between px-5 py-4 ${i > 0 ? "border-t border-border" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`size-1.5 rounded-full ${isLive ? "bg-success" : "bg-muted-foreground/30"}`}
                      />
                      <div>
                        <p className="font-mono text-xs">{d.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.fileCount} files · {fmtBytes(d.totalBytes)} · {fmtDate(d.createdAt)}
                        </p>
                      </div>
                    </div>
                    {isLive ? (
                      <span className="font-mono text-xs font-medium text-success">live</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={setActive.isPending}
                        onClick={() => setActive.mutate({ projectId: project.id, deployId: d.id })}
                      >
                        Set live
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
