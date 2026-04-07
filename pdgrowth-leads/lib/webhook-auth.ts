/**
 * Timing-safe webhook secret validation.
 * Prevents timing attacks where an attacker could infer the secret
 * by measuring how long the comparison takes.
 */
export function validateWebhookSecret(
  received: string | null,
  expected: string | undefined
): boolean {
  if (!received || !expected) return false;
  if (received.length !== expected.length) return false;

  // crypto.timingSafeEqual requires same-length Buffers
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && require("crypto").timingSafeEqual(a, b);
}
