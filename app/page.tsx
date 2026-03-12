"use client";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import KPICard from "@/components/kpi-card";
import TrendChart from "@/components/trend-chart";
import Funnel from "@/components/funnel";
import { useDashboard } from "@/lib/dashboard-context";
import { kpiData } from "@/lib/mock-data";

function fmt(n: number, type: "currency" | "number" | "pct" | "decimal" = "number") {
  if (type === "currency") return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (type === "pct") return n.toFixed(2) + "%";
  if (type === "decimal") return n.toFixed(2);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("pt-BR");
}

export default function OverviewPage() {
  const { mode, platform } = useDashboard();
  const kpi = kpiData[platform][mode];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Overview" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KPICard label="Investimento" value={fmt(kpi.investimento, "currency")} trend={4.2} accent="blue" />
            <KPICard label="Impressões" value={fmt(kpi.impressoes)} trend={8.1} />
            <KPICard label="Cliques" value={fmt(kpi.cliques)} trend={3.7} />
            <KPICard label="CTR" value={fmt(kpi.ctr, "pct")} sub="Cliques / Impressões" trend={-0.3} />
            <KPICard label="CPC" value={fmt(kpi.cpc, "currency")} sub="Custo por Clique" trend={-1.8} accent="green" />
            <KPICard label="Connect Rate" value={fmt(kpi.connectRate, "pct")} sub="LPV / Cliques" trend={2.1} accent="gold" />
            {mode === "lead-gen" ? (
              <>
                <KPICard label="Leads Plataforma" value={fmt(kpi.leadsPlataforma)} trend={6.4} accent="green" />
                <KPICard label="Leads CRM" value={fmt(kpi.leadsCRM)} sub={`${((kpi.leadsCRM / kpi.leadsPlataforma) * 100).toFixed(0)}% validados`} trend={5.2} accent="green" />
                <KPICard label="CPL Real" value={fmt(kpi.cplReal, "currency")} sub="Invest / Leads CRM" trend={-3.1} accent="gold" />
              </>
            ) : (
              <>
                <KPICard label="Vendas" value={fmt(kpi.vendas)} trend={12.3} accent="green" />
                <KPICard label="ROAS" value={fmt(kpi.roas, "decimal") + "x"} sub="Retorno sobre Invest." trend={1.4} accent="gold" />
                <KPICard label="Custo por Venda" value={fmt(kpi.investimento / kpi.vendas, "currency")} sub="Invest / Vendas" trend={-2.8} accent="blue" />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"><TrendChart /></div>
            <div><Funnel /></div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-text-secondary mb-1">CPM Médio</p>
              <p className="font-mono text-lg text-text-primary">R$ {((kpi.investimento / kpi.impressoes) * 1000).toFixed(2)}</p>
              <p className="text-xs text-text-muted mt-1">Custo por mil impressões</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-text-secondary mb-1">Freq. Média</p>
              <p className="font-mono text-lg text-text-primary">{platform === "meta" ? "3.2x" : "—"}</p>
              <p className="text-xs text-text-muted mt-1">{platform === "meta" ? "Impressões por usuário" : "Não disponível no Google"}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-text-secondary mb-1">{mode === "lead-gen" ? "Taxa Lead→CRM" : "Taxa Conv."}</p>
              <p className="font-mono text-lg text-text-primary">
                {mode === "lead-gen"
                  ? ((kpi.leadsCRM / kpi.leadsPlataforma) * 100).toFixed(1) + "%"
                  : ((kpi.vendas / kpi.cliques) * 100).toFixed(2) + "%"}
              </p>
              <p className="text-xs text-text-muted mt-1">{mode === "lead-gen" ? "Leads CRM / Leads Plat." : "Vendas / Cliques"}</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
