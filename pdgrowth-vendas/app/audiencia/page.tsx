"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { supabase } from "@/lib/supabase";
import { useDashboard } from "@/lib/dashboard-context";
import { RefreshCw, Users, FileSpreadsheet, AlertCircle } from "lucide-react";

interface TrackedProduct {
  id: string;
  product_id: string;
  product_name: string | null;
  sheet_id: string | null;
  gateway: string;
}

interface AudienceRow {
  email: string;
  purchase_date: string;
  amount: number;
  payment_method: string | null;
  utm_medium: string | null;
  // respostas do formulário (campos dinâmicos)
  [key: string]: unknown;
}

export default function AudienciaPage() {
  const { client } = useDashboard();

  const [products,    setProducts]    = useState<TrackedProduct[]>([]);
  const [selectedId,  setSelectedId]  = useState<string>("");
  const [headers,     setHeaders]     = useState<string[]>([]);
  const [rows,        setRows]        = useState<AudienceRow[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Carrega produtos com planilha vinculada
  useEffect(() => {
    supabase
      .from("tracked_products")
      .select("id, product_id, product_name, sheet_id, gateway")
      .eq("client_slug", client)
      .eq("active", true)
      .not("sheet_id", "is", null)
      .then(({ data }) => {
        setProducts(data ?? []);
        if (data && data.length > 0) setSelectedId(data[0].product_id);
      });
  }, [client]);

  useEffect(() => {
    if (!selectedId) return;
    fetchAudience(selectedId);
  }, [selectedId]);

  async function fetchAudience(productId: string) {
    setLoading(true);
    setError(null);
    setRows([]);
    setHeaders([]);

    // Busca respostas do Google Sheets
    const sheetRes = await fetch(`/api/sheets/${productId}`);
    if (!sheetRes.ok) {
      const err = await sheetRes.json();
      setError(err.error ?? "Erro ao carregar planilha.");
      setLoading(false);
      return;
    }
    const { headers: sheetHeaders, rows: sheetRows } = await sheetRes.json();

    // Detecta coluna de email (case-insensitive)
    const emailHeader = sheetHeaders.find((h: string) =>
      h.toLowerCase().includes("email") || h.toLowerCase().includes("e-mail")
    );

    if (!emailHeader) {
      setError("Coluna de email não encontrada na planilha. Certifique-se de que o formulário pede o email.");
      setLoading(false);
      return;
    }

    // Busca vendas aprovadas do produto
    const { data: sales } = await supabase
      .from("sales")
      .select("buyer_email, created_at, amount, payment_method, utm_medium")
      .eq("client_slug", client)
      .eq("product_id", productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    const salesByEmail = new Map(
      (sales ?? []).map(s => [s.buyer_email?.toLowerCase(), s])
    );

    // Cruza por email
    const matched: AudienceRow[] = sheetRows
      .filter((row: Record<string, string>) => {
        const email = row[emailHeader]?.toLowerCase();
        return email && salesByEmail.has(email);
      })
      .map((row: Record<string, string>) => {
        const email = row[emailHeader].toLowerCase();
        const sale  = salesByEmail.get(email)!;
        return {
          email,
          purchase_date:  new Date(sale.created_at).toLocaleDateString("pt-BR"),
          amount:         Number(sale.amount),
          payment_method: sale.payment_method,
          utm_medium:     sale.utm_medium,
          ...row,
        };
      });

    // Colunas do formulário (exclui email, timestamp)
    const formCols = sheetHeaders.filter((h: string) =>
      !h.toLowerCase().includes("email") &&
      !h.toLowerCase().includes("timestamp") &&
      !h.toLowerCase().includes("carimbo")
    );

    setHeaders(formCols);
    setRows(matched);
    setLoading(false);
  }

  const selectedProduct = products.find(p => p.product_id === selectedId);
  const totalSales      = rows.length;

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Header
          title="Audiência"
          subtitle="Respostas do formulário pós-compra cruzadas com as vendas"
        />

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <FileSpreadsheet size={32} className="text-text-muted" />
            <p className="text-text-secondary text-sm">Nenhum produto com planilha vinculada.</p>
            <p className="text-text-muted text-xs max-w-xs">
              Acesse <strong className="text-text-secondary">Configurações</strong> e cole o ID da planilha Google em cada produto rastreado.
            </p>
          </div>
        ) : (
          <>
            {/* Seletor de produto + stats */}
            <div className="flex items-center gap-4 mb-6">
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/40 cursor-pointer"
              >
                {products.map(p => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_name ?? p.product_id}
                  </option>
                ))}
              </select>

              {!loading && rows.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-text-muted">
                  <Users size={14} className="text-accent" />
                  <span>
                    <span className="font-mono font-semibold text-accent">{totalSales}</span>
                    {" "}compradores responderam
                  </span>
                </div>
              )}

              <button
                onClick={() => selectedId && fetchAudience(selectedId)}
                className="ml-auto flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                Atualizar
              </button>
            </div>

            {/* Estado de erro */}
            {error && (
              <div className="flex items-center gap-2 p-4 bg-red/10 border border-red/30 rounded-xl text-red text-sm mb-4">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex items-center gap-2 py-16 text-text-muted text-sm justify-center">
                <RefreshCw size={16} className="animate-spin" /> Carregando respostas...
              </div>
            )}

            {/* Sem resultados */}
            {!loading && !error && rows.length === 0 && selectedProduct && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <Users size={28} className="text-text-muted" />
                <p className="text-text-secondary text-sm">Nenhum comprador respondeu o formulário ainda.</p>
                <p className="text-text-muted text-xs">O cruzamento é feito pelo email — certifique-se de que o formulário pede o mesmo email da compra.</p>
              </div>
            )}

            {/* Tabela */}
            {!loading && rows.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-3 text-text-muted font-medium whitespace-nowrap">Email</th>
                        <th className="text-left px-4 py-3 text-text-muted font-medium whitespace-nowrap">Compra</th>
                        <th className="text-right px-4 py-3 text-text-muted font-medium whitespace-nowrap">Valor</th>
                        <th className="text-left px-4 py-3 text-text-muted font-medium whitespace-nowrap">Campanha</th>
                        {headers.map(h => (
                          <th key={h} className="text-left px-4 py-3 text-text-muted font-medium whitespace-nowrap max-w-[200px]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className={`border-b border-border last:border-0 hover:bg-bg/50 transition-colors`}>
                          <td className="px-4 py-3 font-mono text-text-secondary">{row.email}</td>
                          <td className="px-4 py-3 text-text-muted whitespace-nowrap">{row.purchase_date}</td>
                          <td className="px-4 py-3 text-right font-mono text-accent whitespace-nowrap">
                            R$ {row.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-text-secondary max-w-[160px] truncate" title={row.utm_medium ?? ""}>
                            {row.utm_medium ?? <span className="text-text-dark">—</span>}
                          </td>
                          {headers.map(h => (
                            <td key={h} className="px-4 py-3 text-text-primary max-w-[200px] truncate" title={String(row[h] ?? "")}>
                              {String(row[h] ?? "") || <span className="text-text-dark">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
