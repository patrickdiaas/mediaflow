import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/sheets/[productId] — lê respostas do Google Sheets vinculado ao produto
export async function GET(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  const supabase = createServiceClient();

  // Busca o sheet_id do produto
  const { data: product, error: pErr } = await supabase
    .from("tracked_products")
    .select("sheet_id, product_name")
    .eq("product_id", params.productId)
    .single();

  if (pErr || !product) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

  if (!product.sheet_id) {
    return NextResponse.json({ error: "Nenhuma planilha vinculada a este produto" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_SHEETS_API_KEY não configurada" }, { status: 500 });
  }

  // Lê até 1000 linhas da primeira aba
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${product.sheet_id}/values/A1:Z1000?key=${apiKey}`;

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
  const data    = rows.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""]))
  );

  return NextResponse.json({ headers, rows: data, product_name: product.product_name });
}
