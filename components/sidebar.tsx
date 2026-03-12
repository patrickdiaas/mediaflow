"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "@/lib/dashboard-context";
import {
  LayoutDashboard, Megaphone, Image, Search, ShoppingCart, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState } from "react";

const MetaIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
  </svg>
);

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/criativos", label: "Criativos", icon: Image },
  { href: "/keywords", label: "Keywords", icon: Search, googleOnly: true },
  { href: "/vendas", label: "Vendas", icon: ShoppingCart, ecomOnly: true },
];

export default function Sidebar() {
  const { mode, setMode, platform, setPlatform } = useDashboard();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNav = navItems.filter(item => {
    if (item.googleOnly && platform !== "google") return false;
    if (item.ecomOnly && mode !== "ecommerce") return false;
    return true;
  });

  return (
    <aside
      className="relative flex flex-col border-r border-border bg-card transition-all duration-300"
      style={{ width: collapsed ? 60 : 220, minHeight: "100vh", flexShrink: 0 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-border" style={{ minHeight: 64 }}>
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10 border border-accent/30">
          <span className="text-accent font-mono font-bold text-xs">MF</span>
        </div>
        {!collapsed && (
          <span className="font-semibold text-text-primary tracking-tight text-sm">MediaFlow</span>
        )}
      </div>

      {/* Mode toggles */}
      {!collapsed && (
        <div className="px-3 pt-4 pb-2 space-y-2">
          <div className="flex rounded-lg overflow-hidden border border-border text-xs font-medium">
            <button
              onClick={() => setMode("lead-gen")}
              className={`flex-1 py-1.5 transition-colors ${mode === "lead-gen" ? "bg-accent/20 text-accent" : "text-text-secondary hover:text-text-primary"}`}
            >
              Lead Gen
            </button>
            <button
              onClick={() => setMode("ecommerce")}
              className={`flex-1 py-1.5 transition-colors ${mode === "ecommerce" ? "bg-blue/20 text-blue" : "text-text-secondary hover:text-text-primary"}`}
            >
              E-comm
            </button>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-border text-xs font-medium">
            <button
              onClick={() => setPlatform("meta")}
              className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 transition-colors ${platform === "meta" ? "bg-blue-dim/60 text-blue" : "text-text-secondary hover:text-text-primary"}`}
            >
              <MetaIcon /> Meta
            </button>
            <button
              onClick={() => setPlatform("google")}
              className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 transition-colors ${platform === "google" ? "bg-blue-dim/60 text-blue" : "text-text-secondary hover:text-text-primary"}`}
            >
              <GoogleIcon /> Google
            </button>
          </div>
        </div>
      )}

      {collapsed && (
        <div className="px-2 pt-3 pb-2 space-y-2">
          <button
            onClick={() => setPlatform(platform === "meta" ? "google" : "meta")}
            className="w-full flex items-center justify-center p-2 rounded-lg border border-border text-text-secondary hover:text-blue hover:border-blue/30 transition-colors"
            title={`Plataforma: ${platform}`}
          >
            {platform === "meta" ? <MetaIcon /> : <GoogleIcon />}
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 pt-2">
        {filteredNav.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors ${
                active
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-border/50"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
