"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ClipboardCopyIcon,
  ComputerTerminal01Icon,
  ExternalLinkIcon,
  GitBranchIcon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { toast } from "sonner";

type LogRow = {
  id: string;
  sequence: number;
  stream: "system" | "stdout" | "stderr";
  message: string;
};

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).toLowerCase();
}

function statusClass(status?: string) {
  if (status === "RUNNING") return "text-emerald-500";
  if (status === "FAILED") return "text-red-500";
  if (status === "BUILDING" || status === "STARTING" || status === "QUEUED") return "text-amber-500";
  return "text-muted-foreground";
}

function CopyCommand({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1300);
      }}
      className="group flex w-full items-center justify-between gap-3 border border-dashed px-3 py-2 text-left font-mono text-xs transition-colors hover:border-foreground"
    >
      <code className="min-w-0 truncate">{value}</code>
      <span className="flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground group-hover:text-foreground">
        <HugeiconsIcon icon={ClipboardCopyIcon} size={13} />
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}

function LiveLogs({ deploymentId }: { deploymentId?: string }) {
  const [rows, setRows] = useState<LogRow[]>([]);

  useEffect(() => {
    setRows([]);
    if (!deploymentId) return;

    const source = new EventSource(`/api/deployments/${deploymentId}/logs`);
    source.onmessage = (event) => {
      const row = JSON.parse(event.data) as LogRow;
      setRows((current) => {
        if (current.some((item) => item.id === row.id)) return current;
        return [...current.slice(-180), row];
      });
    };
    return () => source.close();
  }, [deploymentId]);

  return (
    <div className="h-[360px] overflow-auto bg-[#080b0b] p-4 font-mono text-xs text-[#d7e8df]">
      {!deploymentId ? (
        <p className="text-[#7a8780]">no deployment selected.</p>
      ) : rows.length === 0 ? (
        <p className="text-[#7a8780]">waiting for log lines...</p>
      ) : (
        rows.map((row) => (
          <p key={row.id} className={row.stream === "stderr" ? "text-red-300" : row.stream === "system" ? "text-emerald-300" : ""}>
            <span className="mr-3 text-[#64706a]">{String(row.sequence).padStart(4, "0")}</span>
            {row.message}
          </p>
        ))
      )}
    </div>
  );
}

export function ProjectView({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { data: project, isLoading } = useQuery(trpc.projects.get.queryOptions({ slug }));
  const { data: deployments } = useQuery(
    trpc.projects.deployments.queryOptions(
      { projectId: project?.id ?? "" },
      { enabled: !!project?.id, refetchInterval: 2500 },
    ),
  );

  const setActive = useMutation(
    trpc.projects.setActiveDeployment.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.projects.get.queryOptions({ slug }).queryKey });
        if (project?.id) {
          qc.invalidateQueries({
            queryKey: trpc.projects.deployments.queryOptions({ projectId: project.id }).queryKey,
          });
        }
        toast.success("deployment promoted");
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const active = useMemo(
    () => deployments?.find((deployment) => deployment.id === project?.activeDeploymentId) ?? deployments?.[0],
    [deployments, project?.activeDeploymentId],
  );

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

  if (isLoading) {
    return (
      <div className="min-h-dvh lowercase">
        <SiteHeader />
        <main className="mx-auto min-h-[calc(100dvh-57px)] max-w-7xl border-x p-6">
          <div className="h-40 animate-pulse border bg-muted/40" />
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-dvh lowercase">
        <SiteHeader />
        <main className="mx-auto min-h-[calc(100dvh-57px)] max-w-7xl border-x p-6">
          <p className="text-sm text-muted-foreground">project not found.</p>
          <Link href="/" className="mt-3 inline-block text-sm underline underline-offset-4">
            back
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh lowercase">
      <SiteHeader />
      <main className="mx-auto min-h-[calc(100dvh-57px)] max-w-7xl border-x">
        <section className="relative border-b px-4 py-6 sm:px-6">
          <div className="absolute bottom-0 left-0 z-10 size-2 -translate-x-1/2 translate-y-1/2 border bg-background" />
          <div className="absolute right-0 bottom-0 z-10 size-2 translate-x-1/2 translate-y-1/2 border bg-background" />
          <Link href="/" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
            projects
          </Link>
          <div className="mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="flex items-center gap-3">
                <span className={`size-2 ${statusClass(active?.status).replace("text-", "bg-")}`} />
                <h1 className="text-4xl font-semibold tracking-tight">{project.name}</h1>
              </div>
              <p className="mt-2 font-mono text-xs text-muted-foreground">{project.slug}.{root}</p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`/sites/${project.slug}`} target="_blank" rel="noreferrer">
                  <HugeiconsIcon icon={ExternalLinkIcon} size={14} />
                  visit
                </a>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 border-b lg:border-r lg:border-b-0">
            <div className="border-b p-4 sm:p-6">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <HugeiconsIcon icon={GitBranchIcon} size={14} />
                git remote
              </div>
              <div className="space-y-2">
                <CopyCommand value={`git remote add hatch "${project.repoPath}"`} />
                <CopyCommand value="git push hatch main" />
              </div>
            </div>

            <div className="border-b p-4 sm:p-6">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <HugeiconsIcon icon={ComputerTerminal01Icon} size={14} />
                live logs
              </div>
              <LiveLogs deploymentId={active?.id} />
            </div>
          </div>

          <aside className="min-w-0">
            <div className="border-b p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">current</h2>
                <HugeiconsIcon icon={Rocket01Icon} size={16} className={statusClass(active?.status)} />
              </div>
              {active ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">status</span>
                    <span className={`font-mono ${statusClass(active.status)}`}>{active.status.toLowerCase()}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">commit</span>
                    <span className="font-mono">{active.commitSha.slice(0, 12)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">host port</span>
                    <span className="font-mono">{active.hostPort ?? "pending"}</span>
                  </div>
                  {active.failureReason && (
                    <p className="border border-red-500/25 bg-red-500/5 p-3 text-xs text-red-500">
                      {active.failureReason}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">no pushes yet.</p>
              )}
            </div>

            <div className="p-4 sm:p-5">
              <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                deployments
              </h2>
              {!deployments?.length ? (
                <div className="border border-dashed p-8 text-center text-sm text-muted-foreground">
                  waiting for first push.
                </div>
              ) : (
                <div className="overflow-hidden border">
                  {deployments.map((deployment, index) => {
                    const isLive = deployment.id === project.activeDeploymentId;
                    return (
                      <div key={deployment.id} className={`p-3 ${index > 0 ? "border-t" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-xs">{deployment.commitSha.slice(0, 12)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{fmtDate(deployment.createdAt)}</p>
                          </div>
                          <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${statusClass(deployment.status)}`}>
                            {deployment.status.toLowerCase()}
                          </span>
                        </div>
                        {!isLive && deployment.status === "RUNNING" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-3 h-7 px-2"
                            disabled={setActive.isPending}
                            onClick={() => setActive.mutate({ projectId: project.id, deploymentId: deployment.id })}
                          >
                            promote
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
