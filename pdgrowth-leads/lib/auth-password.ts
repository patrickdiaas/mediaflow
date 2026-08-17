// Password hashing via scrypt nativo (node:crypto).
// SÓ importar de API routes (server-only). NÃO usar no middleware
// — middleware roda em Edge Runtime que não suporta node:crypto.
//
// Formato armazenado: `scrypt$N=<n>$saltHex$hashHex`
// N = cost (padrão 16384 = 2^14), r=8, p=1 — parâmetros OWASP-recomendados.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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
