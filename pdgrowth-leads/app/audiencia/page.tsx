"use client";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { supabase } from "@/lib/supabase";
import { useDashboard } from "@/lib/dashboard-context";
import { RefreshCw, FileSpreadsheet, AlertCircle } from "lucide-react";

interface TrackedForm {
  id: string;
  conversion_event: string;
  display_name: string | null;
  sheet_id: string | null;
  source: string;
}

interface AnswerStat {
  answer: string;
  leads: number;
  converted: number;
  rate: number;
}

interface QuestionStat {
  question: string;
  answers: AnswerStat[];
}

export default function AudienciaPage() {
  const { client } = useDashboard();

  const [forms,      setForms]      = useState<TrackedForm[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [questions,  setQuestions]  = useState<QuestionStat[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    const slug = client === "all" ? null : client;
    const q = supabase
      .from("tracked_forms")
      .select("id, conversion_event, display_name, sheet_id, source")
      .eq("active", true)
      .not("sheet_id", "is", null);
    (slug ? q.eq("client_slug", slug) : q).then(({ data }) => {
      setForms(data ?? []);
      if (data && data.length > 0) setSelectedId(data[0].id);
    });
  }, [client]);

  useEffect(() => {
    if (!selectedId) return;
    fetchAudience(selectedId);
  }, [selectedId]);

  async function fetchAudience(formId: string) {
    setLoading(true);
    setError(null);
    setQuestions([]);

    const sheetRes = await fetch(`/api/sheets/${formId}`);
    if (!sheetRes.ok) {
      const err = await sheetRes.json();
      setError(err.error ?? "Erro ao carregar planilha.");
      setLoading(false);
      return;
    }
    const { headers: sheetHeaders, rows: sheetRows } = await sheetRes.json();

    const emailHeader = sheetHeaders.find((h: string) =>
      h.toLowerCase().includes("email") || h.toLowerCase().includes("e-mail")
    );
    if (!emailHeader) {
      setError("Coluna de email não encontrada na planilha.");
      setLoading(false);
      return;
    }

    // Busca emails dos leads para cruzar conversão
    const slug = client === "all" ? null : client;
    const leadsQ = supabase.from("leads").select("lead_email");
    const { data: leadsData } = await (slug ? leadsQ.eq("client_slug", slug) : leadsQ);

    const leadEmails = new Set(
      (leadsData ?? []).map((l: any) => l.lead_email?.toLowerCase()).filter(Boolean)
    );

    const questionCols = sheetHeaders.filter((h: string) => {
      const l = h.toLowerCase();
      return !l.includes("email") && !l.includes("e-mail") &&
             !l.includes("timestamp") && !l.includes("carimbo") &&
             !l.includes("whatsapp") && !l.includes("telefone") &&
             !l.includes("celular") && !l.includes("phone");
    });

    const stats: QuestionStat[] = questionCols.map((col: string) => {
      const answerMap = new Map<string, { leads: number; converted: number }>();
      for (const row of sheetRows) {
        const answer = String(row[col] ?? "").trim();
        if (!answer) continue;
        const email = String(row[emailHeader] ?? "").toLowerCase().trim();
        const existing = answerMap.get(answer) ?? { leads: 0, converted: 0 };
        existing.leads++;
        if (email && leadEmails.has(email)) existing.converted++;
        answerMap.set(answer, existing);
      }

      const answers: AnswerStat[] = Array.from(answerMap.entries())
        .map(([answer, s]) => ({
          answer,
          leads: s.leads,
          converted: s.converted,
          rate: s.leads > 0 ? (s.converted / s.leads) * 100 : 0,
        }))
        .sort((a, b) => b.leads - a.leads);

      return { question: col, answers };
    });

    setTotalLeads(sheetRows.length);
    setQuestions(stats);
    setLoading(false);
  }

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto">
        <Header title="Audiência" subtitle="Análise de respostas e perfil dos leads" />

        {forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <FileSpreadsheet size={32} className="text-text-muted" />
            <p className="text-text-secondary text-sm">Nenhum formulário com planilha vinculada.</p>
            <p className="text-text-muted text-xs max-w-xs">
              Acesse <strong className="text-text-secondary">Configurações</strong> e cole o ID da planilha Google em cada formulário rastreado.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-6">
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/40 cursor-pointer"
              >
                {forms.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.display_name ?? f.conversion_event}
                  </option>
                ))}
              </select>

              {!loading && questions.length > 0 && (
                <div className="flex items-center gap-4 text-sm text-text-muted">
                  <span><span className="font-mono font-semibold text-text-secondary">{totalLeads}</span> respostas</span>
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
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <p className="text-xs font-semibold text-text-primary leading-snug">{stat.question}</p>
        <p className="text-[10px] text-text-muted mt-0.5">{stat.answers.length} respostas</p>
      </div>

      <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
        <div className="grid grid-cols-[1fr_48px_52px] px-5 py-2 sticky top-0 bg-card z-10">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Resposta</span>
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider text-right">Total</span>
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider text-right">Leads</span>
        </div>

        {stat.answers.map((a, i) => (
          <div key={i} className="px-5 py-3 hover:bg-bg/40 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-2">
              <span className="text-xs text-text-primary leading-snug flex-1">{a.answer}</span>
              <div className="flex items-center gap-4 flex-shrink-0 pt-0.5">
                <span className="text-xs font-mono text-text-secondary w-10 text-right">{a.leads}</span>
                <span className="text-xs font-mono text-accent w-10 text-right">{a.converted > 0 ? a.converted : "—"}</span>
              </div>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(a.leads / maxLeads) * 100}%`,
                  background: a.converted > 0 ? "#CAFF04" : "#1E2433",
                  opacity: a.converted > 0 ? 0.7 : 1,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
