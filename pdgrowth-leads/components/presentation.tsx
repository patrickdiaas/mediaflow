"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, Maximize2, ExternalLink } from "lucide-react";

interface PresentationData {
  client: string;
  clientLogoUrl?: string | null;
  clientDisplayName?: string | null;
  reportType: string;
  periodFrom: string;
  periodTo: string;
  monthCur: { since: string; until: string; daysInMonth: number; daysElapsed: number };
  monthPrev: { since: string; until: string };
  monthCurStats: any;
  monthPrevStats: any;
  runRate: { leads: number; spend: number };
  pacing: Record<string, any> | null;
  weeks: { since: string; until: string; label: string }[];
  weekStats: any[];
  metaCampaigns: any[];
  googleCampaigns: any[];
  adsList: any[];
  reportActions: any[];
  reportObservations: any[];
  unmatchedLeads: any[];
  googleTopKeywords?: any[];
  googleTopSearchTerms?: any[];
}

interface Props {
  data: PresentationData;
  kpis: any;
  destaquesText: string | null; // texto da Claude (seção destaques)
  onClose: () => void;
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${(n ?? 0).toFixed(1)}%`;
const brDateShort = (s: string) => { const d = new Date(s + "T12:00:00"); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; };
const brDateFull = (s: string) => { const d = new Date(s + "T12:00:00"); return d.toLocaleDateString("pt-BR"); };

function statusLabelCamp(s: string) {
  const x = String(s ?? "").toUpperCase();
  if (x === "PAUSED" || x === "DISABLED" || x === "ARCHIVED") return "Pausado";
  if (x === "ACTIVE" || x === "ENABLED" || x === "") return "Ativo";
  return x;
}

function deltaPct(curr: number, prev: number): string {
  if (!prev) return curr > 0 ? "+∞" : "—";
  const d = ((curr - prev) / prev) * 100;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(1)}%`;
}

function deltaColor(curr: number, prev: number, inverted = false): string {
  if (!prev) return "text-text-secondary";
  const d = curr - prev;
  const better = inverted ? d < 0 : d > 0;
  if (Math.abs((d / prev) * 100) < 2) return "text-text-secondary";
  return better ? "text-accent" : "text-red";
}

// Filtra observações por tag (e separa as gerais)
function obsByTag(observations: any[], tag: string): any[] {
  return observations.filter(o => o.slide_tag === tag);
}
function obsGeneral(observations: any[]): any[] {
  return observations.filter(o => !o.slide_tag || o.slide_tag === "general");
}

