// Helpers de autenticação: hash de senha (scrypt) + cookie assinado (HMAC).
// Sem dependências externas — usa `node:crypto` nativo.
//
// Cookies:
//   - pdg_auth    (legado) — senha admin do env DASHBOARD_PASSWORD, sem restrições
//   - pdg_session (novo)   — JSON assinado com dados do usuário (email, permissões)

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// ─── Sessão ────────────────────────────────────────────────────────────────
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

function getSecret(): string {
  // SESSION_SECRET pode ser qualquer string longa; fallback pro DASHBOARD_PASSWORD
  // quando não configurado (não ideal em prod, mas evita quebrar por config faltando).
  return process.env.SESSION_SECRET ?? process.env.DASHBOARD_PASSWORD ?? "insecure-dev-secret-change-me";
}

export function signSession(data: Omit<SessionData, "v" | "exp">): string {
  const payload: SessionData = { ...data, v: 1, exp: Date.now() + SESSION_TTL_MS };
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

export function verifySession(cookie: string | undefined | null): SessionData | null {
  if (!cookie || !cookie.includes(".")) return null;
  const [b64, sig] = cookie.split(".");
  if (!b64 || !sig) return null;
  const expectedSig = createHmac("sha256", getSecret()).update(b64).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(b64, "base64url").toString("utf-8")) as SessionData;
    if (data.v !== 1) return null;
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── Password hashing (scrypt nativo) ──────────────────────────────────────
// Formato armazenado: `scrypt$N=<n>$saltHex$hashHex`
// N = cost (padrão 16384 = 2^14), r=8, p=1 — parâmetros OWASP-recomendados.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const n = parseInt(parts[1], 10);
  const salt = Buffer.from(parts[2], "hex");
  const expected = Buffer.from(parts[3], "hex");
  if (!n || !salt.length || !expected.length) return false;
  try {
    const derived = scryptSync(plain, salt, expected.length, { N: n, r: SCRYPT_R, p: SCRYPT_P });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ─── Sessão helper ────────────────────────────────────────────────────────
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

export const SESSION_COOKIE_NAME = COOKIE_SESSION;
