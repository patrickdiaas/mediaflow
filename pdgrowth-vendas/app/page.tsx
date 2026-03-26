"use client";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import KPICard from "@/components/kpi-card";
import TrendChart from "@/components/trend-chart";
import Funnel from "@/components/funnel";
import { mockKPIs, mockFunnel, mockTrend } from "@/lib/mock-data";

export default function OverviewPage() {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Header
          title="Overview"
          subtitle="Visão geral de performance de vendas"
        />

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {mockKPIs.map(kpi => (
            <KPICard key={kpi.label} {...kpi} />
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <TrendChart data={mockTrend} />
          </div>
          <div>
            <Funnel steps={mockFunnel} />
          </div>
        </div>
      </main>
    </div>
  );
}
