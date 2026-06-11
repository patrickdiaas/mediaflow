import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: "Senha não configurada." }, { status: 500 });
  }

  const valid =
    typeof password === "string" &&
    password.length === expected.length &&
    Buffer.from(password).equals(Buffer.from(expected));

  if (!valid) {
    await new Promise(r => setTimeout(r, 500));
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("pdg_auth", expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
