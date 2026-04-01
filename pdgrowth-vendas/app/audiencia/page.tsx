"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { supabase } from "@/lib/supabase";
import { useDashboard } from "@/lib/dashboard-context";
import { RefreshCw, FileSpreadsheet, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface TrackedProduct {
  id: string;
  product_id: string;
  product_name: string | null;
  sheet_id: string | null;
  gateway: string;
}

interface AnswerStat {
  answer: string;
  leads: number;
  vendas: number;
  rate: number;
}

interface QuestionStat {
  question: string;
  answers: AnswerStat[];
}

export default function AudienciaPage() {
  const { client } = useDashboard();

  const [salesSlug,  setSalesSlug]  = useState<string | null>(null);
  const [products,   setProducts]   = useState<TrackedProduct[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [questions,  setQuestions]  = useState<QuestionStat[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Resolve sales_slug para o cliente selecionado
  useEffect(() => {
    if (client === "all") { setSalesSlug(null); return; }
    supabase.from("clients").select("sales_slug").eq("slug", client).single()
      .then(({ data }) => setSalesSlug(data?.sales_slug ?? client));
  }, [client]);

  useEffect(() => {
    const slug = salesSlug ?? (client === "all" ? null : client);
    const q = supabase
      .from("tracked_products")
      .select("id, product_id, product_name, sheet_id, gateway")
      .eq("active", true)
      .not("sheet_id", "is", null);
    (slug ? q.eq("client_slug", slug) : q).then(({ data }) => {
      setProducts(data ?? []);
      if (data && data.length > 0) setSelectedId(data[0].product_id);
    });
  }, [salesSlug, client]);

  useEffect(() => {
    if (!selectedId) return;
    fetchAudience(selectedId);
  }, [selectedId]);

  async function fetchAudience(productId: string) {
    setLoading(true);
    setError(null);
    setQuestions([]);

    // Busca respostas do Google Sheets
    const sheetRes = await fetch(`/api/sheets/${productId}`);
    if (!sheetRes.ok) {
      const err = await sheetRes.json();
      setError(err.error ?? "Erro ao carregar planilha.");
      setLoading(false);
      return;
    }
    const { headers: sheetHeaders, rows: sheetRows } = await sheetRes.json();

    // Detecta coluna de email
    const emailHeader = sheetHeaders.find((h: string) =>
      h.toLowerCase().includes("email") || h.toLowerCase().includes("e-mail")
    );
    if (!emailHeader) {
      setError("Coluna de email não encontrada na planilha.");
      setLoading(false);
      return;
    }

    // Busca vendas aprovadas do produto
    const slug = salesSlug ?? client;
    const salesQ = supabase.from("sales").select("buyer_email").eq("product_id", productId).eq("status", "approved");
    const { data: sales } = await (slug !== "all" ? salesQ.eq("client_slug", slug) : salesQ);

    const salesEmails = new Set(
      (sales ?? []).map((s: any) => s.buyer_email?.toLowerCase()).filter(Boolean)
    );

    // Filtra colunas de perguntas (exclui email, timestamp, whatsapp, telefone)
    const questionCols = sheetHeaders.filter((h: string) => {
      const l = h.toLowerCase();
      return !l.includes("email") && !l.includes("e-mail") &&
             !l.includes("timestamp") && !l.includes("carimbo") &&
             !l.includes("whatsapp") && !l.includes("telefone") &&
             !l.includes("celular") && !l.includes("phone");
    });

    // Para cada pergunta, agrupa respostas com contagem de leads e vendas
    const stats: QuestionStat[] = questionCols.map((col: string) => {
      const answerMap = new Map<string, { leads: number; vendas: number }>();

      for (const row of sheetRows) {
        const answer = String(row[col] ?? "").trim();
        if (!answer) continue;
        const email = String(row[emailHeader] ?? "").toLowerCase().trim();
        const existing = answerMap.get(answer) ?? { leads: 0, vendas: 0 };
        existing.leads++;
        if (email && salesEmails.has(email)) existing.vendas++;
        answerMap.set(answer, existing);
      }

      const answers: AnswerStat[] = Array.from(answerMap.entries())
        .map(([answer, s]) => ({
          answer,
          leads:  s.leads,
          vendas: s.vendas,
          rate:   s.leads > 0 ? (s.vendas / s.leads) * 100 : 0,
        }))
        .sort((a, b) => b.leads - a.leads);

      return { question: col, answers };
    });

    const matchedSales = sheetRows.filter((row: any) => {
      const email = String(row[emailHeader] ?? "").toLowerCase().trim();
      return email && salesEmails.has(email);
    }).length;

    setTotalLeads(sheetRows.length);
    setTotalSales(matchedSales);
    setQuestions(stats);
    setLoading(false);
  }

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <Header title="Audiência" subtitle="Análise de conversão por qualidade das respostas" />

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
            {/* Controles */}
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

              {!loading && questions.length > 0 && (
                <div className="flex items-center gap-4 text-sm text-text-muted">
                  <span>
                    <span className="font-mono font-semibold text-text-secondary">{totalLeads}</span> respostas
                  </span>
                  <span>
                    <span className="font-mono font-semibold text-accent">{totalSales}</span> compraram
                  </span>
                  <span>
                    <span className="font-mono font-semibold text-gold">
                      {totalLeads > 0 ? ((totalSales / totalLeads) * 100).toFixed(1) : "0"}%
                    </span> conversão geral
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

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red/10 border border-red/30 rounded-xl text-red text-sm mb-4">
                <AlertCircle size={16} />{error}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 py-16 text-text-muted text-sm justify-center">
                <RefreshCw size={16} className="animate-spin" /> Carregando respostas...
              </div>
            )}

            {!loading && !error && questions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <p className="text-text-secondary text-sm">Nenhuma resposta encontrada.</p>
              </div>
            )}

            {/* Cards de perguntas */}
            {!loading && questions.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {questions.map(q => (
                  <QuestionCard key={q.question} stat={q} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function QuestionCard({ stat }: { stat: QuestionStat }) {
  const maxLeads = Math.max(...stat.answers.map(a => a.leads), 1);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Título */}
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <p className="text-xs font-semibold text-text-primary leading-snug">
          {stat.question}
        </p>
        <p className="text-[10px] text-text-muted mt-0.5">{stat.answers.length} respostas</p>
      </div>

      {/* Gráfico de barras horizontais + tabela integrada */}
      <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
        {/* Header */}
        <div className="grid grid-cols-[1fr_48px_48px_52px] px-5 py-2 sticky top-0 bg-card z-10">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Resposta</span>
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider text-right">Leads</span>
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider text-right">Vendas</span>
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider text-right">Conv.</span>
        </div>

        {stat.answers.map((a, i) => (
          <div key={i} className="px-5 py-3 hover:bg-bg/40 transition-colors">
            {/* Texto da resposta */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <span className="text-xs text-text-primary leading-snug flex-1">{a.answer}</span>
              <div className="flex items-center gap-4 flex-shrink-0 pt-0.5">
                <span className="text-xs font-mono text-text-secondary w-10 text-right">{a.leads}</span>
                <span className="text-xs font-mono text-accent w-10 text-right">{a.vendas > 0 ? a.vendas : "—"}</span>
                <span className="text-xs font-mono font-semibold w-12 text-right" style={{
                  color: a.rate > 20 ? "#CAFF04" : a.rate > 10 ? "#F59E0B" : a.rate > 0 ? "#60A5FA" : "#4B5563"
                }}>
                  {a.vendas > 0 ? `${a.rate.toFixed(1)}%` : "—"}
                </span>
              </div>
            </div>
            {/* Barra de progresso */}
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(a.leads / maxLeads) * 100}%`,
                  background: a.vendas > 0 ? "#CAFF04" : "#1E2433",
                  opacity: a.vendas > 0 ? 0.7 : 1,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
