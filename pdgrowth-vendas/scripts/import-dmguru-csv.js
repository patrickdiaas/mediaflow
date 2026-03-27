/**
 * Script de importação de vendas DMGuru via CSV
 *
 * Uso:
 *   node scripts/import-dmguru-csv.js <arquivo.csv> <client_slug>
 *
 * Exemplo:
 *   node scripts/import-dmguru-csv.js vendas-marco.csv amplainstituto
 *
 * O arquivo deve ser exportado do DMGuru em formato CSV (separado por vírgula)
 * ou TSV (separado por tabulação — detectado automaticamente).
 *
 * Variáveis de ambiente necessárias (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const fs   = require("fs");
const path = require("path");

// ── Carregar .env.local ────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8").split("\n").forEach(line => {
    const [key, ...val] = line.split("=");
    if (key && val.length) process.env[key.trim()] = val.join("=").trim();
  });
}

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV_FILE          = process.argv[2];
const CLIENT_SLUG       = process.argv[3] ?? "amplainstituto";

if (!CSV_FILE) {
  console.error("Uso: node scripts/import-dmguru-csv.js <arquivo.csv> [client_slug]");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Faltam variáveis NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseBRNumber(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
}

function parseBRDate(str) {
  if (!str || !str.trim()) return null;
  // Formatos: "DD/MM/YYYY" ou "DD/MM/YYYY HH:MM:SS"
  const [datePart, timePart] = str.trim().split(" ");
  const [d, m, y] = datePart.split("/");
  if (!d || !m || !y) return null;
  const iso = `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
  return timePart ? `${iso}T${timePart}.000Z` : `${iso}T00:00:00.000Z`;
}

function mapStatus(str) {
  const s = (str ?? "").toLowerCase().trim();
  if (s === "aprovada" || s === "approved")    return "approved";
  if (s === "reembolsada" || s === "refunded") return "refunded";
  if (s === "cancelada" || s === "cancelled")  return "cancelled";
  if (s === "chargeback")                      return "chargeback";
  return "pending";
}

function mapPayment(str) {
  const s = (str ?? "").toLowerCase().trim();
  if (s.includes("pix"))     return "pix";
  if (s.includes("boleto"))  return "boleto";
  if (s.includes("crédito") || s.includes("credito") || s.includes("cartão")) return "credit_card";
  return s || null;
}

// ── Parser CSV com suporte a campos entre aspas ────────────────────────────────
function parseCSVLine(line, sep) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

const raw   = fs.readFileSync(CSV_FILE, "utf-8");
const lines = raw.split("\n").filter(l => l.trim());

// Detecta separador: tab, ponto-e-vírgula ou vírgula
const firstLine = lines[0];
const separator = firstLine.includes("\t") ? "\t"
  : firstLine.includes(";") ? ";"
  : ",";
const headers   = parseCSVLine(lines[0], separator).map(h => h.trim().toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
);

function col(row, name) {
  const idx = headers.indexOf(name);
  return idx >= 0 ? (row[idx] ?? "").trim() : "";
}

// ── Processar linhas ───────────────────────────────────────────────────────────
const sales = [];

for (let i = 1; i < lines.length; i++) {
  const row = parseCSVLine(lines[i], separator);
  if (row.length < 5) continue;

  const gatewayOrderId = col(row, "id transacao");
  if (!gatewayOrderId) continue;

  const status      = mapStatus(col(row, "status"));
  const amount      = parseBRNumber(col(row, "valor venda"));
  const productId   = col(row, "id produto");
  const productName = col(row, "nome produto") || null;
  const createdAt   = parseBRDate(col(row, "data pedido"))   ?? new Date().toISOString();
  const approvedAt  = parseBRDate(col(row, "data aprovacao")) ?? null;

  // UTMs: o CSV tem colunas utm_source, utm_campaign, utm_medium, utm_content
  const utmSource   = col(row, "utm_source")   || null;
  const utmCampaign = col(row, "utm_campaign") || null;
  const utmMedium   = col(row, "utm_medium")   || null;
  const utmContent  = col(row, "utm_content")  || null;

  const buyerName   = col(row, "nome contato")  || null;
  const buyerEmail  = col(row, "email contato") || null;
  const buyerPhone  = col(row, "telefone contato") || null;
  const payment     = mapPayment(col(row, "pagamento"));

  sales.push({
    client_slug:      CLIENT_SLUG,
    gateway:          "dmguru",
    gateway_order_id: gatewayOrderId,
    status,
    sale_type:        "main", // ajustado depois pelo SQL de order bumps
    product_id:       productId || null,
    product_name:     productName,
    amount,
    payment_method:   payment,
    buyer_name:       buyerName,
    buyer_email:      buyerEmail,
    buyer_phone:      buyerPhone,
    utm_source:       utmSource,
    utm_medium:       utmMedium,
    utm_campaign:     utmCampaign,
    utm_content:      utmContent,
    approved_at:      approvedAt,
    created_at:       createdAt,
  });
}

console.log(`\n📦 ${sales.length} vendas lidas do CSV (separador: ${separator === "\t" ? "TAB" : separator})`);

// Debug: mostra primeiros campos do header e da primeira linha de dados
const firstDataRow = parseCSVLine(lines[1], separator);
console.log(`\n🔎 Debug header[8]="${headers[8]}" header[17]="${headers[17]}" header[18]="${headers[18]}"`);
console.log(`🔎 Debug row[8]="${firstDataRow[8]}" row[17]="${firstDataRow[17]}" row[18]="${firstDataRow[18]}"`);
console.log(`🔎 Total headers: ${headers.length}, total campos linha 1: ${firstDataRow.length}`);

if (sales.length > 0) {
  const s = sales[0];
  console.log(`🔍 Amostra: id=${s.gateway_order_id} produto="${s.product_name}" valor=${s.amount} status=${s.status}`);
}
if (sales.length === 0) { console.error("Nenhuma venda encontrada. Verifique o arquivo."); process.exit(1); }

// ── Inserir no Supabase ────────────────────────────────────────────────────────
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const BATCH = 100;
  let inserted = 0, skipped = 0;

  for (let i = 0; i < sales.length; i += BATCH) {
    const batch = sales.slice(i, i + BATCH);
    const { error } = await supabase.from("sales").upsert(batch, {
      onConflict: "gateway,gateway_order_id",
    });
    if (error) {
      console.error(`❌ Erro no batch ${i}-${i+BATCH}:`, error.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`\r✅ Inseridos: ${inserted}/${sales.length}`);
    }
  }

  console.log(`\n\n✅ Importação concluída! ${inserted} vendas upserted, ${skipped} ignoradas.`);
  console.log("\n⚠️  Lembre de rodar o SQL de correção de order bumps no Supabase:");
  console.log(`
UPDATE sales
SET sale_type = 'order_bump'
WHERE client_slug = '${CLIENT_SLUG}'
  AND sale_type = 'main'
  AND product_name ILIKE '%sucesso%';
  `);
}

run().catch(console.error);
