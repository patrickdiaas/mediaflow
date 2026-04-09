import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

// Step 2: receives pre-built context and calls Claude (no Supabase queries)
export async function POST(req: NextRequest) {
  try {
    const { context, systemPrompt, userPrompt } = await req.json();

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada." }, { status: 500 });
    if (!context || !userPrompt) return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return NextResponse.json({ error: `Erro na API Claude: ${err}` }, { status: 500 });
    }

    const claudeData = await claudeRes.json();
    const report = claudeData.content?.[0]?.text ?? "Sem resposta.";

    return NextResponse.json({ report });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erro interno." }, { status: 500 });
  }
}
