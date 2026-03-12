"use client";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { sales, Sale } from "@/lib/mock-data";
import { AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

function fmtCurrency(n: number) {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtNum(n: number) {
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("pt-BR");
}

interface TooltipProps { active?: boolean; payload?: Array<{ dataKey: string; color: string; name: string; value: number }>; label?: string; }
const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl">
      <p className="text-text-secondary mb-2">{label}</p>
      {payload.map((e) => (
        <div key={e.dataKey} className="flex gap-2 mb-0.5">
          <span style={{ color: e.color }}>{e.name}:</span>
          <span className="font-mono text-text-primary">{typeof e.value === "number" && e.value > 100 ? fmtCurrency(e.value) : e.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function VendasPage() {
  const { mode, platform } = useDashboard();

  if (mode !== "ecommerce") {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Vendas" />
          <main className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <AlertTriangle size={40} className="text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary text-sm">Vendas disponível apenas no modo E-commerce.</p>
              <p className="text-text-muted text-xs mt-1">Alterne para E-commerce na sidebar.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const data = sales[platform];

  const columns: Column<Sale>[] = [
    {
      key: "produto", label: "Produto", sortable: false,
      render: row => <span className="text-text-primary font-medium">{row.produto}</span>,
    },
    {
      key: "campanha", label: "Campanha", sortable: false,
      render: row => <span className="text-text-muted text-xs">{row.campanha}</span>,
    },
    { key: "gasto", label: "Gasto", align: "right", render: row => <span className="font-mono text-blue">{fmtCurrency(row.gasto)}</span> },
    { key: "valor", label: "Receita", align: "right", render: row => <span className="font-mono text-accent">{fmtCurrency(row.valor)}</span> },
    { key: "roas", label: "ROAS", align: "right", render: row => {
      const color = row.roas >= 5 ? "text-accent" : row.roas >= 3 ? "text-gold" : "text-red";
      return <span className={`font-mono font-semibold ${color}`}>{row.roas.toFixed(2)}x</span>;
    }},
    { key: "conversoes", label: "Conversões", align: "right", render: row => <span className="font-mono text-text-primary">{fmtNum(row.conversoes)}</span> },
    { key: "ticketMedio", label: "Ticket Médio", align: "right", render: row => <span className="font-mono text-gold">{fmtCurrency(row.ticketMedio)}</span> },
  ];

  const totReceita = data.reduce((s, d) => s + d.valor, 0);
  const totGasto = data.reduce((s, d) => s + d.gasto, 0);
  const totConversoes = data.reduce((s, d) => s + d.conversoes, 0);
  const roasGeral = totReceita / totGasto;

  const chartData = data.map(d => ({
    name: d.produto.replace("Plano ", ""),
    receita: d.valor,
    gasto: d.gasto,
    roas: d.roas,
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Vendas" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-card border border-accent/20 bg-accent/5 rounded-xl p-4">
              <p className="text-xs text-text-secondary mb-1">Receita Total</p>
              <p className="font-mono text-xl text-accent">{fmtCurrency(totReceita)}</p>
            </div>
            <div className="bg-card border border-blue/20 bg-blue/5 rounded-xl p-4">
              <p className="text-xs text-text-secondary mb-1">Total Investido</p>
              <p className="font-mono text-xl text-blue">{fmtCurrency(totGasto)}</p>
            </div>
            <div className="bg-card border border-gold/20 bg-gold/5 rounded-xl p-4">
              <p className="text-xs text-text-secondary mb-1">ROAS Geral</p>
              <p className="font-mono text-xl text-gold">{roasGeral.toFixed(2)}x</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-text-secondary mb-1">Total Conversões</p>
              <p className="font-mono text-xl text-text-primary">{fmtNum(totConversoes)}</p>
            </div>
          </div>

          {/* Bar chart receita vs gasto */}
          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-text-primary mb-5">Receita vs Gasto por Produto</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#171b28" />
                <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 11, fontFamily: "DM Mono" }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="receita" name="Receita" fill="#4ade8066" radius={[4, 4, 0, 0]} stroke="#4ade80" strokeWidth={1} />
                <Bar dataKey="gasto" name="Gasto" fill="#5b9bd566" radius={[4, 4, 0, 0]} stroke="#5b9bd5" strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <DataTable columns={columns} data={data} rowKey="id" />
        </main>
      </div>
    </div>
  );
}
