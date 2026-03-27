"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "@/lib/dashboard-context";
import { mockClients } from "@/lib/mock-data";
import { LayoutDashboard, Megaphone, Image, Package, Users, Settings, ChevronLeft, ChevronRight, FileBarChart2, Sparkles } from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/",          label: "Overview",   icon: LayoutDashboard },
  { href: "/campanhas", label: "Campanhas",  icon: Megaphone },
  { href: "/criativos", label: "Criativos",  icon: Image },
  { href: "/produtos",       label: "Produtos",       icon: Package },
  { href: "/audiencia",     label: "Audiência",     icon: Users },
  { href: "/relatorios",    label: "Relatórios",    icon: FileBarChart2 },
  { href: "/analises",      label: "Análises IA",   icon: Sparkles },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function Sidebar() {
  const { client, setClient, platform, setPlatform } = useDashboard();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="relative flex flex-col border-r border-border bg-surface transition-all duration-300"
      style={{ width: collapsed ? 60 : 220, minHeight: "100vh", flexShrink: 0 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border" style={{ minHeight: 64 }}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg border border-accent/30 bg-accent/5 flex-shrink-0">
          <span className="font-display font-black text-accent text-sm tracking-tight">PD</span>
        </div>
        {!collapsed && (
          <div className="leading-tight min-w-0">
            <span className="font-display font-bold text-text-primary text-xs block tracking-tight">PD Growth</span>
            <span className="text-text-muted text-[10px] font-mono">// vendas</span>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-3 pt-4 pb-3 space-y-2 border-b border-border">
          <select
            value={client}
            onChange={e => setClient(e.target.value)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/40 cursor-pointer font-mono"
          >
            {mockClients.map(c => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <div className="flex rounded-lg overflow-hidden border border-border text-xs font-medium">
            {(["all", "meta", "google"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`flex-1 py-1.5 transition-colors font-mono text-[11px] ${
                  platform === p ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {p === "all" ? "todos" : p}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="flex-1 px-2 pt-2">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all ${
                active
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-card"
              }`}
            >
              <Icon size={15} className="flex-shrink-0" />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Version tag */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-border">
          <span className="font-mono text-[10px] text-text-dark tracking-widest">v1.0 · pdgrowth.com.br</span>
        </div>
      )}

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted hover:text-accent transition-colors z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
