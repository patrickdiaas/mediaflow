"use client";
import { useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { mockCampaigns, mockAdSets, mockCreatives } from "@/lib/mock-data";
import type { CampaignRow, AdSetRow, CreativeRow, Platform } from "@/lib/types";
import Image from "next/image";

type Tab = "campanhas" | "conjuntos" | "anuncios";

const PlatformBadge = ({ p }: { p: Platform }) => (
  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
    p === "meta" ? "text-blue border-blue/30 bg-blue/10" : "text-gold border-gold/30 bg-gold/10"
  }`}>
    {p === "meta" ? "Meta" : "Google"}
  </span>
);

const roasColor = (v: number) =>
  v >= 4.5 ? "text-accent" : v >= 3 ? "text-gold" : "text-red";

const campaignColumns: Column<CampaignRow>[] = [
  {
    key: "campaign_name",
    label: "Campanha",
    render: (v, row) => (
      <div className="flex items-center gap-2">
        <PlatformBadge p={row.platform} />
        <span className="text-text-primary text-sm truncate max-w-xs" title={String(v)}>{String(v)}</span>
      </div>
    ),
  },
  { key: "impressions", label: "Impressões", align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "clicks",      label: "Cliques",    align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "ctr",         label: "CTR",        align: "right",
    render: v => <span className="text-text-secondary">{Number(v).toFixed(1)}%</span> },
  { key: "spend",       label: "Investido",  align: "right",
    render: v => <span className="text-blue">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "revenue",     label: "Receita",    align: "right",
    render: v => <span className="text-accent">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "sales",       label: "Vendas",     align: "right",
    render: v => <span className="text-green font-semibold">{String(v)}</span> },
  { key: "roas",        label: "ROAS",       align: "right",
    render: v => <span className={`font-semibold ${roasColor(Number(v))}`}>{Number(v).toFixed(2)}×</span> },
  { key: "cpa",         label: "CPA",        align: "right",
    render: v => <span className="text-gold">R$ {Number(v).toFixed(2)}</span> },
];

const adSetColumns: Column<AdSetRow>[] = [
  {
    key: "ad_set_name",
    label: "Conjunto",
    render: (v, row) => (
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <PlatformBadge p={row.platform} />
          <span className="text-text-primary text-sm">{String(v)}</span>
        </div>
        <span className="text-xs text-text-muted">{row.campaign_name}</span>
      </div>
    ),
  },
  { key: "impressions", label: "Impressões", align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "clicks",      label: "Cliques",    align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "ctr",         label: "CTR",        align: "right",
    render: v => <span className="text-text-secondary">{Number(v).toFixed(1)}%</span> },
  { key: "spend",       label: "Investido",  align: "right",
    render: v => <span className="text-blue">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "revenue",     label: "Receita",    align: "right",
    render: v => <span className="text-accent">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "sales",       label: "Vendas",     align: "right",
    render: v => <span className="text-green font-semibold">{String(v)}</span> },
  { key: "roas",        label: "ROAS",       align: "right",
    render: v => <span className={`font-semibold ${roasColor(Number(v))}`}>{Number(v).toFixed(2)}×</span> },
  { key: "cpa",         label: "CPA",        align: "right",
    render: v => <span className="text-gold">R$ {Number(v).toFixed(2)}</span> },
];

const adColumns: Column<CreativeRow>[] = [
  {
    key: "ad_name",
    label: "Anúncio",
    render: (v, row) => (
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-9 rounded-md overflow-hidden bg-bg flex-shrink-0 border border-border">
          {row.thumbnail_url
            ? <Image src={row.thumbnail_url} alt={String(v)} fill className="object-cover" sizes="56px" />
            : <div className="w-full h-full flex items-center justify-center text-text-muted text-[10px]">—</div>
          }
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <PlatformBadge p={row.platform} />
            <span className="text-text-primary text-sm">{String(v)}</span>
          </div>
          <span className="text-xs text-text-muted">{row.campaign_name}</span>
        </div>
      </div>
    ),
  },
  { key: "impressions", label: "Impressões", align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "clicks",      label: "Cliques",    align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "ctr",         label: "CTR",        align: "right",
    render: v => <span className="text-text-secondary">{Number(v).toFixed(1)}%</span> },
  { key: "spend",       label: "Investido",  align: "right",
    render: v => <span className="text-blue">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "revenue",     label: "Receita",    align: "right",
    render: v => <span className="text-accent">R$ {Number(v).toLocaleString("pt-BR")}</span> },
  { key: "sales",       label: "Vendas",     align: "right",
    render: v => <span className="text-green font-semibold">{String(v)}</span> },
  { key: "roas",        label: "ROAS",       align: "right",
    render: v => <span className={`font-semibold ${roasColor(Number(v))}`}>{Number(v).toFixed(2)}×</span> },
  { key: "cpa",         label: "CPA",        align: "right",
    render: v => <span className="text-gold">R$ {Number(v).toFixed(2)}</span> },
];

export default function CampanhasPage() {
  const { platform } = useDashboard();
  const [tab, setTab] = useState<Tab>("campanhas");

  const filteredCampaigns = platform === "all"
    ? mockCampaigns
    : mockCampaigns.filter(c => c.platform === platform);

  const filteredAdSets = platform === "all"
    ? mockAdSets
    : mockAdSets.filter(c => c.platform === platform);

  const filteredAds = platform === "all"
    ? mockCreatives
    : mockCreatives.filter(c => c.platform === platform);

  const activeData =
    tab === "campanhas" ? filteredCampaigns :
    tab === "conjuntos" ? filteredAdSets :
    filteredAds;

  const totalSpend   = activeData.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = activeData.reduce((s, c) => s + c.revenue, 0);
  const totalSales   = activeData.reduce((s, c) => s + c.sales, 0);
  const overallRoas  = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const tabs: { id: Tab; label: string }[] = [
    { id: "campanhas", label: "Campanhas" },
    { id: "conjuntos", label: "Conjuntos" },
    { id: "anuncios",  label: "Anúncios"  },
  ];

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Header title="Campanhas" subtitle="Performance por campanha, conjunto e anúncio" />

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl px-2 py-1.5 mb-4 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Summary bar */}
        <div className="flex gap-4 mb-5 p-3 bg-card border border-border rounded-xl text-sm">
          <Stat label="Invest. Total"  value={`R$ ${totalSpend.toLocaleString("pt-BR")}`}   color="text-blue"   />
          <div className="w-px bg-border" />
          <Stat label="Receita Total"  value={`R$ ${totalRevenue.toLocaleString("pt-BR")}`}  color="text-accent" />
          <div className="w-px bg-border" />
          <Stat label="Vendas"         value={String(totalSales)}                            color="text-green"  />
          <div className="w-px bg-border" />
          <Stat label="ROAS Geral"     value={`${overallRoas.toFixed(2)}×`}                  color={roasColor(overallRoas)} />
        </div>

        {tab === "campanhas" && (
          <DataTable<CampaignRow> columns={campaignColumns} data={filteredCampaigns} rowKey="campaign_id" />
        )}
        {tab === "conjuntos" && (
          <DataTable<AdSetRow> columns={adSetColumns} data={filteredAdSets} rowKey="ad_set_id" />
        )}
        {tab === "anuncios" && (
          <DataTable<CreativeRow> columns={adColumns} data={filteredAds} rowKey="ad_id" />
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-text-muted text-xs">{label}:</span>
      <span className={`font-mono font-semibold text-sm ${color}`}>{value}</span>
    </div>
  );
}
