"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CloudServerIcon,
  DashboardSquare01Icon,
  FolderGitIcon,
  GitBranchIcon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/site-header";
import { toast } from "sonner";

function statusTone(status?: string) {
  if (status === "RUNNING") return "text-emerald-500";
  if (status === "FAILED") return "text-red-500";
  if (status === "BUILDING" || status === "STARTING" || status === "QUEUED") return "text-amber-500";
  return "text-muted-foreground";
}

export function Dashboard() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data: projects, isLoading } = useQuery(trpc.projects.list.queryOptions());

  const create = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: () => {
        setName("");
        qc.invalidateQueries({ queryKey: trpc.projects.list.queryOptions().queryKey });
        toast.success("project created");
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const stats = useMemo(() => {
    const total = projects?.length ?? 0;
    const live = projects?.filter((project) => project.activeDeploymentId).length ?? 0;
    return [
      { label: "apps", value: total, icon: FolderGitIcon },
      { label: "live", value: live, icon: Rocket01Icon },
      { label: "runtime", value: "docker", icon: CloudServerIcon },
    ];
  }, [projects]);

  return (
    <div className="min-h-dvh lowercase">
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100dvh-57px)] w-full max-w-7xl border-x">
        <aside className="hidden w-56 shrink-0 border-r md:block">
          <div className="space-y-1 p-3">
            {[
              { label: "overview", icon: DashboardSquare01Icon },
              { label: "projects", icon: FolderGitIcon },
              { label: "deploys", icon: GitBranchIcon },
            ].map(({ label, icon }) => (
              <div
                key={label}
                className="flex h-9 items-center gap-2 border border-transparent px-2 text-sm font-medium text-muted-foreground first:border-border first:text-foreground"
              >
                <HugeiconsIcon icon={icon} size={16} strokeWidth={1.6} />
                {label}
              </div>
            ))}
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="relative border-b px-4 py-8 sm:px-6">
            <div className="absolute bottom-0 left-0 z-10 size-2 -translate-x-1/2 translate-y-1/2 border bg-background" />
            <div className="absolute right-0 bottom-0 z-10 size-2 translate-x-1/2 translate-y-1/2 border bg-background" />
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
              git push to live container
            </p>
            <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  hatch runs apps, not folders.
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  push main, build an image, replace the container, keep the previous deploy alive if the new one fails.
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) create.mutate({ name: name.trim() });
                }}
                className="flex w-full max-w-md gap-2"
              >
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="app name"
                  disabled={create.isPending}
                />
                <Button type="submit" disabled={create.isPending || !name.trim()}>
                  {create.isPending ? "creating" : "create"}
                </Button>
              </form>
            </div>
          </div>

          <div className="grid border-b sm:grid-cols-3">
            {stats.map(({ label, value, icon }, index) => (
              <div key={label} className={`p-4 sm:p-5 ${index > 0 ? "border-t sm:border-t-0 sm:border-l" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {label}
                  </span>
                  <HugeiconsIcon icon={icon} size={16} strokeWidth={1.5} className="text-muted-foreground" />
                </div>
                <p className="mt-4 font-mono text-2xl">{value}</p>
              </div>
            ))}
          </div>

          <div className="p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                projects
              </h2>
              <span className="text-xs text-muted-foreground">push main to deploy</span>
            </div>

            {isLoading ? (
              <div className="grid gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse border bg-muted/40" />
                ))}
              </div>
            ) : !projects?.length ? (
              <div className="border border-dashed px-6 py-16 text-center">
                <p className="text-sm text-muted-foreground">no apps yet. create one above.</p>
              </div>
            ) : (
              <div className="overflow-hidden border">
                {projects.map((project, index) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.slug}`}
                    className={`group grid gap-3 px-4 py-4 transition-colors hover:bg-accent/70 sm:grid-cols-[1fr_auto] sm:items-center ${
                      index > 0 ? "border-t" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span
                          className={`size-1.5 ${project.activeDeploymentId ? "bg-emerald-500" : "bg-muted-foreground/35"}`}
                        />
                        <span className="font-medium">{project.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">/{project.slug}</span>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{project.repoPath}</p>
                    </div>
                    <span className={`font-mono text-xs ${statusTone(project.activeDeploymentId ? "RUNNING" : undefined)}`}>
                      {project.activeDeploymentId ? "running" : "waiting"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
