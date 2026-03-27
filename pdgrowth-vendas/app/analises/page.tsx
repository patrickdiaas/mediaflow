"use client";
import { useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useDashboard } from "@/lib/dashboard-context";
import { getPeriodDates } from "@/lib/period";
import {
  Sparkles, RefreshCw, AlertCircle, ChevronDown, ChevronUp,
  TrendingUp, Megaphone, Image, Users, ShoppingBag, CheckCircle2, XCircle,
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

    // Section headers: **1. Title** or **Title**
    const headerMatch = line.trim().match(/^\*\*(\d+\.\s+.+?|\w[^*]+)\*\*$/);
    if (headerMatch) {
      result.push(
        <p key={key++} className="text-sm font-bold text-text-primary mt-5 mb-2 border-b border-border pb-1.5">
          {headerMatch[1]}
        </p>
      );
      continue;
    }

    // Numbered items inside sections: 1. **Bold** text
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

    // Bullet points: - or *
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

    // Regular line — handle inline bold
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
      const num = titleMatch[1];
      sections[num] = part;
    } else {
      sections["0"] = part;
    }
  }
  return sections;
}

const SECTION_CONFIG: Record<string, { icon: React.ElementType; color: string; title: string }> = {
  "1": { icon: TrendingUp,   color: "bg-accent/5 text-accent",  title: "Resumo Executivo" },
  "2": { icon: Megaphone,    color: "bg-blue/5 text-blue",      title: "Diagnóstico de Campanhas" },
  "3": { icon: Image,        color: "bg-gold/5 text-gold",      title: "Análise de Criativos" },
  "4": { icon: Sparkles,     color: "bg-accent/5 text-accent",  title: "Sugestões de Criativos" },
  "5": { icon: Users,        color: "bg-gold/5 text-gold",      title: "Perfil do Comprador" },
  "6": { icon: ShoppingBag,  color: "bg-blue/5 text-blue",      title: "Recomendações Prioritárias" },
};

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function AnalisesPage() {
  const { client, period } = useDashboard();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [rawContext, setRawContext] = useState<string>("");
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [dataSources, setDataSources] = useState<Record<string, boolean> | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setRawContext("");
    setDataSources(null);

    const { from, to } = getPeriodDates(period);

    try {
      const res = await fetch("/api/analises", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client, period_from: from, period_to: to }),
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

  const periodLabel: Record<string, string> = {
    today: "Hoje", yesterday: "Ontem",
    "7d": "Últimos 7 dias", "30d": "Últimos 30 dias",
    "90d": "Últimos 90 dias", mtd: "Mês atual",
  };

  const sections = analysis ? parseSections(analysis) : null;

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
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
                    <DataBadge label="Vendas" active={dataSources.hasSales} />
                    <DataBadge label="Campanhas" active={dataSources.hasCampaigns} />
                    <DataBadge label="Criativos" active={dataSources.hasCreatives} />
                    <DataBadge label="Audiência" active={dataSources.hasAudience} />
                  </>
                ) : (
                  <span className="text-[11px] text-text-dark font-mono">
                    {lastRun ? `Última análise às ${lastRun}` : "Custo estimado: ~R$ 0,01 por análise"}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {loading ? (
                <><RefreshCw size={14} className="animate-spin" /> Analisando...</>
              ) : (
                <><Sparkles size={14} /> Gerar análise</>
              )}
            </button>
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
              <DataBadge label="Vendas" active={true} />
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
