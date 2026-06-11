import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-[5px] bg-primary text-[11px] font-bold text-primary-foreground">
            h
          </span>
          <span className="font-mono text-sm font-semibold tracking-tight">hatch</span>
        </Link>
        <span className="font-mono text-xs text-muted-foreground">drop → live url</span>
      </div>
    </header>
  );
}
