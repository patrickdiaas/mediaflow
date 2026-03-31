"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { campaigns as mockCampaigns, Campaign } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";

function fmtCurrency(n: number) {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("pt-BR");
}

const statusColors: Record<string, string> = {
  ativa: "bg-accent/10 text-accent border-accent/20",
  pausada: "bg-gold/10 text-gold border-gold/20",
  encerrada: "bg-red/10 text-red border-red/20",
};

export default function CampanhasPage() {
  const { mode, platform } = useDashboard();
  const [data, setData] = useState<Campaign[]>(mockCampaigns[platform][mode]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (platform === "meta") {
      setLoading(true);
      supabase
        .from("campaigns")
        .select("id, nome, status, investimento, impressoes, cliques, ctr, cpc, leads, cpl, vendas, roas")
        .eq("platform", "meta")
        .eq("mode", mode)
        .then(({ data: rows, error }) => {
          setLoading(false);
          if (rows && !error && rows.length > 0) {
            setData(
              rows.map(r => ({
                id: r.id,
                nome: r.nome,
                status: r.status as Campaign["status"],
                investimento: r.investimento ?? 0,
                impressoes: r.impressoes ?? 0,
                cliques: r.cliques ?? 0,
                ctr: r.ctr ?? 0,
                cpc: r.cpc ?? 0,
                leads: r.leads ?? 0,
                cpl: r.cpl ?? 0,
                vendas: r.vendas ?? 0,
                roas: r.roas ?? 0,
              }))
            );
          } else {
            setData(mockCampaigns[platform][mode]);
          }
        });
    } else {
      setData(mockCampaigns[platform][mode]);
    }
  }, [platform, mode]);

  const leadsColumns: Column<Campaign>[] = [
    {
      key: "nome", label: "Campanha", sortable: false,
      render: row => <span className="text-text-primary font-medium max-w-xs truncate block">{row.nome}</span>,
    },
    {
      key: "status", label: "Status", align: "center",
      render: row => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${statusColors[row.status]}`}>
          {row.status}
        </span>
      ),
    },
    { key: "investimento", label: "Investimento", align: "right", render: row => <span className="font-mono text-blue">{fmtCurrency(row.investimento)}</span> },
    { key: "impressoes", label: "Impressões", align: "right", render: row => <span className="font-mono text-text-secondary">{fmtNum(row.impressoes)}</span> },
    { key: "cliques", label: "Cliques", align: "right", render: row => <span className="font-mono text-text-secondary">{fmtNum(row.cliques)}</span> },
    { key: "ctr", label: "CTR", align: "right", render: row => <span className="font-mono text-text-primary">{row.ctr.toFixed(2)}%</span> },
    { key: "cpc", label: "CPC", align: "right", render: row => <span className="font-mono text-text-primary">{fmtCurrency(row.cpc)}</span> },
    { key: "leads", label: "Leads", align: "right", render: row => <span className="font-mono text-accent">{fmtNum(row.leads)}</span> },
    { key: "cpl", label: "CPL", align: "right", render: row => <span className="font-mono text-gold">{fmtCurrency(row.cpl)}</span> },
  ];

  const ecomColumns: Column<Campaign>[] = [
    {
      key: "nome", label: "Campanha", sortable: false,
      render: row => <span className="text-text-primary font-medium max-w-xs truncate block">{row.nome}</span>,
    },
    {
      key: "status", label: "Status", align: "center",
      render: row => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${statusColors[row.status]}`}>
          {row.status}
        </span>
      ),
    },
    { key: "investimento", label: "Investimento", align: "right", render: row => <span className="font-mono text-blue">{fmtCurrency(row.investimento)}</span> },
    { key: "impressoes", label: "Impressões", align: "right", render: row => <span className="font-mono text-text-secondary">{fmtNum(row.impressoes)}</span> },
    { key: "cliques", label: "Cliques", align: "right", render: row => <span className="font-mono text-text-secondary">{fmtNum(row.cliques)}</span> },
    { key: "ctr", label: "CTR", align: "right", render: row => <span className="font-mono text-text-primary">{row.ctr.toFixed(2)}%</span> },
    { key: "cpc", label: "CPC", align: "right", render: row => <span className="font-mono text-text-primary">{fmtCurrency(row.cpc)}</span> },
    { key: "vendas", label: "Vendas", align: "right", render: row => <span className="font-mono text-accent">{fmtNum(row.vendas ?? 0)}</span> },
    { key: "roas", label: "ROAS", align: "right", render: row => <span className="font-mono text-gold">{(row.roas ?? 0).toFixed(2)}x</span> },
  ];

  const totInvest = data.reduce((s, c) => s + c.investimento, 0);
  const totCliques = data.reduce((s, c) => s + c.cliques, 0);
  const totLeads = data.reduce((s, c) => s + c.leads, 0);
  const totVendas = data.reduce((s, c) => s + (c.vendas ?? 0), 0);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Campanhas" />
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-text-secondary text-sm">Carregando campanhas...</div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-text-secondary mb-1">Total Investido</p>
                  <p className="font-mono text-lg text-blue">{fmtCurrency(totInvest)}</p>
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
                      <p className="font-mono text-lg text-gold">{fmtCurrency(totLeads > 0 ? totInvest / totLeads : 0)}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-card border border-border rounded-xl p-4">
                      <p className="text-xs text-text-secondary mb-1">Total Vendas</p>
                      <p className="font-mono text-lg text-accent">{fmtNum(totVendas)}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                      <p className="text-xs text-text-secondary mb-1">Campanhas Ativas</p>
                      <p className="font-mono text-lg text-text-primary">{data.filter(c => c.status === "ativa").length}/{data.length}</p>
                    </div>
                  </>
                )}
              </div>
              <DataTable
                columns={mode === "lead-gen" ? leadsColumns : ecomColumns}
                data={data}
                rowKey="id"
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
