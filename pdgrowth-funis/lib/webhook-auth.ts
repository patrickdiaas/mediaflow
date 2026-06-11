export function validateWebhookSecret(
  received: string | null,
  expected: string | undefined
): boolean {
  if (!received || !expected) return false;
  if (received.length !== expected.length) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && require("crypto").timingSafeEqual(a, b);
}
