"use client";
import { useDashboard } from "@/lib/dashboard-context";
import { clients, campaignNames, products, periods } from "@/lib/mock-data";
import { ChevronDown } from "lucide-react";

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-card border border-border text-text-primary text-xs rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-border-light cursor-pointer hover:border-border-light transition-colors"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
    </div>
  );
}

export default function Header({ title }: { title: string }) {
  const { mode, platform, client, setClient, campaign, setCampaign, product, setProduct, period, setPeriod } = useDashboard();

  const campaignOpts = campaignNames[platform][mode];

  return (
    <header className="h-16 border-b border-border bg-card/50 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-sm font-semibold text-text-primary">{title}</h1>
      <div className="flex items-center gap-2">
        <Select value={client} onChange={setClient} options={clients} />
        <Select value={campaign} onChange={setCampaign} options={campaignOpts} />
        {mode === "ecommerce" && (
          <Select value={product} onChange={setProduct} options={products} />
        )}
        <Select value={period} onChange={setPeriod} options={periods} />
      </div>
    </header>
  );
}
