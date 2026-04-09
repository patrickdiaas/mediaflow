"use client";
import { useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useDashboard } from "@/lib/dashboard-context";
import { getPeriodDates } from "@/lib/period";
import {
  FileBarChart2, RefreshCw, AlertCircle, Download,
  TrendingUp, Megaphone, Image, Sparkles, Users, Target,
} from "lucide-react";

type ReportType = "semanal" | "quinzenal" | "mensal";

const REPORT_TYPES: { value: ReportType; label: string; desc: string }[] = [
  { value: "semanal",    label: "Semanal",    desc: "Resultados da semana + criativos para próxima" },
  { value: "quinzenal",  label: "Quinzenal",  desc: "Performance 15 dias + tendências + ações" },
  { value: "mensal",     label: "Mensal",     desc: "Fechamento completo + comparativo + estratégia" },
];

// ─── Markdown renderer ─────────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { result.push(<div key={key++} className="h-2" />); continue; }

    // Section header: **1. Title** or ## 1. Title
    const headerMatch = line.trim().match(/^(?:\*\*|\#{1,3}\s*)(\d+[\.\)]\s+.+?)(?:\*\*|$)/);
    if (headerMatch) {
      result.push(<p key={key++} className="text-sm font-bold text-text-primary mt-5 mb-2 border-b border-border pb-1.5">{headerMatch[1]}</p>);
      continue;
    }

    // Sub-header: **bold line**
    const subMatch = line.trim().match(/^\*\*(.+?)\*\*$/);
    if (subMatch) {
      result.push(<p key={key++} className="text-sm font-semibold text-text-primary mt-3 mb-1">{subMatch[1]}</p>);
      continue;
    }

    // Numbered bold: 1. **text** rest
    const numberedBold = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*\s*(.*)$/);
    if (numberedBold) {
      result.push(
        <div key={key++} className="flex gap-2.5 mt-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent text-[10px] font-bold flex items-center justify-center mt-0.5">{numberedBold[1]}</span>
          <div className="flex-1">
            <span className="text-sm font-semibold text-text-primary">{numberedBold[2]}</span>
            {numberedBold[3] && <span className="text-sm text-text-secondary"> {numberedBold[3]}</span>}
          </div>
        </div>
      );
      continue;
    }

    // Bullet
    if (/^[-*]\s+/.test(line)) {
      const content = line.replace(/^[-*]\s+/, "");
      const parts = content.split(/\*\*(.+?)\*\*/g);
      result.push(
        <div key={key++} className="flex gap-2 mt-1.5 ml-1">
          <span className="text-accent/60 mt-1.5 flex-shrink-0 text-xs">▸</span>
          <span className="text-sm text-text-secondary leading-relaxed">
            {parts.map((p, pi) => pi % 2 === 1 ? <strong key={pi} className="text-text-primary font-semibold">{p}</strong> : p)}
          </span>
        </div>
      );
      continue;
    }

    // Regular paragraph
    const parts = line.split(/\*\*(.+?)\*\*/g);
    result.push(
      <p key={key++} className="text-sm text-text-secondary leading-relaxed">
        {parts.map((p, pi) => pi % 2 === 1 ? <strong key={pi} className="text-text-primary font-semibold">{p}</strong> : p)}
      </p>
    );
  }
  return result;
}

