import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: "Senha não configurada." }, { status: 500 });
  }

  // Timing-safe comparison to prevent timing attacks
  const valid =
    password.length === expected.length &&
    Buffer.from(password).equals(Buffer.from(expected));

  if (!valid) {
    // Small delay to slow down brute force
    await new Promise(r => setTimeout(r, 500));
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });

  // Set auth cookie — HttpOnly + Secure + SameSite
  res.cookies.set("pdg_auth", expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });

  return res;
}
