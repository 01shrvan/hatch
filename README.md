# hatch

drop a build folder, get a live url. a tiny static deploy platform — a from-scratch take on how a "vercel for static sites" actually works.

## what it does

- create a project → it gets a subdomain (`yourproject.hatch.app`)
- drag your build output (`dist` / `out` / `build`) onto the page → it goes live
- every deploy is **immutable**, so rolling back is one click ("set live")
- requests are routed by the `Host` header and served from the active deploy, with caching keyed to the deploy id so a new push busts the cache instantly

## how it works

```
upload  →  POST /api/deploy        (FormData: files + relative paths)
        →  store files in postgres (base64), create an immutable deploy
        →  point project.activeDeployId at it

visit   →  proxy.ts reads the Host header
        →  rewrites  sub.hatch.app/x  ->  /sites/sub/x
        →  serve route looks up the active deploy, returns the file
           with Content-Type + ETag = "<deployId>:<path>"
        →  new deploy = new id = new ETag = cache invalidated
```

Locally, subdomains of `localhost` work (`yourproject.localhost:3000`), and every
site is also reachable at `/sites/<slug>` for easy previewing.

## stack

Next.js 16 · tRPC · Drizzle (postgres) · Tailwind v4

## run it

```bash
pnpm install
cp .env.example .env   # set DATABASE_URL
pnpm db:push
pnpm dev
```

## roadmap

- object storage (R2/S3) instead of postgres for file bodies
- per-deploy preview URLs
- custom domains
- build step (point at a git repo, run the build)
