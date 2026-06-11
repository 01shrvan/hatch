"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/site-header";
import { toast } from "sonner";

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
        toast.success("Project created");
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="max-w-xl">
          <h1 className="font-mono text-3xl font-semibold tracking-tight">Ship a static site in seconds.</h1>
          <p className="mt-3 text-muted-foreground">
            Create a project, drop your build folder, get a live URL. Every deploy is
            immutable, so rolling back is one click.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate({ name: name.trim() });
          }}
          className="mt-10 flex max-w-md gap-2"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name — e.g. my-portfolio"
            disabled={create.isPending}
          />
          <Button type="submit" disabled={create.isPending || !name.trim()}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </form>

        <div className="mt-14">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Projects
          </h2>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-muted/40" />
              ))}
            </div>
          ) : !projects?.length ? (
            <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">No projects yet. Create one above.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              {projects.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.slug}`}
                  className={`flex items-center justify-between px-5 py-4 transition-colors hover:bg-muted/50 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`size-1.5 rounded-full ${p.activeDeployId ? "bg-success" : "bg-muted-foreground/40"}`}
                    />
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{p.slug}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
