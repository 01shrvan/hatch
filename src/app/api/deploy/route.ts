export async function POST() {
  return Response.json(
    { error: "static uploads are retired; push to the hatch git remote to deploy" },
    { status: 410 },
  );
}
