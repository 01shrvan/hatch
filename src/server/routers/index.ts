import { router } from "@/server/trpc";
import { projectsRouter } from "./projects";

export const appRouter = router({
  projects: projectsRouter,
});

export type AppRouter = typeof appRouter;
