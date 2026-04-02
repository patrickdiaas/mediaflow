"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "@/lib/dashboard-context";
import { LayoutDashboard, Megaphone, Image, Package, Users, Settings, ChevronLeft, ChevronRight, FileBarChart2, Sparkles, KeyRound, X } from "lucide-react";
import { useState } from "react";

function MetaIcon({ size = 14, active = false }: { size?: number; active?: boolean }) {
  const color = active ? "#CAFF04" : "#8888A0";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2.04C6.477 2.04 2 6.517 2 12.04c0 4.991 3.657 9.128 8.438 9.878v-6.987H7.9v-2.89h2.538V9.845c0-2.506 1.493-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.772-1.63 1.563v1.875h2.773l-.443 2.89h-2.33v6.987C18.343 21.168 22 17.031 22 12.04c0-5.523-4.477-10-10-10z" fill={color}/>
    </svg>
  );
}

function GoogleIcon({ size = 14, active = false }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill={active ? "#CAFF04" : "#8888A0"}/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill={active ? "#a8d800" : "#6b6b80"}/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill={active ? "#CAFF04" : "#8888A0"}/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill={active ? "#c8f000" : "#777790"}/>
    </svg>
  );
}

const navItems = [
  { href: "/",               label: "Overview",       icon: LayoutDashboard, platform: null   },
  { href: "/campanhas",      label: "Campanhas",      icon: Megaphone,       platform: null   },
  { href: "/criativos",      label: "Criativos",      icon: Image,           platform: null   },
  { href: "/palavras-chave", label: "Palavras-chave", icon: KeyRound,        platform: "google" },
  { href: "/produtos",       label: "Produtos",       icon: Package,         platform: null   },
  { href: "/audiencia",      label: "Audiência",      icon: Users,           platform: null   },
  { href: "/relatorios",     label: "Relatórios",     icon: FileBarChart2,   platform: null   },
  { href: "/analises",       label: "Análises IA",    icon: Sparkles,        platform: null   },
  { href: "/configuracoes",  label: "Configurações",  icon: Settings,        platform: null   },
];

function SidebarContent({
  collapsed,
  setCollapsed,
  onNavClick,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  onNavClick?: () => void;
}) {
  const { platform, setPlatform } = useDashboard();
  const pathname = usePathname();

  return (
    <aside
      className="relative flex flex-col h-full border-r border-border bg-surface transition-all duration-300"
      style={{ width: collapsed ? 60 : 220, flexShrink: 0 }}
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
        <div className="px-3 pt-4 pb-3 border-b border-border">
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(["all", "meta", "google"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                title={p === "all" ? "Todas as plataformas" : p === "meta" ? "Meta Ads" : "Google Ads"}
                className={`flex-1 flex items-center justify-center py-2 transition-colors ${
                  platform === p ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {p === "all" ? (
                  <span className="text-[10px] font-mono font-medium">todos</span>
                ) : p === "meta" ? (
                  <MetaIcon size={14} active={platform === "meta"} />
                ) : (
                  <GoogleIcon size={14} active={platform === "google"} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="flex-1 px-2 pt-2 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href;
          const platformMuted = item.platform === "google" && platform === "meta";
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all ${
                active
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : platformMuted
                  ? "text-text-dark hover:text-text-muted hover:bg-card"
                  : "text-text-secondary hover:text-text-primary hover:bg-card"
              }`}
            >
              <Icon size={15} className="flex-shrink-0" />
              {!collapsed && (
                <span className="font-medium flex items-center gap-1.5">
                  {item.label}
                  {item.platform === "google" && (
                    <span className="text-[9px] font-mono text-gold border border-gold/30 bg-gold/10 px-1 py-0.5 rounded">G</span>
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-4 py-3 border-t border-border">
          <span className="font-mono text-[10px] text-text-dark tracking-widest">v1.0 · pdgrowth.com.br</span>
        </div>
      )}

      {/* Collapse toggle — desktop only */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden md:flex absolute -right-3 top-16 w-6 h-6 rounded-full bg-surface border border-border items-center justify-center text-text-muted hover:text-accent transition-colors z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}

export default function Sidebar() {
  const { mobileSidebarOpen, setMobileSidebarOpen } = useDashboard();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-screen sticky top-0">
        <SidebarContent collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`md:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-300 ${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="relative h-full">
          <SidebarContent
            collapsed={false}
            setCollapsed={() => {}}
            onNavClick={() => setMobileSidebarOpen(false)}
          />
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="absolute top-4 right-3 w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center text-text-muted hover:text-accent transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </>
  );
}
