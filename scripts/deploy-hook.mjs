const [, , slug, oldrev, newrev, refname] = process.argv;

if (!slug || !newrev || !refname) {
  console.error("usage: deploy-hook <slug> <oldrev> <newrev> <refname>");
  process.exit(1);
}

if (refname !== "refs/heads/main") {
  console.log(`hatch: ignoring ${refname}; push main to deploy`);
  process.exit(0);
}

if (/^0+$/.test(newrev)) {
  console.log("hatch: ignoring branch delete");
  process.exit(0);
}

const baseUrl = process.env.HATCH_CONTROL_URL ?? "http://localhost:3000";
const res = await fetch(`${baseUrl}/api/internal/deploy`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(process.env.HATCH_HOOK_SECRET
      ? { authorization: `Bearer ${process.env.HATCH_HOOK_SECRET}` }
      : {}),
  },
  body: JSON.stringify({ slug, oldrev, commitSha: newrev, refname }),
});

const body = await res.text();
if (!res.ok) {
  console.error(body);
  process.exit(1);
}

console.log(body);
