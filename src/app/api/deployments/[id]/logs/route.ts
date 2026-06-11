import { db } from "@/lib/db";
import { deploymentLogs } from "@/lib/db/schema";
import { and, asc, eq, gt } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const encoder = new TextEncoder();
  let lastSequence = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        const rows = await db
          .select()
          .from(deploymentLogs)
          .where(and(eq(deploymentLogs.deploymentId, id), gt(deploymentLogs.sequence, lastSequence)))
          .orderBy(asc(deploymentLogs.sequence));

        for (const row of rows) {
          lastSequence = row.sequence;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(row)}\n\n`));
        }
      };

      void send();
      timer = setInterval(() => void send(), 1000);
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
