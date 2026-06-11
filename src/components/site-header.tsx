import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-between border-x px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-60">
          <span className="flex size-5 items-center justify-center border bg-foreground font-mono text-[10px] font-semibold text-background">
            h
          </span>
          <span className="font-mono text-sm font-semibold tracking-[0.18em]">hatch</span>
        </Link>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:block">
          push main / build image / run app
        </span>
        <div className="absolute bottom-0 left-0 z-10 size-2 -translate-x-1/2 translate-y-1/2 border bg-background" />
        <div className="absolute right-0 bottom-0 z-10 size-2 translate-x-1/2 translate-y-1/2 border bg-background" />
      </div>
    </header>
  );
}
