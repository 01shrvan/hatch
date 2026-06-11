import fs from "node:fs/promises";
import path from "node:path";
import { repoPathForSlug } from "@/lib/hatch-paths";
import { runCommand } from "./process";

function hookBody(slug: string) {
  return `#!/bin/sh
while read oldrev newrev refname
do
  node "${path.join(process.cwd(), "scripts", "deploy-hook.mjs").replace(/\\/g, "/")}" "${slug}" "$oldrev" "$newrev" "$refname"
done
`;
}

export async function ensureProjectRepo(slug: string) {
  const repoPath = repoPathForSlug(slug);
  await fs.mkdir(path.dirname(repoPath), { recursive: true });

  try {
    await fs.access(path.join(repoPath, "HEAD"));
  } catch {
    await runCommand("git", ["init", "--bare", repoPath]);
  }

  const hookPath = path.join(repoPath, "hooks", "post-receive");
  await fs.writeFile(hookPath, hookBody(slug), "utf8");
  await fs.chmod(hookPath, 0o755);
  return repoPath;
}
