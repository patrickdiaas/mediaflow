"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useDashboard } from "@/lib/dashboard-context";
import {
  FileBarChart2, RefreshCw, AlertCircle, Download, Send,
  TrendingUp, Megaphone, Image, Sparkles, Users, Target, MessageSquare,
  ListChecks, Plus, Trash2, ChevronDown, ChevronRight, BookmarkPlus, NotebookPen, Presentation as PresentationIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Presentation from "@/components/presentation";

type ReportType = "semanal" | "quinzenal" | "mensal";

interface ReportObservation {
  id: string;
  client_slug: string;
  since: string;
  until: string | null;
  content: string;
  slide_tag: string | null;
  created_at: string;
  updated_at: string;
}

const SLIDE_TAGS: { value: string; label: string }[] = [
  { value: "",          label: "Geral (aparece como seção dedicada)" },
  { value: "pacing",    label: "Pacing do mês" },
  { value: "weekly",    label: "Comparativo semanal" },
  { value: "monthly",   label: "Mês corrente vs anterior" },
  { value: "meta",      label: "Meta Ads" },
  { value: "google",    label: "Google Ads" },
];

interface ReportAction {
  id: string;
  client_slug: string;
  action_date: string;
  platform: string | null;
  campaign_name: string | null;
  title: string;
  description: string;
  link: string | null;
  created_at: string;
}

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

// Calcula o intervalo (since/until) baseado em reportType + custom inputs.
function computePeriod(reportType: ReportType, customSince: string, customUntil: string): { since: string; until: string } {
  if (customSince && customUntil) return { since: customSince, until: customUntil };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (reportType === "mensal") {
    const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const u = new Date(today.getFullYear(), today.getMonth(), 0);
    return { since: s.toISOString().split("T")[0], until: u.toISOString().split("T")[0] };
  }
  if (reportType === "quinzenal") {
    const u = new Date(today); u.setDate(u.getDate() - 1);
    const s = new Date(u); s.setDate(s.getDate() - 14);
    return { since: s.toISOString().split("T")[0], until: u.toISOString().split("T")[0] };
  }
  const u = new Date(today); u.setDate(u.getDate() - 1);
  const s = new Date(u); s.setDate(s.getDate() - 6);
  return { since: s.toISOString().split("T")[0], until: u.toISOString().split("T")[0] };
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function RelatoriosPage() {
  const { client } = useDashboard();
  const [reportType, setReportType] = useState<ReportType>("semanal");
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");
  const [report, setReport]   = useState<string | null>(null);
  const [kpis, setKpis]       = useState<any>(null);
  const [presentationData, setPresentationData] = useState<any>(null);
  const [showPresentation, setShowPresentation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Follow-up / corrections
  const [savedContext, setSavedContext] = useState<{ context: string; systemPrompt: string } | null>(null);
  const [followUpInput, setFollowUpInput] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);

  // Observações persistidas com vigência (since/until) — narrativa contextual
  const [observations, setObservations] = useState<ReportObservation[]>([]);
  const [observationsExpanded, setObservationsExpanded] = useState(false);
  const [newObsSince, setNewObsSince] = useState(() => new Date().toISOString().slice(0, 10));
  const [newObsUntil, setNewObsUntil] = useState("");
  const [newObsContent, setNewObsContent] = useState("");
  const [newObsTag, setNewObsTag] = useState("");
  const [savingObs, setSavingObs] = useState(false);

  // Ações realizadas pelo gestor — persistidas e injetadas no contexto.
  const [actions, setActions] = useState<ReportAction[]>([]);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [campaignNames, setCampaignNames] = useState<string[]>([]);
  const [newActionDate, setNewActionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newActionPlatform, setNewActionPlatform] = useState<"meta" | "google" | "geral">("meta");
  const [newActionCampaign, setNewActionCampaign] = useState("");
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionDesc, setNewActionDesc] = useState("");
  const [newActionLink, setNewActionLink] = useState("");
  const [savingAction, setSavingAction] = useState(false);

  const period = computePeriod(reportType, customSince, customUntil);

  async function fetchActions() {
    if (client === "all") { setActions([]); return; }
    const url = `/api/admin/actions?client=${encodeURIComponent(client)}&since=${period.since}&until=${period.until}`;
    const res = await fetch(url);
    const json = await res.json();
    if (res.ok) setActions(json.data ?? []);
  }

  async function fetchObservations() {
    if (client === "all") { setObservations([]); return; }
    const url = `/api/admin/observations?client=${encodeURIComponent(client)}&overlaps_since=${period.since}&overlaps_until=${period.until}`;
    const res = await fetch(url);
    const json = await res.json();
    if (res.ok) setObservations(json.data ?? []);
  }

  async function addObservation(content?: string, since?: string, until?: string, slideTag?: string) {
    const tagToUse = slideTag !== undefined ? slideTag : newObsTag;
    const body = {
      client_slug: client,
      since: (since ?? newObsSince),
      until: (until ?? newObsUntil) || null,
      content: (content ?? newObsContent).trim(),
      slide_tag: tagToUse || null,
    };
    if (!body.content || client === "all") return;
    setSavingObs(true);
    const res = await fetch("/api/admin/observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      if (!content) { setNewObsContent(""); setNewObsUntil(""); setNewObsTag(""); }
      fetchObservations();
    } else {
      const j = await res.json().catch(() => ({}));
      alert("Erro ao salvar observação: " + (j.error ?? "desconhecido"));
    }
    setSavingObs(false);
  }

  async function deleteObservation(id: string) {
    if (!confirm("Remover esta observação?")) return;
    const res = await fetch(`/api/admin/observations?id=${id}`, { method: "DELETE" });
    if (res.ok) fetchObservations();
  }

  async function fetchCampaignNames() {
    if (client === "all") { setCampaignNames([]); return; }
    const since = new Date(); since.setDate(since.getDate() - 90);
    const { data } = await supabase
      .from("ad_campaigns")
      .select("campaign_name")
      .eq("client_slug", client)
      .gte("date", since.toISOString().slice(0, 10));
    const names = Array.from(new Set((data ?? []).map((c: any) => c.campaign_name).filter(Boolean))).sort() as string[];
    setCampaignNames(names);
  }

  useEffect(() => { fetchActions(); fetchCampaignNames(); fetchObservations(); }, [client, reportType, customSince, customUntil]);

  async function addAction() {
    if (!newActionTitle.trim() || !newActionDesc.trim() || client === "all") return;
    setSavingAction(true);
    const res = await fetch("/api/admin/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_slug: client,
        action_date: newActionDate,
        platform: newActionPlatform === "geral" ? null : newActionPlatform,
        campaign_name: newActionCampaign.trim() || null,
        title: newActionTitle.trim(),
        description: newActionDesc.trim(),
        link: newActionLink.trim() || null,
      }),
    });
    if (res.ok) {
      setNewActionTitle(""); setNewActionDesc(""); setNewActionCampaign(""); setNewActionLink("");
      fetchActions();
    } else {
      const j = await res.json().catch(() => ({}));
      alert("Erro ao salvar ação: " + (j.error ?? "desconhecido"));
    }
    setSavingAction(false);
  }

  async function deleteAction(id: string) {
    if (!confirm("Remover esta ação?")) return;
    const res = await fetch(`/api/admin/actions?id=${id}`, { method: "DELETE" });
    if (res.ok) fetchActions();
  }

  async function generateReport() {
    setLoading(true);
    setError(null);
    setReport(null);
    setKpis(null);
    setPresentationData(null);

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
      setPresentationData(data1.presentation ?? null);

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

    const escapeHtml = (s: string) =>
      String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const autoLink = (s: string): string =>
      s.replace(/(https?:\/\/[^\s<>"')\]]+)/g, '<a href="$1" target="_blank">$1</a>');
    const fmt = (n: number) => Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtInt = (n: number) => Number(n ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    const pct = (n: number) => `${Number(n ?? 0).toFixed(2)}%`;
    const deltaPct = (cur: number, prev: number) => {
      if (!prev) return null;
      return ((cur - prev) / prev) * 100;
    };
    const deltaSpan = (cur: number, prev: number, opts?: { lowerIsBetter?: boolean }) => {
      const d = deltaPct(cur, prev);
      if (d == null) return "<span class='delta-na'>—</span>";
      const positive = opts?.lowerIsBetter ? d < 0 : d > 0;
      const cls = Math.abs(d) < 0.5 ? "delta-flat" : positive ? "delta-up" : "delta-down";
      const sign = d > 0 ? "+" : "";
      return `<span class='${cls}'>${sign}${d.toFixed(1)}%</span>`;
    };

    function mdToHtml(text: string): string {
      return text.split("\n").map(line => {
        if (!line.trim()) return "<div style='height:8px'></div>";
        if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
          if (line.includes("---")) return "";
          const cells = line.split("|").filter(c => c.trim());
          const isHeader = !line.includes("R$") && !line.includes("%") && cells.every(c => c.trim().length < 30);
          const tag = isHeader ? "th" : "td";
          return `<tr>${cells.map(c => `<${tag}>${autoLink(c.trim().replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"))}</${tag}>`).join("")}</tr>`;
        }
        const headerMatch = line.trim().match(/^(?:\*\*|\#{1,2}\s*)(\d+[\.\)]\s+.+?)(?:\*\*|$)/);
        if (headerMatch) return `</table><h2>${headerMatch[1]}</h2><table>`;
        const h3Match = line.trim().match(/^\#{3}\s+(.+)/);
        if (h3Match) return `</table><h3>${h3Match[1].replace(/\*\*/g, "")}</h3><table>`;
        const subMatch = line.trim().match(/^\*\*(.+?)\*\*$/);
        if (subMatch) return `</table><h3>${subMatch[1]}</h3><table>`;
        if (line.trim().startsWith(">")) {
          const content = autoLink(line.replace(/^>\s*/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"));
          return `</table><div class="callout">${content}</div><table>`;
        }
        if (/^[-*]\s+/.test(line)) return `</table><li>${autoLink(line.replace(/^[-*]\s+/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"))}</li><table>`;
        if (line.trim() === "---") return `</table><hr/><table>`;
        return `</table><p>${autoLink(line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"))}</p><table>`;
      }).join("\n").replace(/<table>\s*<\/table>/g, "").replace(/<table>\n<\/table>/g, "");
    }

    // ── Executive summary (capa) — gerado deterministicamente a partir do
    // presentationData. Não depende do texto do Claude pra que a 1ª página
    // SEMPRE entregue o panorama, mesmo se o Claude variar a redação.
    const p: any = presentationData ?? {};
    const cur = p.monthCurStats;
    const prev = p.monthPrevStats;
    const isMensal = reportType === "mensal" && cur && prev;

    const coverKpis = kpis ? `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-value accent">${fmtInt(kpis.leads)}</div>
          <div class="kpi-label">Leads no período</div>
          ${isMensal ? `<div class="kpi-delta">vs mês ant: ${deltaSpan(cur.leads, prev.leads)}</div>` : ""}
        </div>
        <div class="kpi">
          <div class="kpi-value blue">R$ ${fmtInt(kpis.spend)}</div>
          <div class="kpi-label">Investimento</div>
          ${isMensal ? `<div class="kpi-delta">vs mês ant: ${deltaSpan(cur.spend, prev.spend)}</div>` : ""}
        </div>
        <div class="kpi">
          <div class="kpi-value gold">${kpis.cpl > 0 ? `R$ ${fmt(kpis.cpl)}` : "—"}</div>
          <div class="kpi-label">CPL geral</div>
          ${isMensal ? `<div class="kpi-delta">vs mês ant: ${deltaSpan(cur.cpl, prev.cpl, { lowerIsBetter: true })}</div>` : ""}
        </div>
        <div class="kpi">
          <div class="kpi-value">${fmtInt(kpis.metaLeads)}<span class="kpi-split">/</span>${fmtInt(kpis.googleLeads)}</div>
          <div class="kpi-label">Meta · Google (leads)</div>
        </div>
      </div>` : "";

    // Top 3 campanhas por leads (mistura Meta + Google), com mini-stats
    const allCamps: any[] = [
      ...(p.metaCampaigns ?? []).map((c: any) => ({ ...c, platform: "meta" })),
      ...(p.googleCampaigns ?? []).map((c: any) => ({ ...c, platform: "google" })),
    ].sort((a, b) => (b.leads || 0) - (a.leads || 0));
    const topCampaigns = allCamps.slice(0, 3);

    const topCampaignsHtml = topCampaigns.length > 0 ? `
      <div class="cover-section">
        <div class="cover-section-title">Top Campanhas do Período</div>
        <div class="top-camp-grid">
          ${topCampaigns.map((c, i) => `
            <div class="top-camp-card">
              <div class="top-camp-rank">#${i + 1} · ${c.platform === "meta" ? "Meta" : "Google"}</div>
              <div class="top-camp-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
              <div class="top-camp-stats">
                <span class="stat-leads">${fmtInt(c.leads)} leads</span>
                <span class="stat-spend">R$ ${fmtInt(c.spend)}</span>
                <span class="stat-cpl">${c.cpl > 0 ? `CPL R$ ${fmt(c.cpl)}` : "CPL —"}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </div>` : "";

    // Mês corrente vs anterior (mini-tabela compacta na capa)
    const monthBlockHtml = isMensal ? `
      <div class="cover-section">
        <div class="cover-section-title">Mês Corrente vs Anterior</div>
        <table class="cover-table">
          <thead>
            <tr><th>Plataforma</th><th>Leads</th><th>Δ</th><th>Invest</th><th>Δ</th><th>CPL</th><th>Δ</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Total</strong></td>
              <td>${fmtInt(cur.leads)}</td><td>${deltaSpan(cur.leads, prev.leads)}</td>
              <td>R$ ${fmtInt(cur.spend)}</td><td>${deltaSpan(cur.spend, prev.spend)}</td>
              <td>${cur.cpl > 0 ? `R$ ${fmt(cur.cpl)}` : "—"}</td><td>${deltaSpan(cur.cpl, prev.cpl, { lowerIsBetter: true })}</td>
            </tr>
            <tr>
              <td>Meta</td>
              <td>${fmtInt(cur.metaLeads)}</td><td>${deltaSpan(cur.metaLeads, prev.metaLeads)}</td>
              <td>R$ ${fmtInt(cur.metaSpend)}</td><td>${deltaSpan(cur.metaSpend, prev.metaSpend)}</td>
              <td>${cur.metaCpl > 0 ? `R$ ${fmt(cur.metaCpl)}` : "—"}</td><td>${deltaSpan(cur.metaCpl, prev.metaCpl, { lowerIsBetter: true })}</td>
            </tr>
            <tr>
              <td>Google</td>
              <td>${fmtInt(cur.googleLeads)}</td><td>${deltaSpan(cur.googleLeads, prev.googleLeads)}</td>
              <td>R$ ${fmtInt(cur.googleSpend)}</td><td>${deltaSpan(cur.googleSpend, prev.googleSpend)}</td>
              <td>${cur.googleCpl > 0 ? `R$ ${fmt(cur.googleCpl)}` : "—"}</td><td>${deltaSpan(cur.googleCpl, prev.googleCpl, { lowerIsBetter: true })}</td>
            </tr>
          </tbody>
        </table>
        ${p.runRate ? `<div class="run-rate">Projeção (run-rate) — fechamento do mês: <strong>${fmtInt(p.runRate.leads)} leads</strong> · <strong>R$ ${fmtInt(p.runRate.spend)}</strong></div>` : ""}
      </div>` : "";

    // Pacing na capa (quando houver). pacing vem como { total?, meta?, google? }.
    const pacingEntries: Array<[string, any]> = p.pacing
      ? (["total", "meta", "google"] as const).filter(k => p.pacing[k]).map(k => [k, p.pacing[k]])
      : [];
    const pacingLabels: Record<string, string> = { total: "Total", meta: "Meta", google: "Google" };
    const pacingHtml = pacingEntries.length > 0 ? `
      <div class="cover-section">
        <div class="cover-section-title">Pacing do Orçamento</div>
        <table class="cover-table">
          <thead><tr><th>Plataforma</th><th>Gasto</th><th>Orçado</th><th>%</th><th>Status</th><th>Rec./dia</th></tr></thead>
          <tbody>
            ${pacingEntries.map(([key, row]) => {
              const pctReal = row.expectedSpendByEom > 0 ? (row.realSpend / row.expectedSpendByEom) * 100 : 0;
              return `
              <tr>
                <td>${pacingLabels[key] ?? key}</td>
                <td>R$ ${fmtInt(row.realSpend)}</td>
                <td>R$ ${fmtInt(row.expectedSpendByEom)}</td>
                <td>${pctReal.toFixed(0)}%</td>
                <td><span class="pacing-${row.status ?? "on_track"}">${escapeHtml(row.statusLabel ?? "")}</span></td>
                <td>R$ ${fmtInt(row.recommendedDailySpend)}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>` : "";

    // ── Anúncios Meta agrupados por campanha (substitui o "tudo misturado")
    const adsList: any[] = p.adsList ?? [];
    const adsByCampaign = new Map<string, any[]>();
    for (const a of adsList) {
      const k = a.campaign_name || "(sem campanha)";
      if (!adsByCampaign.has(k)) adsByCampaign.set(k, []);
      adsByCampaign.get(k)!.push(a);
    }
    const adsByCampaignHtml = adsList.length > 0 ? `
      <h2>Anúncios Meta no Período · agrupados por campanha</h2>
      ${Array.from(adsByCampaign.entries()).map(([campName, ads]) => {
        const distinctSets = new Set(ads.map(a => a.ad_set_name).filter(Boolean));
        const hasMultipleSets = distinctSets.size > 1;
        const sectionTitle = `<h3 class="camp-ads-title">${escapeHtml(campName)} <span class="camp-ads-count">${ads.length} anúncios</span></h3>`;
        // Campanhas grandes (muitos ads) não cabem numa página só — deixa quebrar.
        const largeClass = ads.length > 8 ? " large" : "";
        if (!hasMultipleSets) {
          return `<div class="campaign-ads-block${largeClass}">${sectionTitle}${renderAdsTable(ads)}</div>`;
        }
        const bySet = new Map<string, any[]>();
        for (const a of ads) {
          const sk = a.ad_set_name || "(sem conjunto)";
          if (!bySet.has(sk)) bySet.set(sk, []);
          bySet.get(sk)!.push(a);
        }
        // O h3 da campanha e o PRIMEIRO conjunto ficam juntos; conjuntos
        // seguintes têm seu próprio bloco atômico (título + tabela sempre juntos).
        const setBlocks = Array.from(bySet.entries()).map(([setName, setAds]) =>
          `<div class="ad-set-block"><div class="ad-set-label">Conjunto: ${escapeHtml(setName)}</div>${renderAdsTable(setAds)}</div>`
        );
        return `<div class="campaign-ads-block${largeClass}">${sectionTitle}${setBlocks.join("")}</div>`;
      }).join("")}
    ` : "";

    // Tabela compacta de anúncios — só referência histórica de "o que rodou":
    // Anúncio | Criado em | Status | Link. Sem invest/leads (esses já estão
    // nos cards da seção detalhada). Foco em prestação de contas.
    function renderAdsTable(ads: any[]): string {
      return `<table class="ads-table">
        <thead>
          <tr>
            <th style="width:55%">Anúncio</th>
            <th>Criado</th>
            <th>Status</th>
            <th style="width:36px">Link</th>
          </tr>
        </thead>
        <tbody>
          ${ads.map(a => {
            const st = String(a.status ?? "").toUpperCase();
            const stCls = st === "PAUSED" ? "status-paused" : "status-active";
            return `
              <tr>
                <td>
                  <div class="ad-name">${escapeHtml(a.ad_name)}</div>
                  ${a.note ? `<div class="ad-note">${escapeHtml(a.note)}</div>` : ""}
                </td>
                <td class="mono">${a.first_date ? new Date(a.first_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}</td>
                <td class="${stCls}">${escapeHtml(a.statusLabel ?? "")}</td>
                <td>${a.permalink ? `<a href="${a.permalink}" target="_blank" class="link-icon">↗</a>` : ""}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>`;
    }

    // ── Meta Ads — Resultados por Campanha (HTML determinístico) ────────────
    // Substitui a seção que o Claude gerava (era bullet-list feia, dif. de ler).
    // Renderiza cada campanha como um bloco visual com KPIs, semanal, conjuntos
    // e criativos em grid de cards (com thumbnail quando disponível).
    const metaCampaigns: any[] = p.metaCampaigns ?? [];
    const shortDate = (iso: string | null | undefined) => {
      if (!iso) return "—";
      const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    };
    const creativeStatus = (cr: any) => {
      const st = String(cr.status ?? "").toUpperCase();
      const isPaused = st === "PAUSED" || st === "DISABLED" || st === "ARCHIVED";
      if (isPaused) {
        const upd = cr.updated_at_meta ? shortDate(cr.updated_at_meta) : null;
        return { cls: "paused", label: upd ? `Pausado ${upd}` : "Pausado" };
      }
      return { cls: "active", label: "Ativo" };
    };

    const renderCreativeCard = (cr: any) => {
      const st = creativeStatus(cr);
      const thumb = cr.thumbnail
        ? `<div class="crv-thumb" style="background-image:url('${escapeHtml(cr.thumbnail)}')"></div>`
        : `<div class="crv-thumb crv-thumb-empty">${cr.name.charAt(0).toUpperCase()}</div>`;
      return `
        <div class="crv-card">
          ${thumb}
          <div class="crv-body">
            <div class="crv-header">
              <div class="crv-name" title="${escapeHtml(cr.name)}">${escapeHtml(cr.name)}</div>
              <span class="crv-status crv-status-${st.cls}">${st.label}</span>
            </div>
            <div class="crv-meta">
              <span>Criado ${shortDate(cr.created_at_meta)}</span>
              ${cr.permalink ? `<a href="${cr.permalink}" target="_blank" class="crv-link-btn">Ver anúncio ↗</a>` : ""}
            </div>
            <div class="crv-kpis">
              <div class="crv-kpi"><span class="crv-kpi-label">Invest</span><span class="crv-kpi-val blue">R$ ${fmtInt(cr.spend)}</span></div>
              <div class="crv-kpi"><span class="crv-kpi-label">Leads</span><span class="crv-kpi-val accent">${fmtInt(cr.leads)}</span></div>
              <div class="crv-kpi"><span class="crv-kpi-label">CPL</span><span class="crv-kpi-val gold">${cr.cpl > 0 ? `R$ ${fmt(cr.cpl)}` : "—"}</span></div>
              <div class="crv-kpi"><span class="crv-kpi-label">CTR</span><span class="crv-kpi-val">${pct(cr.ctr)}</span></div>
            </div>
            ${cr.note ? `<div class="crv-note">${escapeHtml(cr.note)}</div>` : ""}
            ${cr.ambiguousAttribution ? `<div class="crv-warn">⚠ Atribuição ambígua — nome duplicado no mesmo conjunto</div>` : ""}
          </div>
        </div>`;
    };

    const renderAdSetRow = (s: any) => `
      <tr>
        <td class="setname" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</td>
        <td class="mono blue">R$ ${fmtInt(s.spend)}</td>
        <td class="mono accent">${fmtInt(s.leads)}</td>
        <td class="mono gold">${s.cpl > 0 ? `R$ ${fmt(s.cpl)}` : "—"}</td>
        <td class="mono">${pct(s.ctr)}</td>
      </tr>`;

    const renderWeeklyRow = (w: any) => `
      <tr>
        <td>${escapeHtml(w.label)}</td>
        <td class="mono blue">R$ ${fmtInt(w.spend)}</td>
        <td class="mono accent">${fmtInt(w.leads)}</td>
        <td class="mono gold">${w.cpl > 0 ? `R$ ${fmt(w.cpl)}` : "—"}</td>
        <td class="mono">${pct(w.ctr)}</td>
      </tr>`;

    const renderCampaignBlock = (c: any) => {
      const isPaused = String(c.status ?? "").toUpperCase() === "PAUSED";
      const statusBadge = isPaused
        ? `<span class="camp-status paused">Pausada</span>`
        : `<span class="camp-status active">Ativa</span>`;
      const adSets: any[] = Array.isArray(c.adSets) ? c.adSets : [];
      const hasMultipleSets = adSets.length > 1;
      const weekly: any[] = Array.isArray(c.weekly) ? c.weekly : [];
      // Bloco grande (>5 criativos) permite quebra natural entre páginas
      const totalCreatives = (c.creatives ?? []).length + (hasMultipleSets ? adSets.reduce((s, a) => s + (a.creatives?.length ?? 0), 0) : 0);
      const largeClass = totalCreatives > 5 ? " large" : "";

      // Se há vários conjuntos, renderiza criativos AGRUPADOS por conjunto
      // (com sub-cabeçalho). Senão, grid único de todos os criativos da campanha.
      const creativesHtml = hasMultipleSets
        ? adSets.map(s => {
            const creativesInSet = (s.creatives ?? []) as any[];
            if (creativesInSet.length === 0) return "";
            return `
              <div class="crv-set-block">
                <div class="crv-set-header">
                  <span class="crv-set-label">Conjunto</span>
                  <span class="crv-set-name">${escapeHtml(s.name)}</span>
                  <span class="crv-set-stats">
                    <span class="blue">R$ ${fmtInt(s.spend)}</span> ·
                    <span class="accent">${fmtInt(s.leads)} leads</span> ·
                    <span class="gold">CPL ${s.cpl > 0 ? `R$ ${fmt(s.cpl)}` : "—"}</span>
                  </span>
                </div>
                <div class="crv-grid">${creativesInSet.map(renderCreativeCard).join("")}</div>
              </div>`;
          }).join("")
        : `<div class="crv-grid">${(c.creatives ?? []).map(renderCreativeCard).join("")}</div>`;

      return `
        <div class="camp-block${largeClass}">
          <div class="camp-header">
            <div class="camp-title">
              <h3 class="camp-name">${escapeHtml(c.name)}</h3>
              ${statusBadge}
            </div>
            <div class="camp-kpi-strip">
              <div class="camp-kpi"><span class="camp-kpi-label">Invest</span><span class="camp-kpi-val blue">R$ ${fmtInt(c.spend)}</span></div>
              <div class="camp-kpi"><span class="camp-kpi-label">Leads</span><span class="camp-kpi-val accent">${fmtInt(c.leads)}</span></div>
              <div class="camp-kpi"><span class="camp-kpi-label">CPL</span><span class="camp-kpi-val gold">${c.cpl > 0 ? `R$ ${fmt(c.cpl)}` : "—"}</span></div>
              <div class="camp-kpi"><span class="camp-kpi-label">CTR</span><span class="camp-kpi-val">${pct(c.ctr)}</span></div>
              <div class="camp-kpi"><span class="camp-kpi-label">Impressões</span><span class="camp-kpi-val">${fmtInt(c.impressions)}</span></div>
              <div class="camp-kpi"><span class="camp-kpi-label">Cliques</span><span class="camp-kpi-val">${fmtInt(c.clicks)}</span></div>
            </div>
          </div>

          <div class="camp-tables">
            ${weekly.length > 1 ? `
              <div class="camp-sub">
                <div class="camp-sub-title">Semana a Semana</div>
                <table class="camp-table">
                  <thead><tr><th>Semana</th><th>Invest</th><th>Leads</th><th>CPL</th><th>CTR</th></tr></thead>
                  <tbody>${weekly.map(renderWeeklyRow).join("")}</tbody>
                </table>
              </div>` : ""}
            ${hasMultipleSets ? `
              <div class="camp-sub">
                <div class="camp-sub-title">Conjuntos de Anúncios · ${adSets.length}</div>
                <table class="camp-table">
                  <thead><tr><th>Conjunto</th><th>Invest</th><th>Leads</th><th>CPL</th><th>CTR</th></tr></thead>
                  <tbody>${adSets.map(renderAdSetRow).join("")}</tbody>
                </table>
              </div>` : ""}
          </div>

          ${creativesHtml ? `
            <div class="camp-creatives">
              <div class="camp-sub-title">Criativos${hasMultipleSets ? "" : ` · ${(c.creatives ?? []).length}`}</div>
              ${creativesHtml}
            </div>` : ""}
        </div>`;
    };

    const metaCampaignsHtml = metaCampaigns.length > 0 ? `
      <div class="cards-section-title">Meta Ads · Detalhamento por Campanha</div>
      ${metaCampaigns.filter((c: any) => c.leads > 0 || c.spend > 50).map(renderCampaignBlock).join("")}
    ` : "";

    // ── Google Ads · cards similares ao Meta, mas sem criativos (não aplicável)
    // e com top keywords / top search terms lado a lado.
    const googleCampaigns: any[] = p.googleCampaigns ?? [];
    const renderKwList = (list: any[], label: string, key: "clicks" | "conversions") => {
      if (!list || list.length === 0) return "";
      return `
        <div class="camp-sub">
          <div class="camp-sub-title">${label}</div>
          <table class="camp-table">
            <thead><tr><th>${label.includes("Termos") ? "Termo" : "Keyword"}</th><th>${key === "clicks" ? "Cliques" : "Conv."}</th></tr></thead>
            <tbody>
              ${list.slice(0, 6).map((k: any) => `
                <tr>
                  <td class="setname" title="${escapeHtml(k.text ?? k.term ?? "")}">${escapeHtml(k.text ?? k.term ?? "")}</td>
                  <td class="mono ${key === "clicks" ? "blue" : "accent"}">${fmtInt(k[key])}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>`;
    };
    const renderGoogleCampaignBlock = (c: any) => {
      const isPaused = String(c.status ?? "").toUpperCase() === "PAUSED";
      const statusBadge = isPaused
        ? `<span class="camp-status paused">Pausada</span>`
        : `<span class="camp-status active">Ativa</span>`;
      const weekly: any[] = Array.isArray(c.weekly) ? c.weekly : [];
      const kws: any[] = c.topKeywords ?? [];
      const sts: any[] = c.topSearchTerms ?? [];
      // Google raramente cabe em uma página (semanal + 2 top lists)
      const totalRows = weekly.length + kws.length + sts.length;
      const largeClass = totalRows > 10 ? " large" : "";

      return `
        <div class="camp-block${largeClass}">
          <div class="camp-header">
            <div class="camp-title">
              <h3 class="camp-name">${escapeHtml(c.name)}</h3>
              ${statusBadge}
            </div>
            <div class="camp-kpi-strip">
              <div class="camp-kpi"><span class="camp-kpi-label">Invest</span><span class="camp-kpi-val blue">R$ ${fmtInt(c.spend)}</span></div>
              <div class="camp-kpi"><span class="camp-kpi-label">Leads</span><span class="camp-kpi-val accent">${fmtInt(c.leads)}</span></div>
              <div class="camp-kpi"><span class="camp-kpi-label">CPL</span><span class="camp-kpi-val gold">${c.cpl > 0 ? `R$ ${fmt(c.cpl)}` : "—"}</span></div>
              <div class="camp-kpi"><span class="camp-kpi-label">CTR</span><span class="camp-kpi-val">${pct(c.ctr)}</span></div>
              <div class="camp-kpi"><span class="camp-kpi-label">Impressões</span><span class="camp-kpi-val">${fmtInt(c.impressions)}</span></div>
              <div class="camp-kpi"><span class="camp-kpi-label">Cliques</span><span class="camp-kpi-val">${fmtInt(c.clicks)}</span></div>
            </div>
          </div>

          <div class="camp-tables">
            ${weekly.length > 1 ? `
              <div class="camp-sub">
                <div class="camp-sub-title">Semana a Semana</div>
                <table class="camp-table">
                  <thead><tr><th>Semana</th><th>Invest</th><th>Leads</th><th>CPL</th><th>CTR</th></tr></thead>
                  <tbody>${weekly.map(renderWeeklyRow).join("")}</tbody>
                </table>
              </div>` : ""}
            ${kws.length > 0 ? renderKwList(kws, "Top Keywords", "conversions") : ""}
            ${sts.length > 0 ? renderKwList(sts, "Top Termos de Pesquisa", "conversions") : ""}
          </div>
        </div>`;
    };
    const googleCampaignsHtml = googleCampaigns.length > 0 ? `
      <div class="cards-section-title">Google Ads · Detalhamento por Campanha</div>
      ${googleCampaigns.filter((c: any) => c.leads > 0 || c.spend > 50).map(renderGoogleCampaignBlock).join("")}
    ` : "";

    // Remove seções que agora são renderizadas em HTML determinístico
    // (evita duplicação com o texto que o Claude ainda pode gerar).
    let reportTrimmed = report.replace(
      /\*\*\d+\.\s*An[úu]ncios Meta do Per[íi]odo\*\*[\s\S]*?(?=\n\s*\*\*\d+\.\s|\Z)/i,
      ""
    );
    reportTrimmed = reportTrimmed.replace(
      /\*\*\d+\.\s*Meta Ads\s*[—-]\s*Resultados[\s\S]*?(?=\n\s*\*\*\d+\.\s|\Z)/i,
      ""
    );

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Relatório ${typeLabel} — ${clientName}</title>
  <style>
    @page { size: A4; margin: 12mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #e2e2e8; font-size: 11.5px; line-height: 1.5; padding: 16px 20px; background: #0e1018; max-width: 100%; }

    /* ── Cover page ───────────────────────────────────────────────── */
    .cover { min-height: calc(100vh - 36px); display: flex; flex-direction: column; gap: 18px; page-break-after: always; }
    .cover-header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 14px; border-bottom: 1px solid #24242c; }
    .cover-title { font-size: 28px; font-weight: 800; color: #f2f2f5; letter-spacing: -0.02em; }
    .cover-title-sub { font-size: 13px; color: #8888a0; margin-top: 4px; }
    .cover-meta { text-align: right; font-size: 11px; color: #8888a0; line-height: 1.7; }
    .cover-meta strong { color: #f2f2f5; }
    .badge { display: inline-block; background: #CAFF04; color: #0a0a0c; font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.06em; margin-left: 8px; vertical-align: middle; }

    /* 4 KPIs em 2x2 no portrait (fica mais legível que 4x1 apertadinho) */
    .kpi-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .kpi { background: #14161e; border: 1px solid #24242c; border-radius: 14px; padding: 18px 18px; }
    .kpi-value { font-size: 28px; font-weight: 800; font-family: 'DM Mono', monospace; letter-spacing: -0.01em; line-height: 1.1; }
    .kpi-value.accent { color: #CAFF04; } .kpi-value.blue { color: #60A5FA; } .kpi-value.gold { color: #F59E0B; }
    .kpi-value .kpi-split { color: #4a4a5a; padding: 0 4px; font-weight: 400; }
    .kpi-label { font-size: 10px; color: #6a6a7a; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.08em; }
    .kpi-delta { font-size: 10px; color: #8888a0; margin-top: 4px; }

    .delta-up { color: #CAFF04; font-weight: 700; }
    .delta-down { color: #F87171; font-weight: 700; }
    .delta-flat { color: #8888a0; font-weight: 600; }
    .delta-na { color: #4a4a5a; }

    .cover-section { background: #14161e; border: 1px solid #24242c; border-radius: 14px; padding: 16px 20px; }
    .cover-section-title { font-size: 11px; color: #8888a0; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 12px; }
    .cover-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .cover-table th { background: transparent; color: #6a6a7a; font-weight: 600; text-align: left; padding: 6px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #24242c; }
    .cover-table th:nth-child(n+2) { text-align: right; }
    .cover-table td { padding: 7px 10px; border-bottom: 1px solid #1a1a24; color: #d0d0dd; font-family: 'DM Mono', monospace; font-size: 11px; }
    .cover-table td:first-child { font-family: 'Inter', sans-serif; }
    .cover-table td:nth-child(n+2) { text-align: right; }
    .run-rate { margin-top: 10px; font-size: 11px; color: #8888a0; padding: 8px 12px; background: #0e1018; border-left: 3px solid #CAFF04; border-radius: 0 6px 6px 0; }
    .run-rate strong { color: #CAFF04; }

    .pacing-on_track { color: #CAFF04; font-weight: 700; }
    .pacing-slightly_over, .pacing-slightly_under { color: #F59E0B; font-weight: 700; }
    .pacing-over, .pacing-under { color: #F87171; font-weight: 700; }

    /* Top 3 campanhas: em portrait empilham */
    .top-camp-grid { display: flex; flex-direction: column; gap: 8px; }
    /* Card horizontal (rank | nome | stats), mais denso pra portrait */
    .top-camp-card { background: #0e1018; border: 1px solid #24242c; border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; gap: 12px; }
    .top-camp-rank { font-size: 9px; color: #6a6a7a; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
    .top-camp-name { font-size: 12px; color: #f2f2f5; font-weight: 700; word-break: break-all; line-height: 1.3; flex: 1; min-width: 0; }
    .top-camp-stats { display: flex; gap: 10px; font-size: 11px; flex-shrink: 0; }
    .stat-leads { color: #CAFF04; font-weight: 700; font-family: 'DM Mono', monospace; }
    .stat-spend { color: #60A5FA; font-family: 'DM Mono', monospace; }
    .stat-cpl { color: #F59E0B; font-family: 'DM Mono', monospace; }

    /* ── Body (markdown do Claude + seções renderizadas) ──────────── */
    .body-content { max-width: 100%; }
    h2 { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #CAFF04; border-left: 4px solid #CAFF04; padding-left: 14px; margin: 28px 0 14px; page-break-before: auto; page-break-after: avoid; }
    h3 { font-size: 12px; font-weight: 700; color: #f2f2f5; margin: 18px 0 8px; padding: 7px 12px; background: #14161e; border: 1px solid #24242c; border-radius: 8px; page-break-after: avoid; }
    p { margin: 4px 0; color: #b0b0c0; }
    li { margin: 3px 0 3px 20px; color: #b0b0c0; }
    strong { font-weight: 700; color: #f2f2f5; }
    hr { border: none; border-top: 1px solid #24242c; margin: 18px 0; }
    a { color: #60A5FA; }

    /* Tables: sem page-break-inside no elemento inteiro (permitindo tabelas grandes quebrarem).
       As linhas (tr) individuais têm break-inside: avoid via @media print. */
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px; }
    th { background: #14161e; color: #8888a0; font-weight: 600; text-align: left; padding: 7px 10px; border-bottom: 2px solid #24242c; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 7px 10px; border-bottom: 1px solid #1a1a24; color: #d0d0dd; font-size: 11px; }

    .callout { background: #14161e; border-left: 3px solid #CAFF04; border-radius: 0 8px 8px 0; padding: 10px 14px; margin: 12px 0; font-size: 11px; color: #c0c0d0; }

    /* ── Section title (Meta/Google detalhamento) ────────────────────── */
    .cards-section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #CAFF04; border-left: 4px solid #CAFF04; padding-left: 14px; margin: 28px 0 14px; page-break-after: avoid; }

    /* ── Campanhas (blocos executivos) — usado por Meta e Google ─────── */
    /* Bloco de campanha: tenta ficar inteiro, mas permite quebra quando é grande. */
    .camp-block { background: #14161e; border: 1px solid #24242c; border-radius: 14px; padding: 14px 16px; margin: 12px 0 16px; }
    .camp-header { border-bottom: 1px solid #24242c; padding-bottom: 12px; margin-bottom: 12px; }
    .camp-title { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .camp-name { font-size: 15px; font-weight: 800; color: #f2f2f5; margin: 0; padding: 0; background: transparent; border: none; letter-spacing: -0.01em; }
    .camp-status { display: inline-block; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.06em; }
    .camp-status.active { background: rgba(202,255,4,0.12); color: #CAFF04; border: 1px solid rgba(202,255,4,0.25); }
    .camp-status.paused { background: rgba(245,158,11,0.12); color: #F59E0B; border: 1px solid rgba(245,158,11,0.25); }
    /* 6 KPIs em 2 linhas de 3 (portrait tem menos largura) */
    .camp-kpi-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .camp-kpi { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; background: #0e1018; border-radius: 8px; border: 1px solid #1a1a24; }
    .camp-kpi-label { font-size: 9px; color: #6a6a7a; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
    .camp-kpi-val { font-size: 15px; font-weight: 800; font-family: 'DM Mono', monospace; line-height: 1.1; letter-spacing: -0.01em; }
    .camp-kpi-val.accent { color: #CAFF04; } .camp-kpi-val.blue { color: #60A5FA; } .camp-kpi-val.gold { color: #F59E0B; }
    .camp-kpi-val:not(.accent):not(.blue):not(.gold) { color: #d0d0dd; }

    /* Em portrait, tabelas empilham (senão ficam apertadas demais) */
    .camp-tables { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
    .camp-sub { background: #0e1018; border: 1px solid #1a1a24; border-radius: 10px; padding: 10px 12px; break-inside: avoid; page-break-inside: avoid; }
    .camp-sub-title { font-size: 10px; color: #8888a0; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 8px; }
    .camp-table { width: 100%; border-collapse: collapse; margin: 0; font-size: 10.5px; }
    .camp-table th { background: transparent; border-bottom: 1px solid #24242c; padding: 6px 8px; font-size: 9px; color: #6a6a7a; text-align: left; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
    .camp-table th:nth-child(n+2) { text-align: right; }
    .camp-table td { padding: 6px 8px; border-bottom: 1px solid #1a1a24; font-size: 10.5px; color: #d0d0dd; }
    .camp-table td:nth-child(n+2) { text-align: right; font-family: 'DM Mono', monospace; }
    .camp-table td.setname { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'DM Mono', monospace; font-size: 10px; color: #b0b0c0; }
    .camp-table .blue { color: #60A5FA; } .camp-table .accent { color: #CAFF04; font-weight: 700; } .camp-table .gold { color: #F59E0B; } .camp-table .mono { font-family: 'DM Mono', monospace; }

    .camp-creatives { margin-top: 4px; }
    .crv-set-block { margin: 10px 0 14px; }
    .crv-set-header { display: flex; align-items: baseline; gap: 10px; padding: 6px 12px; background: rgba(96,165,250,0.05); border-left: 3px solid #60A5FA; border-radius: 0 8px 8px 0; margin-bottom: 8px; page-break-after: avoid; }
    .crv-set-label { font-size: 8px; color: #6a6a7a; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; }
    .crv-set-name { font-family: 'DM Mono', monospace; font-size: 11px; color: #f2f2f5; font-weight: 700; }
    .crv-set-stats { margin-left: auto; font-size: 10px; font-family: 'DM Mono', monospace; }
    .crv-set-stats .blue { color: #60A5FA; } .crv-set-stats .accent { color: #CAFF04; } .crv-set-stats .gold { color: #F59E0B; }

    /* Em portrait, 2 colunas ainda cabem — mas com padding menor pra thumbs */
    .crv-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .crv-card { display: flex; gap: 10px; padding: 10px; background: #0e1018; border: 1px solid #1a1a24; border-radius: 10px; break-inside: avoid; page-break-inside: avoid; }
    .crv-thumb { width: 68px; height: 68px; flex-shrink: 0; border-radius: 8px; background: #1a1a24; background-size: cover; background-position: center; border: 1px solid #24242c; }
    .crv-thumb-empty { display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #4a4a5a; font-family: 'DM Mono', monospace; }
    .crv-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
    .crv-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .crv-name { font-family: 'DM Mono', monospace; font-size: 11px; color: #f2f2f5; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .crv-status { flex-shrink: 0; font-size: 8px; font-weight: 800; padding: 2px 6px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
    .crv-status-active { background: rgba(202,255,4,0.1); color: #CAFF04; border: 1px solid rgba(202,255,4,0.25); }
    .crv-status-paused { background: rgba(245,158,11,0.1); color: #F59E0B; border: 1px solid rgba(245,158,11,0.25); }
    .crv-meta { font-size: 9.5px; color: #6a6a7a; display: flex; align-items: center; gap: 8px; }
    .crv-link { color: #60A5FA; text-decoration: none; }
    .crv-link-btn { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; background: rgba(96,165,250,0.12); border: 1px solid rgba(96,165,250,0.35); border-radius: 6px; color: #60A5FA; text-decoration: none; font-size: 9.5px; font-weight: 700; white-space: nowrap; }
    .crv-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 2px; }
    .crv-kpi { display: flex; flex-direction: column; }
    .crv-kpi-label { font-size: 8px; color: #6a6a7a; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
    .crv-kpi-val { font-size: 10.5px; font-family: 'DM Mono', monospace; font-weight: 700; }
    .crv-kpi-val.accent { color: #CAFF04; } .crv-kpi-val.blue { color: #60A5FA; } .crv-kpi-val.gold { color: #F59E0B; }
    .crv-kpi-val:not(.accent):not(.blue):not(.gold) { color: #d0d0dd; }
    .crv-note { font-size: 9.5px; color: #8888a0; font-style: italic; padding: 4px 8px; background: #14161e; border-radius: 6px; margin-top: 2px; }
    .crv-warn { font-size: 9.5px; color: #F59E0B; margin-top: 2px; }

    /* ── Anúncios agrupados ───────────────────────────────────────── */
    .camp-ads-title { display: flex; justify-content: space-between; align-items: center; }
    .camp-ads-count { font-size: 10px; color: #8888a0; font-weight: 500; }
    .ad-set-block { margin: 8px 0 14px 12px; padding-left: 12px; border-left: 2px solid #24242c; }
    .ad-set-label { font-size: 10px; color: #8888a0; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; margin: 8px 0 4px; }
    .ads-table .ad-name { font-family: 'DM Mono', monospace; font-size: 11px; color: #f2f2f5; }
    .ads-table .ad-note { font-size: 10px; color: #8888a0; margin-top: 2px; font-style: italic; }
    .ads-table .mono { font-family: 'DM Mono', monospace; }
    .ads-table .num { text-align: right; }
    .ads-table .blue { color: #60A5FA; }
    .ads-table .accent { color: #CAFF04; font-weight: 700; }
    .ads-table .status-active { color: #CAFF04; font-size: 10px; }
    .ads-table .status-paused { color: #F59E0B; font-size: 10px; }
    .link-icon { color: #60A5FA; text-decoration: none; font-size: 13px; }

    .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #24242c; font-size: 9px; color: #4a4a5a; display: flex; justify-content: space-between; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

      /* Órfãos/viúvas: mínimo de 3 linhas antes/depois do break */
      p, li, td { orphans: 3; widows: 3; }

      /* Títulos nunca ficam sozinhos no fim da página */
      h2, h3 { break-after: avoid; page-break-after: avoid; }
      h3 { break-before: avoid-page; }
      .cards-section-title { break-after: avoid; page-break-after: avoid; }

      /* Linhas de tabela não podem quebrar no meio; cabeçalho repete em cada página */
      tr, thead, tbody { break-inside: avoid; page-break-inside: avoid; }
      thead { display: table-header-group; }

      /* Blocos atômicos (executive summary + cards) */
      .kpi-row       { break-inside: avoid; page-break-inside: avoid; }
      .cover-section { break-inside: avoid; page-break-inside: avoid; }
      .top-camp-card { break-inside: avoid; page-break-inside: avoid; }
      .ad-set-block  { break-inside: avoid; page-break-inside: avoid; }
      .callout       { break-inside: avoid; page-break-inside: avoid; }

      /* Campanha inteira prefere ficar junta */
      .camp-block { break-inside: avoid; page-break-inside: avoid; }
      /* Se a campanha é grande demais (marca .large aplicada pelo JS quando
         soma criativos > threshold), deixa quebrar naturalmente */
      .camp-block.large { break-inside: auto; page-break-inside: auto; }

      /* Header (título + strip KPIs) sempre gruda com o próximo conteúdo */
      .camp-header    { break-after: avoid; page-break-after: avoid; break-inside: avoid; page-break-inside: avoid; }
      .camp-kpi-strip { break-inside: avoid; page-break-inside: avoid; }
      .camp-tables    { break-inside: avoid; page-break-inside: avoid; }
      .camp-sub       { break-inside: avoid; page-break-inside: avoid; }

      /* Cards de criativos: cada card fica inteiro */
      .crv-card       { break-inside: avoid; page-break-inside: avoid; }
      .crv-set-block  { break-inside: avoid-page; }
      .crv-set-header { break-after: avoid; page-break-after: avoid; break-inside: avoid; page-break-inside: avoid; }
      .camp-creatives { break-before: avoid; page-break-before: avoid; }

      /* Wrapper velho da lista compacta */
      .campaign-ads-block { break-inside: avoid; page-break-inside: avoid; }
      .campaign-ads-block.large { break-inside: auto; page-break-inside: auto; }
    }
  </style>
</head>
<body>
  <!-- ───── Capa: Executive Summary ───── -->
  <section class="cover">
    <div class="cover-header">
      <div>
        <div class="cover-title">Relatório de Performance<span class="badge">${typeLabel}</span></div>
        <div class="cover-title-sub">${escapeHtml(clientName)}</div>
      </div>
      <div class="cover-meta">
        Período: <strong>${periodLabel}</strong><br/>
        Gerado: ${new Date().toLocaleString("pt-BR")}
      </div>
    </div>

    ${coverKpis}
    ${topCampaignsHtml}
    ${monthBlockHtml}
    ${pacingHtml}
  </section>

  <!-- ───── Conteúdo detalhado ─────
       - Texto do Claude (comparativo semanal, mês, pacing, ações, obs, destaques)
       - Cards de Meta e Google são injetados via marcadores [[META_CARDS_HERE]]
         e [[GOOGLE_CARDS_HERE]] que o Claude imprime no fim das tabelas resumo
         — assim mantêm a ordem natural da numeração das seções.
       - Lista compacta de anúncios Meta (só nome/data/status) no fim como
         referência de "o que rodou no período".
  -->
  <div class="body-content">
    <table></table>
    ${mdToHtml(reportTrimmed)
      .replace(/<p>\[\[META_CARDS_HERE\]\]<\/p>/i, metaCampaignsHtml || "")
      .replace(/<p>\[\[GOOGLE_CARDS_HERE\]\]<\/p>/i, googleCampaignsHtml || "")
      .replace(/\[\[META_CARDS_HERE\]\]/i, metaCampaignsHtml || "")
      .replace(/\[\[GOOGLE_CARDS_HERE\]\]/i, googleCampaignsHtml || "")}
    ${adsByCampaignHtml}
  </div>

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
              {presentationData && (
                <button onClick={() => setShowPresentation(true)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-accent/30 bg-accent/10 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors"
                  title="Abrir em modo apresentação (paisagem, fullscreen)">
                  <PresentationIcon size={14} /> Apresentar
                </button>
              )}
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

        {/* Ações realizadas pelo gestor — persiste e injeta no relatório */}
        {client !== "all" && (
          <div className="mb-6 bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setObservationsExpanded(v => !v)}
              className="w-full flex items-center gap-2 px-5 py-3 hover:bg-bg/50 transition-colors text-left"
            >
              {observationsExpanded ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
              <NotebookPen size={14} className="text-blue" />
              <span className="text-sm font-semibold text-text-primary">Observações do gestor</span>
              <span className="text-xs text-text-muted ml-2">
                {observations.length === 0 ? "nenhuma vigente" : `${observations.length} vigente${observations.length > 1 ? "s" : ""}`}
              </span>
              <span className="text-[10px] text-text-dark ml-auto">
                texto livre · entram no relatório quando o período se sobrepõe
              </span>
            </button>

            {observationsExpanded && (
              <div className="border-t border-border p-5 space-y-4">
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-text-muted block mb-1">Vigência início</label>
                      <input
                        type="date"
                        value={newObsSince}
                        onChange={e => setNewObsSince(e.target.value)}
                        className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted block mb-1">Vigência fim (opcional — vazio = sem fim)</label>
                      <input
                        type="date"
                        value={newObsUntil}
                        onChange={e => setNewObsUntil(e.target.value)}
                        className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
                      />
                    </div>
                  </div>
                  <textarea
                    value={newObsContent}
                    onChange={e => setNewObsContent(e.target.value)}
                    placeholder={"Ex: Esgotamos o orçamento Meta dia 14/05. Redistribuí o restante do orçamento total entre Meta e Google pelos dias restantes do mês."}
                    rows={3}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40 resize-y"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-text-muted block mb-1">Aparece em qual slide da apresentação?</label>
                      <select
                        value={newObsTag}
                        onChange={e => setNewObsTag(e.target.value)}
                        className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
                      >
                        {SLIDE_TAGS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <button
                      onClick={() => addObservation()}
                      disabled={savingObs || !newObsContent.trim()}
                      className="self-end flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={12} />
                      {savingObs ? "Salvando..." : "Adicionar observação"}
                    </button>
                  </div>
                </div>

                {observations.length > 0 && (
                  <div className="border-t border-border pt-3 space-y-2">
                    {observations.map(o => {
                      const tagLabel = SLIDE_TAGS.find(t => t.value === (o.slide_tag ?? ""))?.label.split(" ")[0] ?? "Geral";
                      return (
                      <div key={o.id} className="flex items-start gap-2 py-1.5">
                        <span className="text-[10px] font-mono text-text-muted flex-shrink-0 mt-0.5 w-28 break-all">
                          {o.until ? `${o.since.slice(5).replace("-", "/")} a ${o.until.slice(5).replace("-", "/")}` : `desde ${o.since.slice(5).replace("-", "/")}`}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md border text-blue border-blue/30 bg-blue/10 flex-shrink-0 mt-0.5">{tagLabel}</span>
                        <div className="flex-1 text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{o.content}</div>
                        <button
                          onClick={() => deleteObservation(o.id)}
                          className="text-text-muted hover:text-red transition-colors flex-shrink-0 mt-1"
                          title="Remover"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {client !== "all" && (
          <div className="mb-6 bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setActionsExpanded(v => !v)}
              className="w-full flex items-center gap-2 px-5 py-3 hover:bg-bg/50 transition-colors text-left"
            >
              {actionsExpanded ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
              <ListChecks size={14} className="text-accent" />
              <span className="text-sm font-semibold text-text-primary">Ações realizadas no período</span>
              <span className="text-xs text-text-muted ml-2">
                {actions.length === 0 ? "nenhuma cadastrada" : `${actions.length} ação${actions.length > 1 ? "ões" : ""}`}
              </span>
              <span className="text-[10px] text-text-dark ml-auto">
                {period.since} a {period.until} · entram automaticamente no relatório
              </span>
            </button>

            {actionsExpanded && (
              <div className="border-t border-border p-5 space-y-4">
                {/* Form */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      type="date"
                      value={newActionDate}
                      onChange={e => setNewActionDate(e.target.value)}
                      className="bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
                    />
                    <select
                      value={newActionPlatform}
                      onChange={e => setNewActionPlatform(e.target.value as any)}
                      className="bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
                    >
                      <option value="meta">Meta</option>
                      <option value="google">Google</option>
                      <option value="geral">Geral</option>
                    </select>
                    <input
                      type="text"
                      list="rep-action-camp-list"
                      value={newActionCampaign}
                      onChange={e => setNewActionCampaign(e.target.value)}
                      placeholder="Campanha (opcional)"
                      className="bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-accent/40"
                    />
                    <datalist id="rep-action-camp-list">
                      {campaignNames.map(n => <option key={n} value={n} />)}
                    </datalist>
                  </div>
                  <input
                    type="text"
                    value={newActionTitle}
                    onChange={e => setNewActionTitle(e.target.value)}
                    placeholder="Título (ex: Reforço criativo)"
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
                  />
                  <textarea
                    value={newActionDesc}
                    onChange={e => setNewActionDesc(e.target.value)}
                    placeholder="Descrição (ex: 3 criativos novos — 2 vídeos + 1 estático)"
                    rows={2}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40 resize-y"
                  />
                  <input
                    type="url"
                    value={newActionLink}
                    onChange={e => setNewActionLink(e.target.value)}
                    placeholder="Link (opcional — URL do anúncio/criativo/recurso)"
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-dark focus:outline-none focus:border-accent/40"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={addAction}
                      disabled={savingAction || !newActionTitle.trim() || !newActionDesc.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={12} />
                      {savingAction ? "Salvando..." : "Adicionar ação"}
                    </button>
                  </div>
                </div>

                {/* Lista */}
                {actions.length > 0 && (
                  <div className="border-t border-border pt-3 space-y-1.5">
                    {actions.map(a => {
                      const platLabel = a.platform === "meta" ? "Meta" : a.platform === "google" ? "Google" : "Geral";
                      const platColor = a.platform === "meta" ? "text-blue border-blue/30 bg-blue/10" : a.platform === "google" ? "text-gold border-gold/30 bg-gold/10" : "text-text-muted border-border bg-bg";
                      return (
                        <div key={a.id} className="flex items-start gap-2 py-1.5">
                          <span className="text-[10px] font-mono text-text-muted flex-shrink-0 mt-0.5 w-16">{a.action_date.slice(5).replace("-", "/")}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border flex-shrink-0 ${platColor}`}>{platLabel}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-text-primary">
                              <span className="font-semibold">{a.title}</span>
                              {a.campaign_name && <span className="text-text-muted font-mono ml-2">· {a.campaign_name}</span>}
                            </div>
                            <div className="text-xs text-text-secondary leading-relaxed">{a.description}</div>
                            {a.link && (
                              <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue hover:underline break-all">
                                {a.link}
                              </a>
                            )}
                          </div>
                          <button
                            onClick={() => deleteAction(a.id)}
                            className="text-text-muted hover:text-red transition-colors flex-shrink-0 mt-1"
                            title="Remover"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={async () => {
                          if (!followUpInput.trim() || client === "all") return;
                          await addObservation(followUpInput.trim(), period.since, period.until);
                          setFollowUpInput("");
                        }}
                        disabled={savingObs || !followUpInput.trim() || client === "all"}
                        title="Salvar este texto como observação permanente. Próximas gerações de relatório que cubram este período vão trazer essa observação automaticamente."
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue/10 border border-blue/30 text-blue text-sm font-medium hover:bg-blue/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <BookmarkPlus size={13} /> Salvar como observação
                      </button>
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

      {/* Modo apresentação (overlay fullscreen) */}
      {showPresentation && presentationData && (
        <Presentation
          data={presentationData}
          kpis={kpis}
          destaquesText={report}
          onClose={() => setShowPresentation(false)}
        />
      )}
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
