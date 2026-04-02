"use client";
import { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useDashboard } from "@/lib/dashboard-context";
import { getPeriodDates } from "@/lib/period";
import {
  Sparkles, RefreshCw, AlertCircle, ChevronDown, ChevronUp,
  TrendingUp, Megaphone, Image, Users, ShoppingBag, CheckCircle2, XCircle,
  Download, Send, MessageSquare,
} from "lucide-react";

// ─── Data source indicator ─────────────────────────────────────────────────────
function DataBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
      active
        ? "text-accent border-accent/30 bg-accent/10"
        : "text-text-dark border-border bg-card"
    }`}>
      {active ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
      {label}
    </span>
  );
}

// ─── Markdown renderer ─────────────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) {
      result.push(<div key={key++} className="h-2" />);
      continue;
    }

    const headerMatch = line.trim().match(/^\*\*(\d+\.\s+.+?|\w[^*]+)\*\*$/);
    if (headerMatch) {
      result.push(
        <p key={key++} className="text-sm font-bold text-text-primary mt-5 mb-2 border-b border-border pb-1.5">
          {headerMatch[1]}
        </p>
      );
      continue;
    }

    const numberedBold = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*\s*(.*)$/);
    if (numberedBold) {
      result.push(
        <div key={key++} className="flex gap-2.5 mt-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent text-[10px] font-bold flex items-center justify-center mt-0.5">
            {numberedBold[1]}
          </span>
          <div className="flex-1">
            <span className="text-sm font-semibold text-text-primary">{numberedBold[2]}</span>
            {numberedBold[3] && <span className="text-sm text-text-secondary"> {numberedBold[3]}</span>}
          </div>
        </div>
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const content = line.replace(/^[-*]\s+/, "");
      const parts = content.split(/\*\*(.+?)\*\*/g);
      result.push(
        <div key={key++} className="flex gap-2 mt-1.5 ml-1">
          <span className="text-accent/60 mt-1.5 flex-shrink-0 text-xs">▸</span>
          <span className="text-sm text-text-secondary leading-relaxed">
            {parts.map((p, pi) =>
              pi % 2 === 1
                ? <strong key={pi} className="text-text-primary font-semibold">{p}</strong>
                : p
            )}
          </span>
        </div>
      );
      continue;
    }

    const parts = line.split(/\*\*(.+?)\*\*/g);
    result.push(
      <p key={key++} className="text-sm text-text-secondary leading-relaxed">
        {parts.map((p, pi) =>
          pi % 2 === 1
            ? <strong key={pi} className="text-text-primary font-semibold">{p}</strong>
            : p
        )}
      </p>
    );
  }

  return result;
}

// ─── Section card ──────────────────────────────────────────────────────────────
function SectionCard({
  icon: Icon, color, title, children,
}: {
  icon: React.ElementType;
  color: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className={`flex items-center gap-2 px-5 py-3 border-b border-border ${color}`}>
        <Icon size={14} />
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ─── Parse analysis into named sections ───────────────────────────────────────
function parseSections(text: string) {
  const sections: Record<string, string> = {};
  const parts = text.split(/\n(?=\*\*\d+\.\s)/);
  for (const part of parts) {
    const titleMatch = part.match(/^\*\*(\d+)\.\s+(.+?)\*\*/);
    if (titleMatch) {
      sections[titleMatch[1]] = part;
    } else {
      sections["0"] = part;
    }
  }
  return sections;
}

const SECTION_CONFIG: Record<string, { icon: React.ElementType; color: string; title: string }> = {
  "1": { icon: TrendingUp,  color: "bg-accent/5 text-accent", title: "Resumo Executivo" },
  "2": { icon: Megaphone,   color: "bg-blue/5 text-blue",     title: "Diagnóstico de Campanhas" },
  "3": { icon: Image,       color: "bg-gold/5 text-gold",     title: "Análise de Criativos" },
  "4": { icon: Sparkles,    color: "bg-accent/5 text-accent", title: "Sugestões de Criativos" },
  "5": { icon: Users,       color: "bg-gold/5 text-gold",     title: "Perfil do Comprador" },
  "6": { icon: ShoppingBag, color: "bg-blue/5 text-blue",     title: "Recomendações Prioritárias" },
};

interface FollowUpMessage {
  question: string;
  answer: string;
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function AnalisesPage() {
  const { client, period } = useDashboard();
  const [analysis, setAnalysis]       = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [showContext, setShowContext]  = useState(false);
  const [rawContext, setRawContext]    = useState<string>("");
  const [lastRun, setLastRun]         = useState<string | null>(null);
  const [dataSources, setDataSources] = useState<Record<string, boolean> | null>(null);

  // Follow-up chat
  const [followUpInput, setFollowUpInput]       = useState("");
  const [followUps, setFollowUps]               = useState<FollowUpMessage[]>([]);
  const [followUpLoading, setFollowUpLoading]   = useState(false);
  const [followUpError, setFollowUpError]       = useState<string | null>(null);
  const followUpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (followUps.length > 0) {
      followUpRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [followUps]);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setRawContext("");
    setDataSources(null);
    setFollowUps([]);
    setFollowUpInput("");

    const { since, until } = getPeriodDates(period);

    try {
      const res = await fetch("/api/analises", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client, period_from: since, period_to: until }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro desconhecido.");
      } else {
        setAnalysis(data.analysis);
        setRawContext(data.context ?? "");
        setDataSources(data.dataSources ?? null);
        setLastRun(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      }
    } catch (e: any) {
      setError(e.message ?? "Falha na requisição.");
    }

    setLoading(false);
  }

  async function sendFollowUp() {
    if (!followUpInput.trim() || !analysis || !rawContext) return;
    const question = followUpInput.trim();
    setFollowUpInput("");
    setFollowUpLoading(true);
    setFollowUpError(null);

    // Build conversation history from previous follow-ups
    const conversationHistory = followUps.flatMap(f => [
      { role: "user" as const,      content: f.question },
      { role: "assistant" as const, content: f.answer },
    ]);

    try {
      const res = await fetch("/api/analises", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client,
          period_from: "",
          period_to: "",
          followUp: question,
          previousAnalysis: analysis,
          context: rawContext,
          conversationHistory,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFollowUpError(data.error ?? "Erro desconhecido.");
      } else {
        setFollowUps(prev => [...prev, { question, answer: data.reply }]);
      }
    } catch (e: any) {
      setFollowUpError(e.message ?? "Falha na requisição.");
    }

    setFollowUpLoading(false);
  }

  function saveAsPDF() {
    if (!analysis) return;

    const pLabel: Record<string, string> = {
      today: "Hoje", yesterday: "Ontem",
      "7d": "Últimos 7 dias", "30d": "Últimos 30 dias",
      "90d": "Últimos 90 dias", mtd: "Mês atual",
    };

    function mdToHtml(text: string): string {
      return text
        .split("\n")
        .map(line => {
          if (!line.trim()) return "<br/>";
          const headerMatch = line.trim().match(/^\*\*(\d+\.\s+.+?)\*\*$/);
          if (headerMatch) return `<h2>${headerMatch[1]}</h2>`;
          if (/^[-*]\s+/.test(line)) {
            return `<li>${line.replace(/^[-*]\s+/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</li>`;
          }
          return `<p>${line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`;
        })
        .join("\n");
    }

    const followUpHtml = followUps.length > 0
      ? `<hr/><h1>Perguntas de Aprofundamento</h1>` +
        followUps.map(f =>
          `<div class="question"><strong>Pergunta:</strong> ${f.question}</div>${mdToHtml(f.answer)}`
        ).join("<hr/>")
      : "";

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Análise — ${client}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 820px; margin: 40px auto; color: #111; font-size: 13px; line-height: 1.65; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin: 28px 0 10px; color: #333; }
    p { margin: 4px 0; }
    li { margin: 3px 0 3px 18px; }
    strong { font-weight: 600; }
    .meta { color: #666; font-size: 11px; margin-bottom: 32px; }
    .question { background: #f5f5f5; padding: 8px 12px; border-radius: 4px; margin: 20px 0 10px; font-size: 13px; }
    hr { border: none; border-top: 1px solid #eee; margin: 32px 0; }
    @media print { body { margin: 20mm; } }
  </style>
</head>
<body>
  <h1>Análise de Performance</h1>
  <div class="meta">${pLabel[period] ?? period} · Cliente: ${client} · ${new Date().toLocaleString("pt-BR")}</div>
  ${mdToHtml(analysis)}
  ${followUpHtml}
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  const periodLabel: Record<string, string> = {
    today: "Hoje", yesterday: "Ontem",
    "7d": "Últimos 7 dias", "30d": "Últimos 30 dias",
    "90d": "Últimos 90 dias", mtd: "Mês atual",
  };

  const sections = analysis ? parseSections(analysis) : null;

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto">
        <Header title="Análises com IA" subtitle="Diagnóstico completo de campanhas, criativos e audiência" />

        {/* Trigger Card */}
        <div className="mt-4 mb-6 p-5 bg-card border border-border rounded-xl">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles size={15} className="text-accent flex-shrink-0" />
                <span className="text-sm font-semibold text-text-primary">Período: {periodLabel[period] ?? period}</span>
              </div>
              <p className="text-xs text-text-muted max-w-lg mb-2">
                Analisa vendas, campanhas (Meta/Google), criativos e respostas de audiência para gerar diagnóstico e sugestões acionáveis.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dataSources ? (
                  <>
                    <DataBadge label="Vendas"    active={dataSources.hasSales} />
                    <DataBadge label="Campanhas" active={dataSources.hasCampaigns} />
                    <DataBadge label="Criativos" active={dataSources.hasCreatives} />
                    <DataBadge label="Audiência" active={dataSources.hasAudience} />
                  </>
                ) : (
                  <span className="text-[11px] text-text-dark font-mono">
                    {lastRun ? `Última análise às ${lastRun}` : "Custo estimado: ~R$ 0,05–0,15 por análise"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {analysis && (
                <button
                  onClick={saveAsPDF}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-text-secondary text-sm hover:text-accent hover:border-accent/30 transition-colors"
                  title="Baixar análise como .md"
                >
                  <Download size={14} />
                  Salvar
                </button>
              )}
              <button
                onClick={runAnalysis}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><RefreshCw size={14} className="animate-spin" /> Analisando...</>
                ) : (
                  <><Sparkles size={14} /> {analysis ? "Reanalisar" : "Gerar análise"}</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-4 bg-red/10 border border-red/30 rounded-xl text-red text-sm mb-4">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Erro ao gerar análise</p>
              <p className="text-red/80 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="flex items-center gap-2 text-text-secondary text-sm">
              <RefreshCw size={16} className="animate-spin text-accent" />
              Consultando Claude AI...
            </div>
            <p className="text-text-muted text-xs">Compilando dados de vendas, campanhas e audiência</p>
          </div>
        )}

        {/* Analysis sections */}
        {sections && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Object.entries(SECTION_CONFIG).map(([num, cfg]) => {
                const content = sections[num];
                if (!content) return null;
                return (
                  <SectionCard key={num} icon={cfg.icon} color={cfg.color} title={cfg.title}>
                    {renderMarkdown(content.replace(/^\*\*\d+\.\s+.+?\*\*\n?/, ""))}
                  </SectionCard>
                );
              })}
            </div>

            {/* Follow-up chat */}
            <div ref={followUpRef} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-accent/5 text-accent">
                <MessageSquare size={14} />
                <span className="text-xs font-semibold uppercase tracking-wider">Aprofundar análise</span>
              </div>

              {/* Previous follow-ups */}
              {followUps.length > 0 && (
                <div className="divide-y divide-border">
                  {followUps.map((f, i) => (
                    <div key={i} className="px-5 py-4 space-y-3">
                      <div className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-border flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[9px] font-bold text-text-muted">EU</span>
                        </span>
                        <p className="text-sm text-text-primary">{f.question}</p>
                      </div>
                      <div className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Sparkles size={9} className="text-accent" />
                        </span>
                        <div className="flex-1">{renderMarkdown(f.answer)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Follow-up error */}
              {followUpError && (
                <div className="px-5 py-3 text-red text-xs border-t border-border">
                  {followUpError}
                </div>
              )}

              {/* Input */}
              <div className="px-5 py-4 border-t border-border">
                <p className="text-xs text-text-muted mb-3">
                  Peça mais detalhes, forneça contexto ou explore um ponto específico da análise.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={followUpInput}
                    onChange={e => setFollowUpInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendFollowUp(); } }}
                    placeholder='Ex: "Aprofunde as sugestões de criativos" ou "Nosso público é formado por..."'
                    disabled={followUpLoading}
                    className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dark focus:outline-none focus:border-accent/40 disabled:opacity-50"
                  />
                  <button
                    onClick={sendFollowUp}
                    disabled={followUpLoading || !followUpInput.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm font-medium hover:bg-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {followUpLoading
                      ? <RefreshCw size={13} className="animate-spin" />
                      : <Send size={13} />
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* Raw context toggle */}
            {rawContext && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowContext(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-3 text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  <span>Ver dados enviados ao Claude</span>
                  {showContext ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showContext && (
                  <pre className="px-5 pb-4 text-[11px] font-mono text-text-muted whitespace-pre-wrap leading-relaxed border-t border-border">
                    {rawContext}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!analysis && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-accent/5 border border-accent/20 flex items-center justify-center">
              <Sparkles size={22} className="text-accent/50" />
            </div>
            <p className="text-text-secondary text-sm font-medium">Análise completa com IA</p>
            <p className="text-text-muted text-xs max-w-sm leading-relaxed">
              Diagnóstico de campanhas, padrões em criativos, perfil do comprador e recomendações acionáveis. Selecione o período e clique em "Gerar análise".
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center mt-1">
              <DataBadge label="Vendas"    active={true} />
              <DataBadge label="Campanhas" active={false} />
              <DataBadge label="Criativos" active={false} />
              <DataBadge label="Audiência" active={false} />
            </div>
            <p className="text-text-dark text-[11px] font-mono mt-1">
              Campanhas e criativos disponíveis após integração Meta/Google API
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
