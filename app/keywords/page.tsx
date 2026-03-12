"use client";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { keywords, Keyword } from "@/lib/mock-data";
import { AlertTriangle } from "lucide-react";

function fmtCurrency(n: number) {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtNum(n: number) {
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("pt-BR");
}

const matchColors: Record<string, string> = {
  exata: "bg-accent/10 text-accent border-accent/20",
  frase: "bg-blue/10 text-blue border-blue/20",
  ampla: "bg-gold/10 text-gold border-gold/20",
};

export default function KeywordsPage() {
  const { mode, platform } = useDashboard();

  if (platform !== "google") {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Keywords" />
          <main className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <AlertTriangle size={40} className="text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary text-sm">Keywords disponível apenas para Google Ads.</p>
              <p className="text-text-muted text-xs mt-1">Alterne para Google na sidebar.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const data = keywords[mode];

  const columns: Column<Keyword>[] = [
    {
      key: "termo", label: "Palavra-chave", sortable: false,
      render: row => <span className="text-text-primary font-mono text-xs">{row.termo}</span>,
    },
    {
      key: "correspondencia", label: "Corresp.", align: "center",
      render: row => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${matchColors[row.correspondencia]}`}>
          {row.correspondencia}
        </span>
      ),
    },
    {
      key: "campanha", label: "Campanha", sortable: false,
      render: row => <span className="text-text-muted text-xs">{row.campanha}</span>,
    },
    { key: "gasto", label: "Gasto", align: "right", render: row => <span className="font-mono text-blue">{fmtCurrency(row.gasto)}</span> },
    { key: "impressoes", label: "Impressões", align: "right", render: row => <span className="font-mono text-text-secondary">{fmtNum(row.impressoes)}</span> },
    { key: "cliques", label: "Cliques", align: "right", render: row => <span className="font-mono text-text-secondary">{fmtNum(row.cliques)}</span> },
    { key: "ctr", label: "CTR", align: "right", render: row => <span className="font-mono text-text-primary">{row.ctr.toFixed(2)}%</span> },
    { key: "cpc", label: "CPC", align: "right", render: row => <span className="font-mono text-text-primary">{fmtCurrency(row.cpc)}</span> },
    ...(mode === "lead-gen" ? [
      { key: "leads" as keyof Keyword, label: "Leads", align: "right" as const, render: (row: Keyword) => <span className="font-mono text-accent">{fmtNum(row.leads)}</span> },
      { key: "cpl" as keyof Keyword, label: "CPL", align: "right" as const, render: (row: Keyword) => <span className="font-mono text-gold">{fmtCurrency(row.cpl)}</span> },
    ] : []),
  ];

  const totGasto = data.reduce((s, k) => s + k.gasto, 0);
  const totCliques = data.reduce((s, k) => s + k.cliques, 0);
  const totLeads = data.reduce((s, k) => s + k.leads, 0);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Keywords" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-text-secondary mb-1">Total Gasto</p>
              <p className="font-mono text-lg text-blue">{fmtCurrency(totGasto)}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-text-secondary mb-1">Total Cliques</p>
              <p className="font-mono text-lg text-text-primary">{fmtNum(totCliques)}</p>
            </div>
            {mode === "lead-gen" ? (
              <>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-text-secondary mb-1">Total Leads</p>
                  <p className="font-mono text-lg text-accent">{fmtNum(totLeads)}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-text-secondary mb-1">CPL Médio</p>
                  <p className="font-mono text-lg text-gold">{fmtCurrency(totLeads > 0 ? totGasto / totLeads : 0)}</p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-text-secondary mb-1">Keywords Ativas</p>
                  <p className="font-mono text-lg text-accent">{data.length}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-text-secondary mb-1">CPC Médio</p>
                  <p className="font-mono text-lg text-text-primary">
                    {fmtCurrency(data.reduce((s, k) => s + k.cpc, 0) / data.length)}
                  </p>
                </div>
              </>
            )}
          </div>
          <DataTable columns={columns} data={data} rowKey="id" />
        </main>
      </div>
    </div>
  );
}
