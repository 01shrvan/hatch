import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0];

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const rootHostname = root.split(":")[0];

  let subdomain: string | null = null;
  if (hostname.endsWith(`.${rootHostname}`)) {
    subdomain = hostname.slice(0, -(rootHostname.length + 1));
  }

  if (subdomain && subdomain !== "www") {
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sites).*)"],
};
