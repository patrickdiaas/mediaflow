"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import DataTable, { Column } from "@/components/data-table";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/lib/supabase";
import { getPeriodDates, getSalesDates } from "@/lib/period";
import type { KeywordRow, SearchTermRow } from "@/lib/types";
import { AlertCircle, Search, Tag } from "lucide-react";

// ─── Badge de match type ───────────────────────────────────────────────────────

const matchTypeLabel: Record<string, string> = {
  EXACT:  "Exata",
  PHRASE: "Frase",
  BROAD:  "Ampla",
};
const matchTypeColor: Record<string, string> = {
  EXACT:  "text-accent border-accent/30 bg-accent/10",
  PHRASE: "text-gold border-gold/30 bg-gold/10",
  BROAD:  "text-blue border-blue/30 bg-blue/10",
};

function MatchBadge({ type }: { type: string }) {
  const label = matchTypeLabel[type] ?? type;
  const color = matchTypeColor[type] ?? "text-text-muted border-border bg-card";
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${color}`}>
      {label}
    </span>
  );
}

// ─── Colunas da tabela de keywords ────────────────────────────────────────────

const roasColor = (v: number) =>
  v >= 4.5 ? "text-accent" : v >= 3 ? "text-gold" : "text-red";

const keywordColumns: Column<KeywordRow>[] = [
  {
    key: "keyword_text",
    label: "Palavra-chave",
    render: (v, row) => (
      <div className="flex items-center gap-2">
        <Tag size={12} className="text-text-muted flex-shrink-0" />
        <div>
          <div className="text-sm text-text-primary">{String(v)}</div>
          <div className="text-xs text-text-muted mt-0.5">{row.ad_group_name} · {row.campaign_name}</div>
        </div>
      </div>
    ),
  },
  {
    key: "match_type",
    label: "Tipo",
    render: v => <MatchBadge type={String(v)} />,
  },
  { key: "impressions", label: "Impressões", align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "clicks",      label: "Cliques",    align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "ctr",         label: "CTR",        align: "right",
    render: v => <span className="text-text-secondary">{Number(v).toFixed(1)}%</span> },
  { key: "spend",       label: "Investido",  align: "right",
    render: v => <span className="text-blue">R$ {Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span> },
  { key: "revenue",     label: "Receita",    align: "right",
    render: v => <span className="text-accent">R$ {Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span> },
  { key: "roas",        label: "ROAS",       align: "right",
    render: v => <span className={`font-semibold ${roasColor(Number(v))}`}>{Number(v).toFixed(2)}×</span> },
  { key: "sales",       label: "Vendas",     align: "right",
    render: v => <span className="text-gold font-mono">{Number(v)}</span> },
  { key: "cpa",         label: "CPA",        align: "right",
    render: v => Number(v) > 0 ? <span className="text-gold">R$ {Number(v).toFixed(2)}</span> : <span className="text-text-muted">—</span> },
];

// ─── Colunas da tabela de termos de pesquisa ──────────────────────────────────

const searchTermColumns: Column<SearchTermRow>[] = [
  {
    key: "search_term",
    label: "Termo de pesquisa",
    render: (v, row) => (
      <div className="flex items-center gap-2">
        <Search size={12} className="text-text-muted flex-shrink-0" />
        <div>
          <div className="text-sm text-text-primary">{String(v)}</div>
          {row.keyword_text && (
            <div className="text-xs text-text-muted mt-0.5">
              Keyword: <span className="font-mono">{row.keyword_text}</span>
            </div>
          )}
        </div>
      </div>
    ),
  },
  { key: "campaign_name", label: "Campanha",   render: v => <span className="text-xs text-text-secondary">{String(v)}</span> },
  { key: "ad_group_name", label: "Conjunto",   render: v => <span className="text-xs text-text-secondary">{String(v)}</span> },
  { key: "impressions",   label: "Impressões", align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "clicks",        label: "Cliques",    align: "right",
    render: v => Number(v).toLocaleString("pt-BR") },
  { key: "ctr",           label: "CTR",        align: "right",
    render: v => <span className="text-text-secondary">{Number(v).toFixed(1)}%</span> },
  { key: "spend",         label: "Investido",  align: "right",
    render: v => <span className="text-blue">R$ {Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span> },
  { key: "conversions",   label: "Conv. Google", align: "right",
    render: v => <span className="text-gold font-mono">{Number(v).toFixed(1)}</span> },
];

// ─── Página principal ─────────────────────────────────────────────────────────

type Tab = "keywords" | "search_terms";

export default function PalavrasChavePage() {
  const { platform, period, client } = useDashboard();
  const [tab, setTab] = useState<Tab>("keywords");
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [searchTerms, setSearchTerms] = useState<SearchTermRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<{ slug: string; sales_slug: string | null }[]>([]);

  useEffect(() => {
    supabase.from("clients").select("slug, sales_slug").eq("active", true)
      .then(({ data }) => { if (data) setClients(data); });
  }, []);

  useEffect(() => {
    if (platform === "meta") return; // nada a buscar para Meta

    const { since, until } = getPeriodDates(period);
    const { since: salesSince, until: salesUntil } = getSalesDates(period);
    setLoading(true);

    const metaSlug  = client !== "all" ? client : null;
    const found     = clients.find(c => c.slug === client);
    const salesSlug = client !== "all" ? (found?.sales_slug ?? client) : null;

    // ── Keywords do Google Ads ────────────────────────────────────────────────
    const kBase = supabase
      .from("keywords")
      .select("client_slug,campaign_name,ad_group_name,keyword_id,keyword_text,match_type,impressions,clicks,spend,conversions")
      .gte("date", since).lte("date", until)
      .eq("platform", "google");
    const kQuery = metaSlug ? kBase.eq("client_slug", metaSlug) : kBase;

    // ── Termos de pesquisa ─────────────────────────────────────────────────────
    const stBase = supabase
      .from("search_terms")
      .select("client_slug,campaign_name,ad_group_name,keyword_text,search_term,match_type,impressions,clicks,spend,conversions")
      .gte("date", since).lte("date", until)
      .eq("platform", "google");
    const stQuery = metaSlug ? stBase.eq("client_slug", metaSlug) : stBase;

    // ── Vendas aprovadas com utm_term (para crossref de revenue por keyword) — janela BRT ──
    const salesBase = supabase
      .from("sales")
      .select("amount, utm_term, utm_source")
      .eq("status", "approved")
      .eq("sale_type", "main")
      .gte("created_at", salesSince)
      .lte("created_at", salesUntil)
      .ilike("utm_source", "%google%");
    const salesQuery = salesSlug ? salesBase.eq("client_slug", salesSlug) : salesBase;

    Promise.all([kQuery, stQuery, salesQuery]).then(
      ([{ data: kRows }, { data: stRows }, { data: salesData }]) => {
        setLoading(false);

        // Constrói mapa utm_term → { sales, revenue }
        const byUtmTerm = new Map<string, { sales: number; revenue: number }>();
        for (const s of salesData ?? []) {
          if (!s.utm_term) continue;
          const key = s.utm_term.toLowerCase().trim();
          const e = byUtmTerm.get(key) ?? { sales: 0, revenue: 0 };
          e.sales++;
          e.revenue += Number(s.amount);
          byUtmTerm.set(key, e);
        }

        // ── Agrega keywords por keyword_id (múltiplos dias) ───────────────────
        if (kRows && kRows.length > 0) {
          const kMap = new Map<string, { impressions: number; clicks: number; spend: number; conversions: number; campaign_name: string; ad_group_name: string; keyword_text: string; match_type: string }>();
          for (const r of kRows) {
            const key = r.keyword_id;
            const ex  = kMap.get(key);
            if (ex) {
              ex.impressions  += r.impressions ?? 0;
              ex.clicks       += r.clicks ?? 0;
              ex.spend        += Number(r.spend ?? 0);
              ex.conversions  += Number(r.conversions ?? 0);
            } else {
              kMap.set(key, {
                impressions:  r.impressions ?? 0,
                clicks:       r.clicks ?? 0,
                spend:        Number(r.spend ?? 0),
                conversions:  Number(r.conversions ?? 0),
                campaign_name: r.campaign_name ?? "",
                ad_group_name: r.ad_group_name ?? "",
                keyword_text:  r.keyword_text ?? "",
                match_type:    r.match_type ?? "",
              });
            }
          }
          setKeywords(
            Array.from(kMap.entries()).map(([keyword_id, agg]) => {
              const sv = byUtmTerm.get(agg.keyword_text.toLowerCase().trim()) ?? { sales: 0, revenue: 0 };
              return {
                keyword_id,
                keyword_text:  agg.keyword_text,
                match_type:    agg.match_type,
                campaign_name: agg.campaign_name,
                ad_group_name: agg.ad_group_name,
                impressions:   agg.impressions,
                clicks:        agg.clicks,
                ctr:           agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
                spend:         agg.spend,
                revenue:       sv.revenue,
                sales:         sv.sales,
                roas:          agg.spend > 0 ? sv.revenue / agg.spend : 0,
                cpa:           sv.sales > 0 ? agg.spend / sv.sales : 0,
                conversions:   agg.conversions,
              };
            }).sort((a, b) => b.spend - a.spend)
          );
        } else {
          setKeywords([]);
        }

        // ── Agrega search terms ────────────────────────────────────────────────
        if (stRows && stRows.length > 0) {
          const stMap = new Map<string, { impressions: number; clicks: number; spend: number; conversions: number; campaign_name: string; ad_group_name: string; keyword_text: string; match_type: string }>();
          for (const r of stRows) {
            const key = `${r.campaign_name}::${r.ad_group_name}::${r.search_term}`;
            const ex  = stMap.get(key);
            if (ex) {
              ex.impressions += r.impressions ?? 0;
              ex.clicks      += r.clicks ?? 0;
              ex.spend       += Number(r.spend ?? 0);
              ex.conversions += Number(r.conversions ?? 0);
            } else {
              stMap.set(key, {
                impressions:  r.impressions ?? 0,
                clicks:       r.clicks ?? 0,
                spend:        Number(r.spend ?? 0),
                conversions:  Number(r.conversions ?? 0),
                campaign_name: r.campaign_name ?? "",
                ad_group_name: r.ad_group_name ?? "",
                keyword_text:  r.keyword_text ?? "",
                match_type:    r.match_type ?? "",
              });
            }
          }
          setSearchTerms(
            Array.from(stMap.entries()).map(([key, agg]) => {
              const search_term = key.split("::")[2];
              return {
                search_term,
                keyword_text:  agg.keyword_text,
                campaign_name: agg.campaign_name,
                ad_group_name: agg.ad_group_name,
                impressions:   agg.impressions,
                clicks:        agg.clicks,
                ctr:           agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
                spend:         agg.spend,
                conversions:   agg.conversions,
              };
            }).sort((a, b) => b.clicks - a.clicks)
          );
        } else {
          setSearchTerms([]);
        }
      }
    );
  }, [platform, period, client, clients]);

  // Página não disponível para Meta
  if (platform === "meta") {
    return (
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          <Header title="Palavras-chave" subtitle="Termos e performance do Google Search" />
          <div className="flex items-center gap-2 text-text-secondary text-sm mt-4">
            <AlertCircle size={16} />
            <span>Esta seção está disponível apenas para Google Ads. Selecione "google" ou "todos" no filtro de plataforma.</span>
          </div>
        </main>
      </div>
    );
  }

  const totalSpend   = keywords.reduce((s, k) => s + k.spend, 0);
  const totalRevenue = keywords.reduce((s, k) => s + k.revenue, 0);
  const totalSales   = keywords.reduce((s, k) => s + k.sales, 0);
  const avgRoas      = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Header title="Palavras-chave" subtitle="Performance por keyword e termos de pesquisa do Google Search" />

        {/* KPIs resumo */}
        {keywords.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <SummaryCard label="Keywords ativas"  value={String(keywords.length)}         color="text-text-primary" />
            <SummaryCard label="Investimento"     value={`R$ ${totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} color="text-blue" />
            <SummaryCard label="Receita (UTM)"    value={`R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} color="text-accent" />
            <SummaryCard label="ROAS médio"       value={`${avgRoas.toFixed(2)}×`}         color={avgRoas >= 4 ? "text-accent" : avgRoas >= 2 ? "text-gold" : "text-red"} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1 w-fit mb-5">
          <TabBtn active={tab === "keywords"}      onClick={() => setTab("keywords")}>
            <Tag size={13} /> Palavras-chave{keywords.length > 0 && <span className="ml-1 text-[10px] font-mono text-text-muted">({keywords.length})</span>}
          </TabBtn>
          <TabBtn active={tab === "search_terms"} onClick={() => setTab("search_terms")}>
            <Search size={13} /> Termos de pesquisa{searchTerms.length > 0 && <span className="ml-1 text-[10px] font-mono text-text-muted">({searchTerms.length})</span>}
          </TabBtn>
        </div>

        {loading ? (
          <div className="text-text-secondary text-sm py-8 text-center">Carregando...</div>
        ) : tab === "keywords" ? (
          keywords.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-text-muted">
                Receita e vendas cruzadas via <span className="font-mono">utm_term</span> nas vendas aprovadas.
                {totalSales === 0 && " Nenhuma venda com utm_term encontrada — verifique se o parâmetro está configurado no Google Ads."}
              </p>
              <DataTable<KeywordRow>
                columns={keywordColumns}
                data={keywords}
                rowKey="keyword_id"
              />
            </div>
          ) : (
            <EmptyState
              icon={<Tag size={28} className="text-text-dark" />}
              title="Nenhuma palavra-chave encontrada"
              description="Execute o sync do Google Ads para carregar os dados: POST /api/sync/google?secret=..."
            />
          )
        ) : (
          searchTerms.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-text-muted">
                Termos reais que acionaram seus anúncios. Conversões via Google Ads conversion tracking.
              </p>
              <DataTable<SearchTermRow>
                columns={searchTermColumns}
                data={searchTerms}
                rowKey="search_term"
              />
            </div>
          ) : (
            <EmptyState
              icon={<Search size={28} className="text-text-dark" />}
              title="Nenhum termo de pesquisa encontrado"
              description="Execute o sync do Google Ads para carregar os dados: POST /api/sync/google?secret=..."
            />
          )
        )}
      </main>
    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active ? "bg-border text-text-primary" : "text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className={`text-lg font-mono font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
      {icon}
      <p className="text-text-secondary text-sm font-medium">{title}</p>
      <p className="text-text-muted text-xs max-w-sm font-mono">{description}</p>
    </div>
  );
}
