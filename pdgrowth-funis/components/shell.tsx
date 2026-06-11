import Link from "next/link";

export function Shell({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg border border-accent/30 bg-accent/5">
              <span className="font-display font-bold text-accent text-[11px] tracking-tight">PD</span>
            </div>
            <div className="leading-tight">
              <span className="font-display font-bold text-text-primary text-xs block">PD Growth</span>
              <span className="text-text-muted text-[10px] font-mono">{"// funis"}</span>
            </div>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/" className="px-3 py-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-card transition-colors">Funis</Link>
            <Link href="/clients" className="px-3 py-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-card transition-colors">Clientes</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {title && <h1 className="text-xl font-display font-bold text-text-primary mb-6">{title}</h1>}
        {children}
      </main>
    </div>
  );
}