// ─── Section card ──────────────────────────────────────────────────────────
function SectionCard({ icon: Icon, color, title, children }: { icon: React.ElementType; color: string; title: string; children: React.ReactNode }) {
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

const SECTION_CONFIG: Record<string, { icon: React.ElementType; color: string; title: string }> = {
  "1": { icon: TrendingUp,  color: "bg-accent/5 text-accent", title: "Resultados do Período" },
  "2": { icon: Megaphone,   color: "bg-blue/5 text-blue",     title: "Destaques de Campanhas" },
  "3": { icon: Image,       color: "bg-gold/5 text-gold",     title: "Performance de Criativos" },
  "4": { icon: Sparkles,    color: "bg-accent/5 text-accent", title: "Recomendações de Criativos" },
  "5": { icon: Target,      color: "bg-blue/5 text-blue",     title: "Palavras-chave e Busca" },
  "6": { icon: Users,       color: "bg-gold/5 text-gold",     title: "Próximos Passos" },
};

function parseSections(text: string) {
  const sections: Record<string, string> = {};
  const parts = text.split(/\n(?=\*\*\d+[\.\)]\s|\#{1,3}\s*\d+[\.\)]\s)/);
  for (const part of parts) {
    const titleMatch = part.match(/^(?:\*\*|\#{1,3}\s*)(\d+)[\.\)]\s+(.+?)(?:\*\*|$)/m);
    if (titleMatch) sections[titleMatch[1]] = part;
    else if (!sections["0"]) sections["0"] = part;
  }
  const numSections = Object.keys(sections).filter(k => k !== "0").length;
  if (numSections < 3) return null;
  return sections;
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function RelatoriosPage() {
  const { client, period } = useDashboard();
  const [reportType, setReportType] = useState<ReportType>("semanal");
  const [report, setReport]   = useState<string | null>(null);
  const [kpis, setKpis]       = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function generateReport() {
    setLoading(true);
    setError(null);
    setReport(null);
    setKpis(null);

    const { since, until } = getPeriodDates(period);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000); // 3 min
      const res = await fetch("/api/relatorios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client, period_from: since, period_to: until, reportType }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Erro desconhecido.");
      else { setReport(data.report); setKpis(data.kpis); }
    } catch (e: any) {
      setError(e.message ?? "Falha na requisição.");
    }
    setLoading(false);
  }

  function exportPDF() {
    if (!report) return;
    const clientName = client === "all" ? "Todas as contas" : client;
    const typeLabel = reportType === "semanal" ? "Semanal" : reportType === "quinzenal" ? "Quinzenal" : "Mensal";
    const { since, until } = getPeriodDates(period);
    const periodLabel = `${new Date(since).toLocaleDateString("pt-BR")} a ${new Date(until).toLocaleDateString("pt-BR")}`;

    function mdToHtml(text: string): string {
      return text.split("\n").map(line => {
        if (!line.trim()) return "<div style='height:8px'></div>";
        const headerMatch = line.trim().match(/^(?:\*\*|\#{1,3}\s*)(\d+[\.\)]\s+.+?)(?:\*\*|$)/);
        if (headerMatch) return `<h2>${headerMatch[1]}</h2>`;
        const subMatch = line.trim().match(/^\*\*(.+?)\*\*$/);
        if (subMatch) return `<h3>${subMatch[1]}</h3>`;
        if (/^[-*]\s+/.test(line)) return `<li>${line.replace(/^[-*]\s+/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</li>`;
        return `<p>${line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`;
      }).join("\n");
    }

    const kpiHtml = kpis ? `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-value accent">${kpis.leads}</div><div class="kpi-label">Leads</div></div>
      <div class="kpi"><div class="kpi-value blue">R$ ${kpis.spend?.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div><div class="kpi-label">Investimento</div></div>
      <div class="kpi"><div class="kpi-value gold">${kpis.cpl > 0 ? `R$ ${kpis.cpl.toFixed(2)}` : "—"}</div><div class="kpi-label">CPL</div></div>
      <div class="kpi"><div class="kpi-value">${kpis.metaLeads} Meta · ${kpis.googleLeads} Google</div><div class="kpi-label">Por Plataforma</div></div>
    </div>` : "";

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Relatório ${typeLabel} — ${clientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 860px; margin: 0 auto; color: #1a1a2e; font-size: 13px; line-height: 1.7; padding: 40px 32px; }
    .header { border-bottom: 3px solid #CAFF04; padding-bottom: 20px; margin-bottom: 28px; }
    .header-top { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .header-logo { width: 36px; height: 36px; border-radius: 8px; background: #0a0a0c; display: flex; align-items: center; justify-content: center; color: #CAFF04; font-weight: 900; font-size: 14px; }
    .header-title { font-size: 22px; font-weight: 700; color: #0a0a0c; }
    .header-badge { display: inline-block; background: #CAFF04; color: #0a0a0c; font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-left: 8px; }
    .header-meta { font-size: 12px; color: #666; margin-top: 4px; }
    .header-meta span { display: inline-block; margin-right: 16px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
    .kpi { background: #f8f9fa; border-radius: 8px; padding: 14px 16px; text-align: center; }
    .kpi-value { font-size: 18px; font-weight: 700; }
    .kpi-value.accent { color: #16a34a; }
    .kpi-value.blue { color: #2563eb; }
    .kpi-value.gold { color: #d97706; }
    .kpi-label { font-size: 11px; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
    h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #0a0a0c; border-left: 4px solid #CAFF04; padding-left: 12px; margin: 32px 0 14px; }
    h3 { font-size: 13px; font-weight: 700; color: #333; margin: 18px 0 8px; }
    p { margin: 5px 0; color: #333; }
    li { margin: 4px 0 4px 24px; color: #333; }
    strong { font-weight: 600; color: #0a0a0c; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 2px solid #f0f0f0; font-size: 10px; color: #999; display: flex; justify-content: space-between; }
    @media print { body { padding: 16mm; font-size: 11px; } h2 { break-after: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div class="header-logo">PD</div>
      <div class="header-title">Relatório de Performance<span class="header-badge">${typeLabel}</span></div>
    </div>
    <div class="header-meta">
      <span>Cliente: <strong>${clientName}</strong></span>
      <span>Período: <strong>${periodLabel}</strong></span>
      <span>Gerado: ${new Date().toLocaleString("pt-BR")}</span>
    </div>
  </div>
  ${kpiHtml}
  ${mdToHtml(report)}
  <div class="footer">
    <span>PD Growth // leads.pdgrowth.com.br</span>
    <span>Relatório gerado por IA — Claude Sonnet 4.6</span>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  const sections = report ? parseSections(report) : null;

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto">
        <Header title="Relatórios" subtitle="Reports para equipe com resultados, criativos e próximos passos" />

        {/* Report type selector */}
        <div className="mt-4 mb-6 p-5 bg-card border border-border rounded-xl">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <FileBarChart2 size={15} className="text-accent flex-shrink-0" />
                <span className="text-sm font-semibold text-text-primary">Tipo de Relatório</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {REPORT_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setReportType(t.value)}
                    className={`px-4 py-2.5 rounded-lg text-left transition-all ${
                      reportType === t.value
                        ? "bg-accent/10 border border-accent/30 text-accent"
                        : "bg-bg border border-border text-text-secondary hover:text-text-primary hover:border-border-light"
                    }`}
                  >
                    <span className="text-sm font-semibold block">{t.label}</span>
                    <span className="text-[11px] opacity-70 block mt-0.5">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {report && (
                <button onClick={exportPDF}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-text-secondary text-sm hover:text-accent hover:border-accent/30 transition-colors">
                  <Download size={14} /> Exportar PDF
                </button>
              )}
              <button onClick={generateReport} disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors disabled:opacity-50">
                {loading
                  ? <><RefreshCw size={14} className="animate-spin" /> Gerando...</>
                  : <><FileBarChart2 size={14} /> {report ? "Regerar" : "Gerar Relatório"}</>
                }
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        {kpis && !loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <KpiCard label="Leads" value={String(kpis.leads)} sub={`${kpis.metaLeads} Meta · ${kpis.googleLeads} Google`} color="accent" />
            <KpiCard label="Investimento" value={`R$ ${kpis.spend?.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} color="blue" />
            <KpiCard label="CPL" value={kpis.cpl > 0 ? `R$ ${kpis.cpl.toFixed(2)}` : "—"} color="gold" />
            <KpiCard label="CTR" value={`${kpis.ctr?.toFixed(2)}%`} sub={`${kpis.clicks?.toLocaleString("pt-BR")} cliques`} color="blue" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-4 bg-red/10 border border-red/30 rounded-xl text-red text-sm mb-4">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div><p className="font-semibold">Erro ao gerar relatório</p><p className="text-red/80 text-xs mt-0.5">{error}</p></div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <RefreshCw size={16} className="animate-spin text-accent" />
            <p className="text-text-secondary text-sm">Gerando relatório...</p>
            <p className="text-text-muted text-xs">Compilando dados de Meta Ads, Google Ads e leads</p>
          </div>
        )}

        {/* Report content */}
        {report && !loading && (
          <div className="space-y-4">
            {sections ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.entries(SECTION_CONFIG).map(([num, cfg]) => {
                  const content = sections[num];
                  if (!content) return null;
                  return (
                    <SectionCard key={num} icon={cfg.icon} color={cfg.color} title={cfg.title}>
                      {renderMarkdown(content.replace(/^(?:\*\*|\#{1,3}\s*)\d+[\.\)]\s+.+?(?:\*\*|\n)/, ""))}
                    </SectionCard>
                  );
                })}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-6">
                {renderMarkdown(report)}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!report && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-accent/5 border border-accent/20 flex items-center justify-center">
              <FileBarChart2 size={22} className="text-accent/50" />
            </div>
            <p className="text-text-secondary text-sm font-medium">Relatórios para equipe</p>
            <p className="text-text-muted text-xs max-w-sm leading-relaxed">
              Gere reports semanais, quinzenais ou mensais com resultados, destaques de campanhas, sugestões de criativos e próximos passos divididos por área.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const colorMap: Record<string, string> = {
    accent: "text-accent border-accent/20 bg-accent/5",
    blue: "text-blue border-blue/20 bg-blue/5",
    gold: "text-gold border-gold/20 bg-gold/5",
  };
  const c = colorMap[color] ?? colorMap.accent;
  return (
    <div className={`${c} border rounded-xl p-4`}>
      <span className="text-xs text-text-secondary font-medium block mb-1">{label}</span>
      <span className={`text-lg font-mono font-bold block ${c.split(" ")[0]}`}>{value}</span>
      {sub && <span className="text-[11px] text-text-muted font-mono mt-0.5 block">{sub}</span>}
    </div>
  );
}
