import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/sheets/[formId] — lê respostas do Google Sheets vinculado ao formulário
export async function GET(
  req: NextRequest,
  { params }: { params: { formId: string } }
) {
  const supabase = createServiceClient();

  const { data: form, error: fErr } = await supabase
    .from("tracked_forms")
    .select("sheet_id, display_name")
    .eq("id", params.formId)
    .single();

  if (fErr || !form) {
    return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404 });
  }

  if (!form.sheet_id) {
    return NextResponse.json({ error: "Nenhuma planilha vinculada a este formulário" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_SHEETS_API_KEY não configurada" }, { status: 500 });
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${form.sheet_id}/values/A1:Z1000?key=${apiKey}`;

  let sheetData: { values?: string[][] };
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json(
        { error: `Google Sheets API error: ${err?.error?.message ?? res.statusText}` },
        { status: res.status }
      );
    }
    sheetData = await res.json();
  } catch {
    return NextResponse.json({ error: "Erro ao acessar Google Sheets" }, { status: 500 });
  }

  const rows = sheetData.values ?? [];
  if (rows.length < 2) {
    return NextResponse.json({ headers: [], rows: [] });
  }

  const headers = rows[0];
  const data = rows.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""]))
  );

  return NextResponse.json({ headers, rows: data, form_name: form.display_name });
}
