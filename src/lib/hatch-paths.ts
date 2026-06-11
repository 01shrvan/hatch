import path from "node:path";

export function hatchDataDir() {
  return process.env.HATCH_DATA_DIR ?? path.join(process.cwd(), "data");
}

export function repoPathForSlug(slug: string) {
  return path.join(hatchDataDir(), "repos", `${slug}.git`);
}

export function worktreePathForDeployment(deploymentId: string) {
  return path.join(hatchDataDir(), "worktrees", deploymentId);
}
