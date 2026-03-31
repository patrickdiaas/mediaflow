"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { creatives as mockCreatives, Creative } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import { Film, Image as ImageIcon, LayoutGrid } from "lucide-react";

function fmtCurrency(n: number) {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("pt-BR");
}

const typeIcons: Record<string, React.ReactNode> = {
  video: <Film size={12} className="text-blue" />,
  imagem: <ImageIcon size={12} className="text-gold" />,
  carrossel: <LayoutGrid size={12} className="text-accent" />,
};
const typeColors: Record<string, string> = {
  video: "text-blue",
  imagem: "text-gold",
  carrossel: "text-accent",
};

export default function CriativosPage() {
  const { mode, platform } = useDashboard();
  const [data, setData] = useState<Creative[]>(mockCreatives[platform][mode]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (platform === "meta") {
      setLoading(true);
      supabase
        .from("creatives")
        .select("id, nome, tipo, campanha, impressoes, cliques, ctr, leads, cpl, gasto")
        .eq("platform", "meta")
        .eq("mode", mode)
        .then(({ data: rows, error }) => {
          setLoading(false);
          if (rows && !error && rows.length > 0) {
            setData(
              rows.map(r => ({
                id: r.id,
                nome: r.nome,
                tipo: r.tipo as Creative["tipo"],
                campanha: r.campanha ?? "",
                impressoes: r.impressoes ?? 0,
                cliques: r.cliques ?? 0,
                ctr: r.ctr ?? 0,
                leads: r.leads ?? 0,
                cpl: r.cpl ?? 0,
                gasto: r.gasto ?? 0,
              }))
            );
          } else {
            setData(mockCreatives[platform][mode]);
          }
        });
    } else {
      setData(mockCreatives[platform][mode]);
    }
  }, [platform, mode]);

  const columns: Column<Creative>[] = [
    {
      key: "nome", label: "Criativo", sortable: false,
      render: row => (
        <div className="flex flex-col gap-0.5">
          <span className="text-text-primary font-medium font-mono text-xs">{row.nome}</span>
          <span className="text-text-muted text-xs">{row.campanha}</span>
        </div>
      ),
    },
    {
      key: "tipo", label: "Tipo", align: "center",
      render: row => (
        <span className={`flex items-center gap-1 justify-center ${typeColors[row.tipo]}`}>
          {typeIcons[row.tipo]}
          <span className="capitalize">{row.tipo}</span>
        </span>
      ),
    },
    { key: "gasto", label: "Gasto", align: "right", render: row => <span className="font-mono text-blue">{fmtCurrency(row.gasto)}</span> },
    { key: "impressoes", label: "Impressões", align: "right", render: row => <span className="font-mono text-text-secondary">{fmtNum(row.impressoes)}</span> },
    { key: "cliques", label: "Cliques", align: "right", render: row => <span className="font-mono text-text-secondary">{fmtNum(row.cliques)}</span> },
    { key: "ctr", label: "CTR", align: "right", render: row => {
      const good = row.ctr >= 2;
      return <span className={`font-mono ${good ? "text-accent" : "text-text-primary"}`}>{row.ctr.toFixed(2)}%</span>;
    }},
    ...(mode === "lead-gen" ? [
      { key: "leads" as keyof Creative, label: "Leads", align: "right" as const, render: (row: Creative) => <span className="font-mono text-accent">{fmtNum(row.leads)}</span> },
      { key: "cpl" as keyof Creative, label: "CPL", align: "right" as const, render: (row: Creative) => <span className="font-mono text-gold">{fmtCurrency(row.cpl)}</span> },
    ] : []),
  ];

  const totGasto = data.reduce((s, c) => s + c.gasto, 0);
  const totLeads = data.reduce((s, c) => s + c.leads, 0);
  const avgCTR = data.length > 0 ? data.reduce((s, c) => s + c.ctr, 0) / data.length : 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Criativos" />
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-text-secondary text-sm">Carregando criativos...</div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-text-secondary mb-1">Total Gasto</p>
                  <p className="font-mono text-lg text-blue">{fmtCurrency(totGasto)}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-text-secondary mb-1">CTR Médio</p>
                  <p className="font-mono text-lg text-text-primary">{avgCTR.toFixed(2)}%</p>
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
                      <p className="text-xs text-text-secondary mb-1">Criativos Ativos</p>
                      <p className="font-mono text-lg text-accent">{data.length}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                      <p className="text-xs text-text-secondary mb-1">Gasto Médio</p>
                      <p className="font-mono text-lg text-text-primary">{fmtCurrency(data.length > 0 ? totGasto / data.length : 0)}</p>
                    </div>
                  </>
                )}
              </div>
              <DataTable columns={columns} data={data} rowKey="id" />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
