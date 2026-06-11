import { deployProjectCommit } from "@/lib/runtime/deploy";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

const inputSchema = z.object({
  slug: z.string().min(1),
  commitSha: z.string().min(7),
});

export async function POST(req: Request) {
  const secret = process.env.HATCH_HOOK_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const input = inputSchema.safeParse(await req.json());
  if (!input.success) {
    return Response.json({ error: input.error.message }, { status: 400 });
  }

  try {
    const deploymentId = await deployProjectCommit(input.data.slug, input.data.commitSha);
    return Response.json({ deploymentId });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "deployment failed" },
      { status: 500 },
    );
  }
}
