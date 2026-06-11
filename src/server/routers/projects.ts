import { router, publicProcedure } from "@/server/trpc";
import { db } from "@/lib/db";
import { deployments, projects } from "@/lib/db/schema";
import { ensureProjectRepo } from "@/lib/runtime/git";
import { eq, and, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "site";
}

export const projectsRouter = router({
  list: publicProcedure.query(async () => {
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  }),

  get: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const [project] = await db.select().from(projects).where(eq(projects.slug, input.slug));
      return project ?? null;
    }),

  create: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      let slug = slugify(input.name);
      const [existing] = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug));
      if (existing) slug = `${slug}-${createId().slice(0, 5)}`;

      const repoPath = await ensureProjectRepo(slug);
      const [project] = await db
        .insert(projects)
        .values({ name: input.name, slug, repoPath })
        .returning();
      return project;
    }),

  deployments: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(deployments)
        .where(eq(deployments.projectId, input.projectId))
        .orderBy(desc(deployments.createdAt));
    }),

  setActiveDeployment: publicProcedure
    .input(z.object({ projectId: z.string(), deploymentId: z.string() }))
    .mutation(async ({ input }) => {
      const [deployment] = await db
        .select({ id: deployments.id })
        .from(deployments)
        .where(and(eq(deployments.id, input.deploymentId), eq(deployments.projectId, input.projectId)));
      if (!deployment) throw new Error("deployment not found");

      const [project] = await db
        .update(projects)
        .set({ activeDeploymentId: input.deploymentId })
        .where(eq(projects.id, input.projectId))
        .returning();
      return project;
    }),

  remove: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.delete(projects).where(eq(projects.id, input.id));
    }),
});
