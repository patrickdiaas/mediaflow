// Helpers de sessão: cookie assinado (HMAC-SHA256) via Web Crypto API.
// Funciona no Edge Runtime (middleware) e no Node runtime (API routes).
// Password hashing (scrypt) fica em lib/auth-password.ts — não importável
// do middleware por depender de node:crypto.
//
// Cookies:
//   - pdg_auth    (legado) — senha admin do env DASHBOARD_PASSWORD, sem restrições
//   - pdg_session (novo)   — JSON assinado com dados do usuário (email, permissões)

export interface SessionData {
  v: 1;                       // versão do schema
  uid: string;                // user id (uuid do Supabase) OU "admin"
  email: string;              // email do user OU "admin"
  ac: string[];               // allowed_clients (["*"] = todos)
  ap: string[];               // allowed_pages   (["*"] = todas)
  ro: boolean;                // is_readonly
  exp: number;                // unix ms
}

const SESSION_TTL_MS = 60 * 60 * 24 * 30 * 1000; // 30 dias
const COOKIE_SESSION = "pdg_session";
export const COOKIE_LEGACY_ADMIN = "pdg_auth";
export const SESSION_COOKIE_NAME = COOKIE_SESSION;

function getSecret(): string {
  return process.env.SESSION_SECRET ?? process.env.DASHBOARD_PASSWORD ?? "insecure-dev-secret-change-me";
}

// ─── base64url puro (sem depender de Buffer) ─────────────────────────────
function base64urlEncode(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(s: string): ArrayBuffer {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const buffer = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buffer;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(data: Omit<SessionData, "v" | "exp">): Promise<string> {
  const payload: SessionData = { ...data, v: 1, exp: Date.now() + SESSION_TTL_MS };
  const b64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(b64));
  return `${b64}.${base64urlEncode(new Uint8Array(sigBuf))}`;
}

export async function verifySession(cookie: string | undefined | null): Promise<SessionData | null> {
  if (!cookie || !cookie.includes(".")) return null;
  const [b64, sig] = cookie.split(".");
  if (!b64 || !sig) return null;
  try {
    const key = await hmacKey();
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(sig),
      new TextEncoder().encode(b64),
    );
    if (!ok) return null;
    const json = new TextDecoder().decode(base64urlDecode(b64));
    const data = JSON.parse(json) as SessionData;
    if (data.v !== 1) return null;
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

// Sessão admin sintética (quando entra pela senha única do env).
export function adminSessionData(): Omit<SessionData, "v" | "exp"> {
  return {
    uid: "admin",
    email: "admin",
    ac: ["*"],
    ap: ["*"],
    ro: false,
  };
}
