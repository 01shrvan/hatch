import { initTRPC } from "@trpc/server";
import SuperJSON from "superjson";
import { cache } from "react";

export const createTRPCContext = cache(async () => {
  return {};
});

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({ transformer: SuperJSON });

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;
