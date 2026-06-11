import { router, publicProcedure } from "@/server/trpc";
import { db } from "@/lib/db";
import { projects, deploys } from "@/lib/db/schema";
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

      const [project] = await db.insert(projects).values({ name: input.name, slug }).returning();
      return project;
    }),

  deploys: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(deploys)
        .where(eq(deploys.projectId, input.projectId))
        .orderBy(desc(deploys.createdAt));
    }),

  setActiveDeploy: publicProcedure
    .input(z.object({ projectId: z.string(), deployId: z.string() }))
    .mutation(async ({ input }) => {
      const [deploy] = await db
        .select({ id: deploys.id })
        .from(deploys)
        .where(and(eq(deploys.id, input.deployId), eq(deploys.projectId, input.projectId)));
      if (!deploy) throw new Error("Deploy not found");

      const [project] = await db
        .update(projects)
        .set({ activeDeployId: input.deployId })
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
