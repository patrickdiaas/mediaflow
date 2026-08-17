"use client";
import { useEffect, useState } from "react";

export interface ClientSession {
  authenticated: boolean;
  email?: string;
  allowed_clients?: string[];
  allowed_pages?: string[];
  is_readonly?: boolean;
  is_admin?: boolean;
}

// Cache global pra evitar N requests do /api/auth/me em cada mount
let cache: ClientSession | null = null;
const listeners = new Set<(s: ClientSession) => void>();

async function fetchSession(): Promise<ClientSession> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return { authenticated: false };
    return await res.json();
  } catch {
    return { authenticated: false };
  }
}

// Hook: retorna sessão atual. Faz fetch 1x e reusa em toda a árvore.
export function useSession(): ClientSession | null {
  const [session, setSession] = useState<ClientSession | null>(cache);

  useEffect(() => {
    if (cache) return;
    fetchSession().then(s => {
      cache = s;
      setSession(s);
      listeners.forEach(l => l(s));
    });
    const l = (s: ClientSession) => setSession(s);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  return session;
}

// Utils pra checar permissões
export function canAccessClient(session: ClientSession | null, slug: string): boolean {
  if (!session?.authenticated) return false;
  if (session.is_admin) return true;
  const ac = session.allowed_clients ?? [];
  if (ac.includes("*")) return true;
  return ac.includes(slug);
}

export function canAccessPage(session: ClientSession | null, path: string): boolean {
  if (!session?.authenticated) return false;
  if (session.is_admin) return true;
  const ap = session.allowed_pages ?? [];
  if (ap.includes("*")) return true;
  return ap.some(p => {
    if (p === "/") return path === "/";
    return path === p || path.startsWith(p + "/");
  });
}

export function isReadOnly(session: ClientSession | null): boolean {
  if (!session?.authenticated) return false;
  if (session.is_admin) return false;
  return session.is_readonly === true;
}