export default function Presentation({ data, kpis, destaquesText, onClose }: Props) {
  const slides = useMemo(() => buildSlides(data, kpis, destaquesText), [data, kpis, destaquesText]);
  const [idx, setIdx] = useState(0);

  const go = useCallback((delta: number) => {
    setIdx(i => Math.max(0, Math.min(slides.length - 1, i + delta)));
  }, [slides.length]);

  const enterFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
      else if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else onClose();
      }
      else if (e.key === "f" || e.key === "F") enterFullscreen();
      else if (e.key === "Home") setIdx(0);
      else if (e.key === "End") setIdx(slides.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, enterFullscreen, slides.length]);

  const current = slides[idx];

  return (
    <div className="fixed inset-0 z-50 bg-bg text-text-primary flex flex-col">
      {/* Header com controles */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="font-mono">{idx + 1} / {slides.length}</span>
          <span className="text-text-dark">·</span>
          {data.clientLogoUrl ? (
            <img src={data.clientLogoUrl} alt="" className="h-5 w-auto opacity-80" />
          ) : (
            <span className="text-text-secondary">{data.clientDisplayName || data.client}</span>
          )}
          <span className="text-text-dark">·</span>
          <span>{brDateFull(data.periodFrom)} a {brDateFull(data.periodTo)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-dark hidden md:block">←→ navegar · F fullscreen · ESC sair</span>
          <button onClick={enterFullscreen} className="p-2 rounded-lg hover:bg-border text-text-secondary hover:text-text-primary transition-colors" title="Fullscreen (F)">
            <Maximize2 size={14} />
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-border text-text-secondary hover:text-text-primary transition-colors" title="Sair (ESC)">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Slide */}
      <div className="flex-1 overflow-hidden flex items-center justify-center px-12 py-8 relative">
        <button
          onClick={() => go(-1)} disabled={idx === 0}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-card border border-border hover:bg-border disabled:opacity-30 transition"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => go(1)} disabled={idx === slides.length - 1}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-card border border-border hover:bg-border disabled:opacity-30 transition"
        >
          <ChevronRight size={20} />
        </button>

        <div className="w-full h-full max-w-7xl mx-auto flex flex-col">
          {current}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-border">
        <div className="h-full bg-accent transition-all" style={{ width: `${((idx + 1) / slides.length) * 100}%` }} />
      </div>
    </div>
  );
}

// ─── Construtor de slides ────────────────────────────────────────────────────
function buildSlides(d: PresentationData, kpis: any, _reportText: string | null): React.ReactNode[] {
  const slides: React.ReactNode[] = [];

  // 1. Capa
  slides.push(<CoverSlide key="cover" d={d} />);

  // 2. Overview
  slides.push(<OverviewSlide key="overview" d={d} kpis={kpis} />);

  // 3. Pacing
  if (d.pacing) slides.push(<PacingSlide key="pacing" d={d} observations={obsByTag(d.reportObservations, "pacing")} />);

  // 4. Comparativo Semanal
  if (d.weekStats.length > 1) slides.push(<WeeklySlide key="weekly" d={d} observations={obsByTag(d.reportObservations, "weekly")} />);

  // 5. Mês corrente vs anterior
  slides.push(<MonthlySlide key="monthly" d={d} observations={obsByTag(d.reportObservations, "monthly")} />);

  // 6. Resumo Meta + detalhes
  if (d.metaCampaigns.length > 0) {
    slides.push(<MetaSummarySlide key="meta-summary" d={d} observations={obsByTag(d.reportObservations, "meta")} />);
    d.metaCampaigns.filter(c => c.leads > 0 || c.spend > 50).forEach((c, i) => {
      slides.push(<CampaignDetailSlide key={`meta-${i}`} c={c} platform="meta" weeks={d.weeks} />);
    });
  }

  // 7. Resumo Google + detalhes
  if (d.googleCampaigns.length > 0) {
    slides.push(<GoogleSummarySlide key="google-summary" d={d} observations={obsByTag(d.reportObservations, "google")} />);
    d.googleCampaigns.filter(c => c.leads > 0 || c.spend > 50).forEach((c, i) => {
      slides.push(<CampaignDetailSlide key={`google-${i}`} c={c} platform="google" weeks={d.weeks} />);
    });

    // 7b. Top palavras-chave + Top termos de pesquisa (agregado Google Ads)
    const hasKw = (d.googleTopKeywords?.length ?? 0) > 0;
    const hasSt = (d.googleTopSearchTerms?.length ?? 0) > 0;
    if (hasKw || hasSt) slides.push(<GoogleKeywordsSlide key="google-kw" d={d} />);
  }

  // 8. Anúncios Meta do período
  if (d.adsList.length > 0) slides.push(<AdsListSlide key="ads" d={d} />);

  // 9. Ações
  if (d.reportActions.length > 0) slides.push(<ActionsSlide key="actions" d={d} />);

  // 10. Observações gerais (sem tag específica)
  const generalObs = obsGeneral(d.reportObservations);
  if (generalObs.length > 0) slides.push(<ObservationsSlide key="obs" observations={generalObs} />);

  // 11. Fim
  slides.push(<EndSlide key="end" d={d} />);

  return slides;
}

// ─── Slides individuais ──────────────────────────────────────────────────────
function CoverSlide({ d }: { d: PresentationData }) {
  const displayName = d.clientDisplayName || d.client;
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      {d.clientLogoUrl && (
        <img src={d.clientLogoUrl} alt={displayName} className="w-80 h-auto mb-10 opacity-95" />
      )}
      <div className="text-[10px] uppercase tracking-[0.3em] text-accent font-semibold mb-4">Relatório {d.reportType}</div>
      {!d.clientLogoUrl && <div className="text-6xl font-bold text-text-primary tracking-tight mb-3">{displayName}</div>}
      <div className="text-2xl text-text-secondary mb-12">{brDateFull(d.periodFrom)} a {brDateFull(d.periodTo)}</div>
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span className="font-display font-bold text-accent text-base">PD</span>
        <span>Growth</span>
      </div>
    </div>
  );
}

