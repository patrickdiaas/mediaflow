import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, COOKIE_LEGACY_ADMIN } from "@/lib/auth-session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  res.cookies.set(COOKIE_LEGACY_ADMIN, "", { path: "/", maxAge: 0 });
  return res;
}
