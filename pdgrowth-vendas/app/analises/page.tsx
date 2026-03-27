"use client";
import { useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useDashboard } from "@/lib/dashboard-context";
import { getPeriodDates } from "@/lib/period";
import { Sparkles, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

function parseMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) {
      result.push(<div key={key++} className="h-2" />);
      continue;
    }

    // Bold headers like **Text**
    if (/^\*\*(.+)\*\*$/.test(line.trim())) {
      const m = line.trim().match(/^\*\*(.+)\*\*$/)!;
      result.push(
        <p key={key++} className="text-sm font-semibold text-text-primary mt-4 mb-1">
          {m[1]}
        </p>
      );
      continue;
    }

    // Numbered list: 1. **Title** ...
    const numberedBold = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*\s*(.*)$/);
    if (numberedBold) {
      result.push(
        <div key={key++} className="flex gap-2 mt-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent text-[10px] font-bold flex items-center justify-center mt-0.5">
            {numberedBold[1]}
          </span>
          <div>
            <span className="text-sm font-semibold text-text-primary">{numberedBold[2]}</span>
            {numberedBold[3] && <span className="text-sm text-text-secondary"> {numberedBold[3]}</span>}
          </div>
        </div>
      );
      continue;
    }

    // Bullet: - text or * text
    if (/^[-*]\s+/.test(line)) {
      const content = line.replace(/^[-*]\s+/, "");
      // Handle inline bold in bullets
      const parts = content.split(/\*\*(.+?)\*\*/g);
      result.push(
        <div key={key++} className="flex gap-2 mt-1.5 ml-2">
          <span className="text-accent mt-1.5 flex-shrink-0">•</span>
          <span className="text-sm text-text-secondary leading-relaxed">
            {parts.map((p, pi) => pi % 2 === 1 ? <strong key={pi} className="text-text-primary font-semibold">{p}</strong> : p)}
          </span>
        </div>
      );
      continue;
    }

    // Regular paragraph — handle inline bold
    const parts = line.split(/\*\*(.+?)\*\*/g);
    result.push(
      <p key={key++} className="text-sm text-text-secondary leading-relaxed">
        {parts.map((p, pi) => pi % 2 === 1 ? <strong key={pi} className="text-text-primary font-semibold">{p}</strong> : p)}
      </p>
    );
  }

  return result;
}

export default function AnalisesPage() {
  const { client, period } = useDashboard();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [rawContext, setRawContext] = useState<string>("");
  const [lastRun, setLastRun] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setRawContext("");

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
        setLastRun(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      }
    } catch (e: any) {
      setError(e.message ?? "Falha na requisição.");
    }

    setLoading(false);
  }

  const periodLabel: Record<string, string> = {
    today: "Hoje",
    yesterday: "Ontem",
    "7d": "Últimos 7 dias",
    "30d": "Últimos 30 dias",
    "90d": "Últimos 90 dias",
    mtd: "Mês atual",
  };

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Header title="Análises com IA" subtitle="Insights automáticos sobre performance de vendas" />

        {/* Trigger Card */}
        <div className="mt-4 mb-6 p-5 bg-card border border-border rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-accent" />
                <span className="text-sm font-semibold text-text-primary">Análise do período: {periodLabel[period] ?? period}</span>
              </div>
              <p className="text-xs text-text-muted max-w-md">
                O Claude vai analisar faturamento, produtos, campanhas e padrões de compra para gerar recomendações acionáveis. Custo estimado: ~R$ 0,05 por análise.
              </p>
              {lastRun && (
                <p className="text-[11px] text-text-dark mt-2 font-mono">Última análise às {lastRun}</p>
              )}
            </div>
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {loading ? (
                <><RefreshCw size={14} className="animate-spin" /> Analisando...</>
              ) : (
                <><Sparkles size={14} /> Gerar análise</>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-4 bg-red/10 border border-red/30 rounded-xl text-red text-sm mb-4">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Erro ao gerar análise</p>
              <p className="text-red/80 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex items-center gap-2 text-text-secondary text-sm">
              <RefreshCw size={16} className="animate-spin text-accent" />
              Consultando Claude AI...
            </div>
            <p className="text-text-muted text-xs">Isso pode levar alguns segundos</p>
          </div>
        )}

        {analysis && !loading && (
          <div className="space-y-4">
            {/* Analysis Card */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-accent/5">
                <Sparkles size={14} className="text-accent" />
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">Análise gerada pelo Claude AI</span>
              </div>
              <div className="px-5 py-4">
                {parseMarkdown(analysis)}
              </div>
            </div>

            {/* Raw Context Toggle */}
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

        {!analysis && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-accent/5 border border-accent/20 flex items-center justify-center">
              <Sparkles size={20} className="text-accent/60" />
            </div>
            <p className="text-text-secondary text-sm">Clique em "Gerar análise" para receber insights sobre o período selecionado.</p>
            <p className="text-text-muted text-xs max-w-xs">
              Selecione o período no filtro do cabeçalho antes de gerar a análise.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
