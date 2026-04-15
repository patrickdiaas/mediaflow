"use client";
import { useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useDashboard } from "@/lib/dashboard-context";
import {
  FileBarChart2, RefreshCw, AlertCircle, Download, Send,
  TrendingUp, Megaphone, Image, Sparkles, Users, Target, MessageSquare,
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

    // Sub-header: ### Title
    const h3Match = line.trim().match(/^\#{3}\s+(.+)/);
    if (h3Match) {
      result.push(<p key={key++} className="text-sm font-semibold text-accent mt-4 mb-1.5">{h3Match[1].replace(/\*\*/g, "")}</p>);
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
  "1": { icon: TrendingUp,  color: "bg-accent/5 text-accent", title: "Overview do Período" },
  "2": { icon: Megaphone,   color: "bg-blue/5 text-blue",     title: "Meta Ads — Campanhas" },
  "3": { icon: Target,      color: "bg-gold/5 text-gold",     title: "Google Ads — Campanhas" },
  "4": { icon: Sparkles,    color: "bg-accent/5 text-accent", title: "Destaques e Pontos de Atenção" },
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
  const { client } = useDashboard();
  const [reportType, setReportType] = useState<ReportType>("semanal");
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");
  const [report, setReport]   = useState<string | null>(null);
  const [kpis, setKpis]       = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Follow-up / corrections
  const [savedContext, setSavedContext] = useState<{ context: string; systemPrompt: string } | null>(null);
  const [followUpInput, setFollowUpInput] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);

  async function generateReport() {
    setLoading(true);
    setError(null);
    setReport(null);
    setKpis(null);

    // Usa datas personalizadas se preenchidas, senão calcula pelo tipo
    let since: string, until: string;
    if (customSince && customUntil) {
      since = customSince;
      until = customUntil;
    } else if (reportType === "mensal") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const u = new Date(today.getFullYear(), today.getMonth(), 0);
      since = s.toISOString().split("T")[0];
      until = u.toISOString().split("T")[0];
    } else if (reportType === "quinzenal") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const u = new Date(today); u.setDate(u.getDate() - 1);
      const s = new Date(u); s.setDate(s.getDate() - 14);
      since = s.toISOString().split("T")[0];
      until = u.toISOString().split("T")[0];
    } else {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const u = new Date(today); u.setDate(u.getDate() - 1);
      const s = new Date(u); s.setDate(s.getDate() - 6);
      since = s.toISOString().split("T")[0];
      until = u.toISOString().split("T")[0];
    }

    try {
      // Step 1: Fetch data + build prompts (fast, ~5s)
      const res1 = await fetch("/api/relatorios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client, period_from: since, period_to: until, reportType }),
      });
      const data1 = await res1.json();
      if (!res1.ok) { setError(data1.error ?? "Erro ao buscar dados."); setLoading(false); return; }

      setKpis(data1.kpis);

      // Step 2: Generate report with Claude (longer, uses separate endpoint)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000); // 5 min
      const res2 = await fetch("/api/relatorios/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          context: data1.context,
          systemPrompt: data1.systemPrompt,
          userPrompt: data1.userPrompt,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data2 = await res2.json();
      if (!res2.ok) setError(data2.error ?? "Erro ao gerar relatório.");
      else {
        setReport(data2.report);
        setSavedContext({ context: data1.context, systemPrompt: data1.systemPrompt });
      }
    } catch (e: any) {
      setError(e.message ?? "Falha na requisição.");
    }
    setLoading(false);
  }

  async function sendCorrection() {
    if (!followUpInput.trim() || !report || !savedContext) return;
    const correction = followUpInput.trim();
    setFollowUpInput("");
    setFollowUpLoading(true);
    setError(null);

    try {
      const correctionPrompt = `Você gerou o relatório abaixo. O gestor está pedindo uma correção ou ajuste.

RELATÓRIO ATUAL:
${report}

DADOS DO PERÍODO:
${savedContext.context}

CORREÇÃO SOLICITADA:
${correction}

Gere o relatório COMPLETO novamente, incorporando a correção. Mantenha toda a estrutura e seções, apenas ajuste o que foi pedido. Use o mesmo formato (seções numeradas, tabelas, etc).`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000);
      const res = await fetch("/api/relatorios/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          context: savedContext.context,
          systemPrompt: savedContext.systemPrompt,
          userPrompt: correctionPrompt,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Erro ao corrigir.");
      else setReport(data.report);
    } catch (e: any) {
      setError(e.message ?? "Falha na requisição.");
    }
    setFollowUpLoading(false);
  }

  function exportPDF() {
    if (!report) return;
    const clientName = client === "all" ? "Todas as contas" : client;
    const typeLabel = reportType === "semanal" ? "Semanal" : reportType === "quinzenal" ? "Quinzenal" : "Mensal";

    // Recalcular período para o PDF (mesma lógica do generateReport)
    let pSince: string, pUntil: string;
    if (customSince && customUntil) {
      pSince = new Date(customSince + "T12:00:00").toLocaleDateString("pt-BR");
      pUntil = new Date(customUntil + "T12:00:00").toLocaleDateString("pt-BR");
    } else if (reportType === "mensal") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const u = new Date(today.getFullYear(), today.getMonth(), 0);
      pSince = s.toLocaleDateString("pt-BR");
      pUntil = u.toLocaleDateString("pt-BR");
    } else if (reportType === "quinzenal") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const u = new Date(today); u.setDate(u.getDate() - 1);
      const s = new Date(u); s.setDate(s.getDate() - 14);
      pSince = s.toLocaleDateString("pt-BR");
      pUntil = u.toLocaleDateString("pt-BR");
    } else {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const u = new Date(today); u.setDate(u.getDate() - 1);
      const s = new Date(u); s.setDate(s.getDate() - 6);
      pSince = s.toLocaleDateString("pt-BR");
      pUntil = u.toLocaleDateString("pt-BR");
    }
    const periodLabel = `${pSince} a ${pUntil}`;

    // Convert URLs in text to clickable links
    function autoLink(s: string): string {
      return s.replace(/(https?:\/\/[^\s<>"')\]]+)/g, '<a href="$1" target="_blank">$1</a>');
    }

    function mdToHtml(text: string): string {
      return text.split("\n").map(line => {
        if (!line.trim()) return "<div style='height:10px'></div>";
        // Tables: | col | col |
        if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
          if (line.includes("---")) return ""; // separator row
          const cells = line.split("|").filter(c => c.trim());
          const isHeader = !line.includes("R$") && !line.includes("%") && cells.every(c => c.trim().length < 30);
          const tag = isHeader ? "th" : "td";
          return `<tr>${cells.map(c => `<${tag}>${autoLink(c.trim().replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"))}</${tag}>`).join("")}</tr>`;
        }
        // Section headers: **1. Title** or ## 1. Title
        const headerMatch = line.trim().match(/^(?:\*\*|\#{1,2}\s*)(\d+[\.\)]\s+.+?)(?:\*\*|$)/);
        if (headerMatch) return `</table><h2>${headerMatch[1]}</h2><table>`;
        // Sub-headers: ### Title or **Title**
        const h3Match = line.trim().match(/^\#{3}\s+(.+)/);
        if (h3Match) return `</table><h3>${h3Match[1].replace(/\*\*/g, "")}</h3><table>`;
        const subMatch = line.trim().match(/^\*\*(.+?)\*\*$/);
        if (subMatch) return `</table><h3>${subMatch[1]}</h3><table>`;
        // Blockquote with emoji
        if (line.trim().startsWith(">")) {
          const content = autoLink(line.replace(/^>\s*/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"));
          return `</table><div class="callout">${content}</div><table>`;
        }
        if (/^[-*]\s+/.test(line)) return `</table><li>${autoLink(line.replace(/^[-*]\s+/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"))}</li><table>`;
        if (line.trim() === "---") return `</table><hr/><table>`;
        return `</table><p>${autoLink(line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"))}</p><table>`;
      }).join("\n").replace(/<table>\s*<\/table>/g, "").replace(/<table>\n<\/table>/g, "");
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
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 900px; margin: 0 auto; color: #e2e2e8; font-size: 13px; line-height: 1.7; padding: 40px 36px; background: #0e1018; }

    /* Header */
    .header { margin-bottom: 32px; }
    .header-top { margin-bottom: 12px; }
    .header-title { font-size: 26px; font-weight: 800; color: #f2f2f5; letter-spacing: -0.02em; }
    .header-sub { font-size: 13px; color: #8888a0; margin-top: 2px; }
    .header-badge { display: inline-block; background: #CAFF04; color: #0a0a0c; font-size: 11px; font-weight: 800; padding: 3px 12px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.06em; margin-left: 10px; vertical-align: middle; }

    /* KPIs */
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0 32px; }
    .kpi { background: #14161e; border: 1px solid #24242c; border-radius: 12px; padding: 18px 16px; text-align: center; }
    .kpi-value { font-size: 22px; font-weight: 800; font-family: 'DM Mono', monospace; }
    .kpi-value.accent { color: #CAFF04; }
    .kpi-value.blue { color: #60A5FA; }
    .kpi-value.gold { color: #F59E0B; }
    .kpi-label { font-size: 10px; color: #6a6a7a; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.08em; }

    /* Sections */
    h2 { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #CAFF04; border-left: 4px solid #CAFF04; padding-left: 14px; margin: 36px 0 16px; }
    h3 { font-size: 13px; font-weight: 700; color: #f2f2f5; margin: 22px 0 10px; padding: 8px 14px; background: #14161e; border: 1px solid #24242c; border-radius: 8px; }
    p { margin: 6px 0; color: #b0b0c0; }
    li { margin: 4px 0 4px 20px; color: #b0b0c0; }
    strong { font-weight: 700; color: #f2f2f5; }
    hr { border: none; border-top: 1px solid #24242c; margin: 24px 0; }
    a { color: #60A5FA; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    th { background: #14161e; color: #8888a0; font-weight: 600; text-align: left; padding: 8px 12px; border-bottom: 2px solid #24242c; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 8px 12px; border-bottom: 1px solid #1a1a24; color: #d0d0dd; }
    tr:hover td { background: #14161e; }

    /* Callouts */
    .callout { background: #14161e; border-left: 3px solid #CAFF04; border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 14px 0; font-size: 12px; color: #c0c0d0; }

    /* Footer */
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #24242c; font-size: 10px; color: #4a4a5a; display: flex; justify-content: space-between; }

    @media print {
      body { padding: 12mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      h2 { break-after: avoid; }
      .kpi-grid { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div class="header-title">Relatório de Performance<span class="header-badge">${typeLabel}</span></div>
    </div>
    <div class="header-sub">
      Cliente: <strong>${clientName}</strong> &nbsp;·&nbsp; Período: <strong>${periodLabel}</strong> &nbsp;·&nbsp; Gerado: ${new Date().toLocaleString("pt-BR")}
    </div>
  </div>
  ${kpiHtml}
  <table></table>
  ${mdToHtml(report)}
  <div class="footer">
    <span>PD Growth // leads.pdgrowth.com.br</span>
    <span>${periodLabel}</span>
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
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-text-muted">Período:</span>
                <input type="date" value={customSince} onChange={e => setCustomSince(e.target.value)}
                  className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/40 cursor-pointer" />
                <span className="text-xs text-text-muted">até</span>
                <input type="date" value={customUntil} onChange={e => setCustomUntil(e.target.value)}
                  className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/40 cursor-pointer" />
                {(customSince || customUntil) && (
                  <button onClick={() => { setCustomSince(""); setCustomUntil(""); }}
                    className="text-[10px] text-text-muted hover:text-red transition-colors">limpar</button>
                )}
                {!customSince && !customUntil && (
                  <span className="text-[10px] text-text-dark font-mono">
                    {reportType === "mensal" ? "mês anterior" : reportType === "quinzenal" ? "últimos 15 dias" : "últimos 7 dias"} (automático)
                  </span>
                )}
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
              <div className="space-y-4">
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

            {/* Correction chat */}
            {savedContext && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-accent/5 text-accent">
                  <MessageSquare size={14} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Corrigir ou Ajustar</span>
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs text-text-muted mb-3">
                    Informe correções, contexto adicional ou ações realizadas no período. O relatório será regenerado completo com os ajustes.
                  </p>
                  <div className="space-y-2">
                    <textarea
                      value={followUpInput}
                      onChange={e => setFollowUpInput(e.target.value)}
                      placeholder={"Ex:\n- A campanha institucional teve 5 conversões pelo pixel do Google\n- Nesta semana foram criados 3 novos criativos para YouLaser\n- Ajustamos as UTMs de todas as campanhas Google\n- Pausamos o criativo estatico-02 por baixo desempenho"}
                      disabled={followUpLoading}
                      rows={4}
                      className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-dark focus:outline-none focus:border-accent/40 disabled:opacity-50 resize-y"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={sendCorrection}
                        disabled={followUpLoading || !followUpInput.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm font-medium hover:bg-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {followUpLoading ? <><RefreshCw size={13} className="animate-spin" /> Regenerando...</> : <><Send size={13} /> Regenerar com ajustes</>}
                      </button>
                    </div>
                  </div>
                </div>
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