function OverviewSlide({ d, kpis }: { d: PresentationData; kpis: any }) {
  const prev = d.monthPrevStats;
  const cur = d.monthCurStats;
  const items = [
    { label: "Leads", value: fmt(kpis.leads), sub: `Meta ${kpis.metaLeads} · Google ${kpis.googleLeads}`, delta: deltaPct(cur.leads, prev.leads), deltaColor: deltaColor(cur.leads, prev.leads), color: "text-accent" },
    { label: "Investimento", value: `R$ ${fmt(kpis.spend)}`, sub: `Meta R$${fmt(kpis.metaSpend)} · Google R$${fmt(kpis.googleSpend)}`, delta: deltaPct(cur.spend, prev.spend), deltaColor: deltaColor(cur.spend, prev.spend, true), color: "text-blue" },
    { label: "CPL", value: kpis.cpl > 0 ? `R$ ${fmt(kpis.cpl)}` : "—", sub: `Meta ${kpis.metaCpl > 0 ? `R$${fmt(kpis.metaCpl)}` : "—"} · Google ${kpis.googleCpl > 0 ? `R$${fmt(kpis.googleCpl)}` : "—"}`, delta: deltaPct(cur.cpl, prev.cpl), deltaColor: deltaColor(cur.cpl, prev.cpl, true), color: "text-gold" },
    { label: "CTR", value: fmtPct(kpis.ctr), sub: `${fmt(kpis.clicks)} cliques · ${fmt(kpis.impressions)} impressões`, delta: deltaPct(cur.ctr, prev.ctr), deltaColor: deltaColor(cur.ctr, prev.ctr), color: "text-blue" },
  ];
  return (
    <SlideShell title="Overview do Período">
      <div className="grid grid-cols-2 gap-6 flex-1">
        {items.map(it => (
          <div key={it.label} className="bg-card border border-border rounded-2xl p-8 flex flex-col justify-between">
            <div className="text-xs uppercase tracking-widest text-text-muted font-semibold">{it.label}</div>
            <div className={`text-6xl font-bold font-mono ${it.color} mt-4`}>{it.value}</div>
            <div className="mt-4 flex items-end justify-between">
              <div className="text-sm text-text-secondary font-mono">{it.sub}</div>
              <div className={`text-sm font-mono font-semibold ${it.deltaColor}`}>{it.delta} <span className="text-text-dark font-normal">vs mês anterior</span></div>
            </div>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function PacingSlide({ d, analysis, observations }: { d: PresentationData; analysis?: string | null; observations?: any[] }) {
  const order: ("total" | "meta" | "google")[] = ["total", "meta", "google"];
  const items = order.filter(k => d.pacing?.[k]).map(k => ({ key: k, ...d.pacing![k] }));
  return (
    <SlideShell title="Pacing do Mês" subtitle={`Dia ${d.monthCur.daysElapsed} de ${d.monthCur.daysInMonth}`}>
      <div className="space-y-6 flex-1">
        {items.map(p => {
          const pctReal = Math.min(120, (p.realSpend / p.expectedSpendByEom) * 100);
          const pctExpected = Math.min(120, (p.expectedSpend / p.expectedSpendByEom) * 100);
          const color = p.status === "over" ? "bg-red" : p.status === "slightly_over" || p.status === "slightly_under" ? "bg-gold" : p.status === "on_track" ? "bg-accent" : "bg-blue";
          return (
            <div key={p.key} className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-2xl font-bold uppercase tracking-wider">{p.key === "total" ? "Total" : p.key === "meta" ? "Meta" : "Google"}</div>
                <div className={`text-sm font-semibold px-3 py-1 rounded-full border ${
                  p.status === "over" ? "text-red border-red/30 bg-red/10" :
                  p.status === "slightly_over" || p.status === "slightly_under" ? "text-gold border-gold/30 bg-gold/10" :
                  p.status === "on_track" ? "text-accent border-accent/30 bg-accent/10" :
                  "text-blue border-blue/30 bg-blue/10"
                }`}>{p.statusLabel}</div>
              </div>
              <div className="flex items-end gap-6 mb-4">
                <div>
                  <div className="text-4xl font-bold font-mono">R$ {fmt(p.realSpend)}</div>
                  <div className="text-xs text-text-muted mt-1">de R$ {fmt(p.expectedSpendByEom)} ({pctReal.toFixed(0)}%)</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-xs text-text-muted">Previsto até hoje</div>
                  <div className="text-xl font-mono text-text-secondary">R$ {fmt(p.expectedSpend)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-text-muted">Recomendado/dia</div>
                  <div className="text-xl font-mono text-text-secondary">R$ {fmt(p.recommendedDailySpend)}</div>
                </div>
              </div>
              <div className="h-4 bg-border rounded-full overflow-hidden relative">
                <div className={`h-full ${color} transition-all`} style={{ width: `${pctReal}%` }} />
                <div className="absolute top-0 h-full w-0.5 bg-text-primary" style={{ left: `${pctExpected}%` }} title="Previsto até hoje" />
              </div>
            </div>
          );
        })}
      </div>
      <ContextCallout analysis={analysis} observations={observations} />
    </SlideShell>
  );
}

function WeeklySlide({ d, analysis, observations }: { d: PresentationData; analysis?: string | null; observations?: any[] }) {
  return (
    <SlideShell title="Comparativo Semanal">
      <div className="bg-card border border-border rounded-2xl overflow-hidden flex-1">
        <table className="w-full">
          <thead>
            <tr className="bg-bg/30 text-xs text-text-muted uppercase tracking-wider">
              <th className="text-left px-6 py-4">Semana</th>
              <th className="text-right px-4 py-4">Leads</th>
              <th className="text-right px-4 py-4 w-20">Δ</th>
              <th className="text-right px-4 py-4">Invest</th>
              <th className="text-right px-4 py-4 w-20">Δ</th>
              <th className="text-right px-4 py-4">CPL</th>
              <th className="text-right px-4 py-4 w-20">Δ</th>
              <th className="text-right px-4 py-4">CTR</th>
              <th className="text-right px-4 py-4 w-20">Δ</th>
            </tr>
          </thead>
          <tbody>
            {d.weekStats.map((w, i) => (
              <tr key={i} className={i < d.weekStats.length - 1 ? "border-b border-border" : ""}>
                <td className="px-6 py-4 font-medium">{w.label}</td>
                <td className="px-4 py-4 text-right font-mono text-accent">{w.leads}</td>
                <td className="px-4 py-4 text-right font-mono text-xs text-text-secondary">{w.deltaLeads ?? "—"}</td>
                <td className="px-4 py-4 text-right font-mono text-blue">R$ {fmt(w.spend)}</td>
                <td className="px-4 py-4 text-right font-mono text-xs text-text-secondary">{w.deltaSpend ?? "—"}</td>
                <td className="px-4 py-4 text-right font-mono text-gold">{w.cpl > 0 ? `R$ ${fmt(w.cpl)}` : "—"}</td>
                <td className="px-4 py-4 text-right font-mono text-xs text-text-secondary">{w.deltaCpl ?? "—"}</td>
                <td className="px-4 py-4 text-right font-mono text-text-secondary">{fmtPct(w.ctr)}</td>
                <td className="px-4 py-4 text-right font-mono text-xs text-text-secondary">{w.deltaCtr ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ContextCallout analysis={analysis} observations={observations} />
    </SlideShell>
  );
}

function MonthlySlide({ d, analysis, observations }: { d: PresentationData; analysis?: string | null; observations?: any[] }) {
  const cur = d.monthCurStats, prev = d.monthPrevStats;
  const rows = [
    { label: "Total", cur: { leads: cur.leads, spend: cur.spend, cpl: cur.cpl }, prev: { leads: prev.leads, spend: prev.spend, cpl: prev.cpl } },
    { label: "Meta", cur: { leads: cur.metaLeads, spend: cur.metaSpend, cpl: cur.metaCpl }, prev: { leads: prev.metaLeads, spend: prev.metaSpend, cpl: prev.metaCpl } },
    { label: "Google", cur: { leads: cur.googleLeads, spend: cur.googleSpend, cpl: cur.googleCpl }, prev: { leads: prev.googleLeads, spend: prev.googleSpend, cpl: prev.googleCpl } },
  ];
  return (
    <SlideShell title="Mês Corrente vs Anterior" subtitle={`${brDateShort(d.monthCur.since)}-${brDateShort(d.monthCur.until)} vs mesmo intervalo do mês anterior`}>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg/30 text-xs text-text-muted uppercase tracking-wider">
              <th className="text-left px-6 py-4">Plataforma</th>
              <th className="text-right px-4 py-4">Leads (atual)</th>
              <th className="text-right px-4 py-4">Leads (anterior)</th>
              <th className="text-right px-4 py-4">Δ Leads</th>
              <th className="text-right px-4 py-4">Invest (atual)</th>
              <th className="text-right px-4 py-4">Invest (anterior)</th>
              <th className="text-right px-4 py-4">Δ Invest</th>
              <th className="text-right px-4 py-4">CPL (atual)</th>
              <th className="text-right px-4 py-4">CPL (anterior)</th>
              <th className="text-right px-4 py-4">Δ CPL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label} className={i < rows.length - 1 ? "border-b border-border" : ""}>
                <td className="px-6 py-4 font-semibold">{r.label}</td>
                <td className="px-4 py-4 text-right font-mono text-accent">{r.cur.leads}</td>
                <td className="px-4 py-4 text-right font-mono text-text-muted">{r.prev.leads}</td>
                <td className={`px-4 py-4 text-right font-mono ${deltaColor(r.cur.leads, r.prev.leads)}`}>{deltaPct(r.cur.leads, r.prev.leads)}</td>
                <td className="px-4 py-4 text-right font-mono text-blue">R$ {fmt(r.cur.spend)}</td>
                <td className="px-4 py-4 text-right font-mono text-text-muted">R$ {fmt(r.prev.spend)}</td>
                <td className={`px-4 py-4 text-right font-mono ${deltaColor(r.cur.spend, r.prev.spend, true)}`}>{deltaPct(r.cur.spend, r.prev.spend)}</td>
                <td className="px-4 py-4 text-right font-mono text-gold">{r.cur.cpl > 0 ? `R$ ${fmt(r.cur.cpl)}` : "—"}</td>
                <td className="px-4 py-4 text-right font-mono text-text-muted">{r.prev.cpl > 0 ? `R$ ${fmt(r.prev.cpl)}` : "—"}</td>
                <td className={`px-4 py-4 text-right font-mono ${deltaColor(r.cur.cpl, r.prev.cpl, true)}`}>{deltaPct(r.cur.cpl, r.prev.cpl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="text-xs uppercase tracking-widest text-text-muted mb-2">Projeção do mês (run-rate)</div>
          <div className="text-3xl font-bold font-mono text-accent">{d.runRate.leads} leads</div>
          <div className="text-lg font-mono text-blue mt-1">R$ {fmt(d.runRate.spend)} investimento</div>
        </div>
      </div>
      <ContextCallout analysis={analysis} observations={observations} />
    </SlideShell>
  );
}

function MetaSummarySlide({ d, analysis, observations }: { d: PresentationData; analysis?: string | null; observations?: any[] }) {
  return <CampaignSummarySlide title="Resumo Meta Ads" rows={d.metaCampaigns} analysis={analysis} observations={observations} />;
}
function GoogleSummarySlide({ d, analysis, observations }: { d: PresentationData; analysis?: string | null; observations?: any[] }) {
  return <CampaignSummarySlide title="Resumo Google Ads" rows={d.googleCampaigns} analysis={analysis} observations={observations} />;
}
function CampaignSummarySlide({ title, rows, analysis, observations }: { title: string; rows: any[]; analysis?: string | null; observations?: any[] }) {
  return (
    <SlideShell title={title} subtitle="Todas as campanhas do período">
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg/30 text-xs text-text-muted uppercase tracking-wider">
              <th className="text-left px-6 py-4">Campanha</th>
              <th className="text-left px-4 py-4 w-24">Status</th>
              <th className="text-right px-4 py-4">Invest</th>
              <th className="text-right px-4 py-4">Leads</th>
              <th className="text-right px-4 py-4">CPL</th>
              <th className="text-right px-4 py-4">CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const isActive = String(c.status ?? "").toUpperCase() === "ACTIVE" || String(c.status ?? "").toUpperCase() === "ENABLED" || !c.status;
              return (
                <tr key={i} className={i < rows.length - 1 ? "border-b border-border" : ""}>
                  <td className="px-6 py-4 font-mono text-text-primary truncate max-w-md" title={c.name}>{c.name}</td>
                  <td className="px-4 py-4">
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-md border ${isActive ? "text-accent border-accent/30 bg-accent/10" : "text-gold border-gold/30 bg-gold/10"}`}>
                      {statusLabelCamp(c.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-blue">R$ {fmt(c.spend)}</td>
                  <td className="px-4 py-4 text-right font-mono text-accent font-semibold">{c.leads}</td>
                  <td className="px-4 py-4 text-right font-mono text-gold">{c.cpl > 0 ? `R$ ${fmt(c.cpl)}` : "—"}</td>
                  <td className="px-4 py-4 text-right font-mono text-text-secondary">{fmtPct(c.ctr)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ContextCallout analysis={analysis} observations={observations} />
    </SlideShell>
  );
}

function GoogleKeywordsSlide({ d }: { d: PresentationData }) {
  const kw = d.googleTopKeywords ?? [];
  const st = d.googleTopSearchTerms ?? [];
  return (
    <SlideShell title="Google Ads — Palavras e Termos" subtitle="Top palavras-chave e termos de pesquisa do período">
      <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
        <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-border text-xs uppercase tracking-widest text-text-muted">Top Palavras-Chave</div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-text-muted uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Palavra-chave</th>
                  <th className="text-right px-3 py-3">Cliques</th>
                  <th className="text-right px-3 py-3">Conv</th>
                  <th className="text-right px-3 py-3">CPC</th>
                </tr>
              </thead>
              <tbody>
                {kw.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-6 text-center text-text-muted text-xs">Sem dados de palavras-chave no período.</td></tr>
                )}
                {kw.map((k, i) => (
                  <tr key={i} className={i < kw.length - 1 ? "border-b border-border" : ""}>
                    <td className="px-5 py-3">
                      <div className="font-mono text-text-primary truncate max-w-xs" title={k.text}>{k.text}</div>
                      {k.matchType && <div className="text-[10px] text-text-muted">[{k.matchType}]</div>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-blue">{k.clicks}</td>
                    <td className="px-3 py-3 text-right font-mono text-accent">{Number(k.conversions).toFixed(0)}</td>
                    <td className="px-3 py-3 text-right font-mono text-text-secondary">{k.clicks > 0 ? `R$ ${(Number(k.spend) / k.clicks).toFixed(2)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-border text-xs uppercase tracking-widest text-text-muted">Top Termos de Pesquisa</div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-text-muted uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Termo</th>
                  <th className="text-right px-3 py-3">Cliques</th>
                  <th className="text-right px-3 py-3">Conv</th>
                </tr>
              </thead>
              <tbody>
                {st.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-6 text-center text-text-muted text-xs">Sem dados de termos de pesquisa no período.</td></tr>
                )}
                {st.map((s, i) => (
                  <tr key={i} className={i < st.length - 1 ? "border-b border-border" : ""}>
                    <td className="px-5 py-3 font-mono text-text-primary truncate max-w-xs" title={s.term}>{s.term}</td>
                    <td className="px-3 py-3 text-right font-mono text-blue">{s.clicks}</td>
                    <td className="px-3 py-3 text-right font-mono text-accent">{Number(s.conversions).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SlideShell>
  );
}

function CampaignDetailSlide({ c, platform, weeks }: { c: any; platform: string; weeks: any[] }) {
  const isMeta = platform === "meta";
  const adSets: any[] = Array.isArray(c.adSets) ? c.adSets : [];
  const hasMultipleSets = isMeta && adSets.length > 1;
  return (
    <SlideShell
      title={c.name}
      subtitle={`${isMeta ? "Meta Ads" : "Google Ads"} · ${statusLabelCamp(c.status)}`}
    >
      {/* KPIs da campanha */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiBoxLarge label="Investimento" value={`R$ ${fmt(c.spend)}`} color="text-blue" />
        <KpiBoxLarge label="Leads" value={String(c.leads)} color="text-accent" />
        <KpiBoxLarge label="CPL" value={c.cpl > 0 ? `R$ ${fmt(c.cpl)}` : "—"} color="text-gold" />
        <KpiBoxLarge label="CTR" value={fmtPct(c.ctr)} color="text-text-primary" />
      </div>

      {/* Quebra por conjunto de anúncios — só renderiza quando há mais de 1 conjunto */}
      {hasMultipleSets && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-border text-xs uppercase tracking-widest text-text-muted">
            Conjuntos de Anúncios · {adSets.length}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-text-muted uppercase tracking-wider">
                <th className="text-left px-5 py-3">Conjunto</th>
                <th className="text-right px-4 py-3">Invest</th>
                <th className="text-right px-4 py-3">Leads</th>
                <th className="text-right px-4 py-3">CPL</th>
                <th className="text-right px-4 py-3">CTR</th>
              </tr>
            </thead>
            <tbody>
              {adSets.map((s, i) => (
                <tr key={i} className={i < adSets.length - 1 ? "border-b border-border" : ""}>
                  <td className="px-5 py-3 text-xs font-mono truncate max-w-xs" title={s.name}>{s.name}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue">R$ {fmt(s.spend)}</td>
                  <td className="px-4 py-3 text-right font-mono text-accent">{s.leads}</td>
                  <td className="px-4 py-3 text-right font-mono text-gold">{s.cpl > 0 ? `R$ ${fmt(s.cpl)}` : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-text-secondary">{fmtPct(s.ctr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Semana a semana */}
        {c.weekly && c.weekly.length > 1 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border text-xs uppercase tracking-widest text-text-muted">Semana a Semana</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-text-muted uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Semana</th>
                  <th className="text-right px-4 py-3">Invest</th>
                  <th className="text-right px-4 py-3">Leads</th>
                  <th className="text-right px-4 py-3">CPL</th>
                </tr>
              </thead>
              <tbody>
                {c.weekly.map((w: any, i: number) => (
                  <tr key={i} className={i < c.weekly.length - 1 ? "border-b border-border" : ""}>
                    <td className="px-5 py-3 text-xs">{w.label}</td>
                    <td className="px-4 py-3 text-right font-mono text-blue">R$ {fmt(w.spend)}</td>
                    <td className="px-4 py-3 text-right font-mono text-accent">{w.leads}</td>
                    <td className="px-4 py-3 text-right font-mono text-gold">{w.cpl > 0 ? `R$ ${fmt(w.cpl)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Top criativos (Meta) ou top keywords (Google) */}
        {isMeta && c.creatives && c.creatives.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border text-xs uppercase tracking-widest text-text-muted">Top Criativos</div>
            <div className="divide-y divide-border">
              {c.creatives.slice(0, 5).map((cr: any, i: number) => {
                const created = cr.created_at_meta ? String(cr.created_at_meta).slice(0, 10) : null;
                const isP = String(cr.status ?? "").toUpperCase() === "PAUSED";
                return (
                  <div key={i} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-mono truncate flex-1" title={cr.name}>{cr.name}</div>
                      {cr.permalink && <a href={cr.permalink} target="_blank" rel="noopener noreferrer" className="text-blue text-xs flex-shrink-0"><ExternalLink size={12} /></a>}
                    </div>
                    {/* Mostrar conjunto apenas quando há mais de um na campanha (senão é ruído visual) */}
                    {hasMultipleSets && cr.ad_set_name && (
                      <div className="text-[10px] text-text-muted font-mono mt-0.5 truncate" title={cr.ad_set_name}>
                        Conjunto: {cr.ad_set_name}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-1 text-xs">
                      <span className="text-text-muted">{created ? `Criado ${brDateShort(created)}` : "—"}</span>
                      <span className={isP ? "text-gold" : "text-accent"}>{statusLabelCamp(cr.status)}</span>
                      <span className="text-blue font-mono">R$ {fmt(cr.spend)}</span>
                      <span className="text-accent font-mono">{cr.leads} leads</span>
                      <span className="text-text-secondary font-mono">{fmtPct(cr.ctr)}</span>
                    </div>
                    {cr.ambiguousAttribution && (
                      <div className="text-[10px] text-gold mt-1">⚠ Atribuição ambígua — outro ad com mesmo nome compartilha a UTM. Leads foram atribuídos ao de maior spend.</div>
                    )}
                    {cr.note && <div className="text-[11px] text-text-secondary mt-1 italic">{cr.note}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isMeta && c.topKeywords && c.topKeywords.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border text-xs uppercase tracking-widest text-text-muted">Top Palavras-Chave</div>
            <div className="divide-y divide-border">
              {c.topKeywords.slice(0, 5).map((k: any, i: number) => (
                <div key={i} className="px-5 py-3">
                  <div className="text-sm font-mono truncate" title={k.text}>{k.text}</div>
                  <div className="flex items-center gap-4 mt-1 text-xs">
                    <span className="text-text-muted">[{k.matchType}]</span>
                    <span className="text-blue font-mono">{k.clicks} cliques</span>
                    <span className="text-accent font-mono">{Number(k.conversions).toFixed(0)} conv</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SlideShell>
  );
}

function AdsListSlide({ d }: { d: PresentationData }) {
  return (
    <SlideShell title="Anúncios Meta do Período" subtitle={`${d.adsList.length} anúncios`}>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg/30 text-xs text-text-muted uppercase tracking-wider">
              <th className="text-left px-5 py-3">Anúncio</th>
              <th className="text-left px-4 py-3">Início</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Invest</th>
              <th className="text-right px-4 py-3">Leads</th>
              <th className="text-center px-4 py-3 w-16">Link</th>
            </tr>
          </thead>
          <tbody>
            {d.adsList.slice(0, 12).map((a, i) => (
              <tr key={i} className={i < d.adsList.length - 1 ? "border-b border-border" : ""}>
                <td className="px-5 py-3">
                  <div className="font-mono text-sm">{a.ad_name}</div>
                  <div className="text-[11px] text-text-muted truncate max-w-md" title={a.campaign_name}>{a.campaign_name}</div>
                  {a.ad_set_name && (
                    <div className="text-[10px] text-text-muted truncate max-w-md font-mono" title={a.ad_set_name}>
                      Conjunto: {a.ad_set_name}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-text-secondary font-mono">{brDateShort(a.first_date)}</td>
                <td className="px-4 py-3 text-xs">
                  <span className={String(a.status).toUpperCase() === "PAUSED" ? "text-gold" : "text-accent"}>{a.statusLabel}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-blue">R$ {fmt(a.spend)}</td>
                <td className="px-4 py-3 text-right font-mono text-accent">{a.leads}</td>
                <td className="px-4 py-3 text-center">{a.permalink ? <a href={a.permalink} target="_blank" rel="noopener noreferrer" className="text-blue inline-flex"><ExternalLink size={14} /></a> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {d.adsList.length > 12 && <div className="px-5 py-3 text-xs text-text-muted text-center border-t border-border">+ {d.adsList.length - 12} anúncios não exibidos</div>}
      </div>
    </SlideShell>
  );
}

function ActionsSlide({ d }: { d: PresentationData }) {
  return (
    <SlideShell title="Ações Realizadas no Período">
      <div className="space-y-3 flex-1 overflow-auto">
        {d.reportActions.map((a, i) => {
          const platLabel = a.platform === "meta" ? "Meta" : a.platform === "google" ? "Google" : "Geral";
          const platColor = a.platform === "meta" ? "text-blue border-blue/30 bg-blue/10" : a.platform === "google" ? "text-gold border-gold/30 bg-gold/10" : "text-text-secondary border-border bg-bg";
          return (
            <div key={i} className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
              <span className="text-xs font-mono text-text-muted w-20 flex-shrink-0">{brDateShort(a.action_date)}</span>
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-md border flex-shrink-0 ${platColor}`}>{platLabel}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-text-primary">{a.title}{a.campaign_name && <span className="text-text-muted font-mono text-xs ml-2">· {a.campaign_name}</span>}</div>
                <div className="text-sm text-text-secondary mt-1">{a.description}</div>
                {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-blue text-xs mt-1 inline-block">{a.link}</a>}
              </div>
            </div>
          );
        })}
      </div>
    </SlideShell>
  );
}

function ObservationsSlide({ observations }: { observations: any[] }) {
  return (
    <SlideShell title="Observações do Gestor">
      <div className="space-y-4 flex-1 overflow-auto">
        {observations.map((o, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <div className="text-xs font-mono text-text-muted mb-2">{o.until ? `${brDateShort(o.since)} a ${brDateShort(o.until)}` : `desde ${brDateShort(o.since)}`}</div>
            <div className="text-base text-text-primary leading-relaxed whitespace-pre-wrap">{o.content}</div>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function EndSlide({ d }: { d: PresentationData }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <div className="text-7xl font-bold text-accent mb-6">Obrigado</div>
      <div className="text-xl text-text-secondary">{d.client} · {brDateFull(d.periodFrom)} a {brDateFull(d.periodTo)}</div>
    </div>
  );
}

// ─── Helpers de UI ───────────────────────────────────────────────────────────
function SlideShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.3em] text-accent font-semibold mb-2">{subtitle ?? "Relatório"}</div>
        <h1 className="text-4xl font-bold text-text-primary">{title}</h1>
      </div>
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
    </div>
  );
}

// Callout pra mostrar observações do gestor no fim do slide
function ContextCallout({ observations }: { analysis?: string | null; observations?: any[] }) {
  const hasObs = observations && observations.length > 0;
  if (!hasObs) return null;
  return (
    <div className="mt-4">
      <div className="bg-card border-l-4 border-blue rounded-r-lg px-4 py-3">
        <div className="text-[10px] uppercase tracking-widest text-blue font-semibold mb-1">Observação do gestor</div>
        <div className="space-y-2">
          {observations!.map((o, i) => (
            <div key={i} className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{o.content}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiBoxLarge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-widest text-text-muted">{label}</div>
      <div className={`text-3xl font-bold font-mono mt-1 ${color}`}>{value}</div>
    </div>
  );
}
