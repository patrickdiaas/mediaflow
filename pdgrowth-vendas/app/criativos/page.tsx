"use client";
import { useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import CreativeCard from "@/components/creative-card";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { mockCreatives } from "@/lib/mock-data";
import type { CreativeRow, Platform } from "@/lib/types";
import { LayoutGrid, List } from "lucide-react";
import Image from "next/image";

const roasColor = (v: number) =>
  v >= 4.5 ? "text-accent" : v >= 3 ? "text-gold" : "text-red";

const PlatformBadge = ({ p }: { p: Platform }) => (
  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
    p === "meta" ? "text-blue border-blue/30 bg-blue/10" : "text-gold border-gold/30 bg-gold/10"
  }`}>
    {p === "meta" ? "Meta" : "Google"}
  </span>
);

const tableColumns: Column<CreativeRow>[] = [
  {
    key: "ad_name",
    label: "Criativo",
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
    render: v => <span className="text-purple font-semibold">{String(v)}</span> },
  { key: "roas",        label: "ROAS",       align: "right",
    render: v => <span className={`font-semibold ${roasColor(Number(v))}`}>{Number(v).toFixed(2)}×</span> },
  { key: "cpa",         label: "CPA",        align: "right",
    render: v => <span className="text-gold">R$ {Number(v).toFixed(2)}</span> },
];

export default function CriativosPage() {
  const { platform } = useDashboard();
  const [view, setView] = useState<"grid" | "list">("grid");

  const filtered = platform === "all"
    ? mockCreatives
    : mockCreatives.filter(c => c.platform === platform);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Criativos</h1>
            <p className="text-sm text-text-secondary mt-0.5">Performance por anúncio com prévia do criativo</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setView("grid")}
                className={`px-3 py-2 transition-colors ${view === "grid" ? "bg-border text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setView("list")}
                className={`px-3 py-2 transition-colors ${view === "list" ? "bg-border text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(c => <CreativeCard key={c.ad_id} creative={c} />)}
          </div>
        ) : (
          <DataTable<CreativeRow> columns={tableColumns} data={filtered} rowKey="ad_id" />
        )}
      </main>
    </div>
  );
}
