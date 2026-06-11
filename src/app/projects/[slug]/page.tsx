export const dynamic = "force-dynamic";
import { ProjectView } from "@/components/project-view";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProjectView slug={slug} />;
}
