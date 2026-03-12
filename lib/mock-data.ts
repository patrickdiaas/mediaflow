export type Mode = "lead-gen" | "ecommerce";
export type Platform = "meta" | "google";

export interface KPIData {
  investimento: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  connectRate: number;
  leadsPlataforma: number;
  leadsCRM: number;
  vendas: number;
  roas: number;
  cplReal: number;
  lpvCliques: number;
}

export interface TrendPoint {
  date: string;
  investimento: number;
  leads: number;
  cliques: number;
  impressoes: number;
  vendas?: number;
  roas?: number;
  cpl?: number;
}

export interface Campaign {
  id: string;
  nome: string;
  status: "ativa" | "pausada" | "encerrada";
  investimento: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number;
  vendas?: number;
  roas?: number;
}

export interface Creative {
  id: string;
  nome: string;
  tipo: "imagem" | "video" | "carrossel";
  campanha: string;
  impressoes: number;
  cliques: number;
  ctr: number;
  leads: number;
  cpl: number;
  gasto: number;
}

export interface Keyword {
  id: string;
  termo: string;
  correspondencia: "exata" | "frase" | "ampla";
  campanha: string;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number;
  gasto: number;
}

export interface Sale {
  id: string;
  produto: string;
  campanha: string;
  data: string;
  valor: number;
  roas: number;
  gasto: number;
  conversoes: number;
  ticketMedio: number;
}

// ─── KPI DATA ─────────────────────────────────────────────────────────────────
export const kpiData: Record<Platform, Record<Mode, KPIData>> = {
  meta: {
    "lead-gen": {
      investimento: 48320,
      impressoes: 1248000,
      cliques: 18640,
      ctr: 1.49,
      cpc: 2.59,
      connectRate: 42.3,
      leadsPlataforma: 7886,
      leadsCRM: 6109,
      vendas: 0,
      roas: 0,
      cplReal: 7.91,
      lpvCliques: 7886,
    },
    ecommerce: {
      investimento: 72480,
      impressoes: 2100000,
      cliques: 32400,
      ctr: 1.54,
      cpc: 2.24,
      connectRate: 38.1,
      leadsPlataforma: 0,
      leadsCRM: 0,
      vendas: 1840,
      roas: 4.2,
      cplReal: 0,
      lpvCliques: 12344,
    },
  },
  google: {
    "lead-gen": {
      investimento: 36100,
      impressoes: 820000,
      cliques: 24300,
      ctr: 2.96,
      cpc: 1.49,
      connectRate: 51.2,
      leadsPlataforma: 12441,
      leadsCRM: 9840,
      vendas: 0,
      roas: 0,
      cplReal: 3.67,
      lpvCliques: 12441,
    },
    ecommerce: {
      investimento: 58200,
      impressoes: 1540000,
      cliques: 41200,
      ctr: 2.68,
      cpc: 1.41,
      connectRate: 44.7,
      leadsPlataforma: 0,
      leadsCRM: 0,
      vendas: 3120,
      roas: 6.8,
      cplReal: 0,
      lpvCliques: 18416,
    },
  },
};

// ─── TREND DATA ───────────────────────────────────────────────────────────────
const days = ["01/01", "02/01", "03/01", "04/01", "05/01", "06/01", "07/01", "08/01", "09/01", "10/01", "11/01", "12/01", "13/01", "14/01", "15/01", "16/01", "17/01", "18/01", "19/01", "20/01", "21/01", "22/01", "23/01", "24/01", "25/01", "26/01", "27/01", "28/01", "29/01", "30/01"];

function randomNear(base: number, variance: number) {
  return Math.round(base + (Math.random() - 0.5) * 2 * variance);
}

export const trendData: Record<Platform, Record<Mode, TrendPoint[]>> = {
  meta: {
    "lead-gen": days.map((date) => ({
      date,
      investimento: randomNear(1600, 400),
      leads: randomNear(260, 60),
      cliques: randomNear(620, 100),
      impressoes: randomNear(41600, 8000),
      cpl: randomNear(8, 2),
    })),
    ecommerce: days.map((date) => ({
      date,
      investimento: randomNear(2400, 600),
      leads: 0,
      cliques: randomNear(1080, 200),
      impressoes: randomNear(70000, 15000),
      vendas: randomNear(61, 15),
      roas: parseFloat((3.8 + Math.random() * 1.2).toFixed(2)),
    })),
  },
  google: {
    "lead-gen": days.map((date) => ({
      date,
      investimento: randomNear(1200, 300),
      leads: randomNear(414, 80),
      cliques: randomNear(810, 150),
      impressoes: randomNear(27300, 6000),
      cpl: randomNear(4, 1),
    })),
    ecommerce: days.map((date) => ({
      date,
      investimento: randomNear(1940, 400),
      leads: 0,
      cliques: randomNear(1373, 250),
      impressoes: randomNear(51333, 10000),
      vendas: randomNear(104, 20),
      roas: parseFloat((6.0 + Math.random() * 1.5).toFixed(2)),
    })),
  },
};

// ─── CAMPAIGNS ────────────────────────────────────────────────────────────────
export const campaigns: Record<Platform, Record<Mode, Campaign[]>> = {
  meta: {
    "lead-gen": [
      { id: "1", nome: "Prospecção - Lookalike 2%", status: "ativa", investimento: 12480, impressoes: 320000, cliques: 4800, ctr: 1.50, cpc: 2.60, leads: 2032, cpl: 6.14 },
      { id: "2", nome: "Remarketing - Visitantes 30d", status: "ativa", investimento: 8940, impressoes: 180000, cliques: 3600, ctr: 2.00, cpc: 2.48, leads: 1782, cpl: 5.02 },
      { id: "3", nome: "Interesses - Concorrentes", status: "ativa", investimento: 15200, impressoes: 510000, cliques: 6200, ctr: 1.22, cpc: 2.45, leads: 2440, cpl: 6.23 },
      { id: "4", nome: "Broad - Criativo Novo", status: "pausada", investimento: 7300, impressoes: 140000, cliques: 2800, ctr: 2.00, cpc: 2.61, leads: 920, cpl: 7.93 },
      { id: "5", nome: "Retargeting - Engajamento", status: "ativa", investimento: 4400, impressoes: 98000, cliques: 1240, ctr: 1.27, cpc: 3.55, leads: 712, cpl: 6.18 },
    ],
    ecommerce: [
      { id: "1", nome: "Conversão - Carrinho Abandonado", status: "ativa", investimento: 18200, impressoes: 420000, cliques: 7400, ctr: 1.76, cpc: 2.46, leads: 0, cpl: 0, vendas: 420, roas: 4.8 },
      { id: "2", nome: "Prospecção - Lookalike 1%", status: "ativa", investimento: 24300, impressoes: 840000, cliques: 12000, ctr: 1.43, cpc: 2.03, leads: 0, cpl: 0, vendas: 680, roas: 3.9 },
      { id: "3", nome: "Catálogo - Dinâmico", status: "ativa", investimento: 16400, impressoes: 580000, cliques: 8600, ctr: 1.48, cpc: 1.91, leads: 0, cpl: 0, vendas: 520, roas: 4.6 },
      { id: "4", nome: "Upsell - Compradores 90d", status: "pausada", investimento: 9200, impressoes: 180000, cliques: 3200, ctr: 1.78, cpc: 2.88, leads: 0, cpl: 0, vendas: 180, roas: 3.2 },
      { id: "5", nome: "Remarketing - Visualizações", status: "ativa", investimento: 4380, impressoes: 80000, cliques: 1200, ctr: 1.50, cpc: 3.65, leads: 0, cpl: 0, vendas: 40, roas: 5.1 },
    ],
  },
  google: {
    "lead-gen": [
      { id: "1", nome: "Search - Marca", status: "ativa", investimento: 8200, impressoes: 120000, cliques: 6400, ctr: 5.33, cpc: 1.28, leads: 3200, cpl: 2.56 },
      { id: "2", nome: "Search - Concorrentes", status: "ativa", investimento: 10400, impressoes: 280000, cliques: 7200, ctr: 2.57, cpc: 1.44, leads: 3600, cpl: 2.89 },
      { id: "3", nome: "Search - Genérico", status: "ativa", investimento: 12000, impressoes: 320000, cliques: 7400, ctr: 2.31, cpc: 1.62, leads: 4200, cpl: 2.86 },
      { id: "4", nome: "PMAX - Leads", status: "ativa", investimento: 5500, impressoes: 100000, cliques: 3300, ctr: 3.30, cpc: 1.67, leads: 1441, cpl: 3.82 },
    ],
    ecommerce: [
      { id: "1", nome: "Shopping - Produtos Top", status: "ativa", investimento: 18000, impressoes: 480000, cliques: 14400, ctr: 3.00, cpc: 1.25, leads: 0, cpl: 0, vendas: 1040, roas: 7.2 },
      { id: "2", nome: "Search - Produto + Marca", status: "ativa", investimento: 14200, impressoes: 320000, cliques: 10400, ctr: 3.25, cpc: 1.37, leads: 0, cpl: 0, vendas: 880, roas: 6.4 },
      { id: "3", nome: "PMAX - Conversões", status: "ativa", investimento: 16000, impressoes: 420000, cliques: 11200, ctr: 2.67, cpc: 1.43, leads: 0, cpl: 0, vendas: 840, roas: 6.5 },
      { id: "4", nome: "Display - Remarketing", status: "pausada", investimento: 10000, impressoes: 320000, cliques: 5200, ctr: 1.63, cpc: 1.92, leads: 0, cpl: 0, vendas: 360, roas: 6.8 },
    ],
  },
};

// ─── CREATIVES ────────────────────────────────────────────────────────────────
export const creatives: Record<Platform, Record<Mode, Creative[]>> = {
  meta: {
    "lead-gen": [
      { id: "1", nome: "Video_Depoimento_30s_V1", tipo: "video", campanha: "Prospecção - Lookalike 2%", impressoes: 140000, cliques: 2400, ctr: 1.71, leads: 880, cpl: 5.20, gasto: 4576 },
      { id: "2", nome: "Imagem_Oferta_BlackFriday", tipo: "imagem", campanha: "Interesses - Concorrentes", impressoes: 98000, cliques: 1820, ctr: 1.86, leads: 742, cpl: 6.10, gasto: 4526 },
      { id: "3", nome: "Carrossel_Beneficios_V2", tipo: "carrossel", campanha: "Remarketing - Visitantes 30d", impressoes: 72000, cliques: 1560, ctr: 2.17, leads: 680, cpl: 4.80, gasto: 3264 },
      { id: "4", nome: "Video_Produto_Demo_15s", tipo: "video", campanha: "Broad - Criativo Novo", impressoes: 55000, cliques: 1100, ctr: 2.00, leads: 420, cpl: 7.40, gasto: 3108 },
      { id: "5", nome: "Imagem_Prova_Social_V3", tipo: "imagem", campanha: "Prospecção - Lookalike 2%", impressoes: 110000, cliques: 1980, ctr: 1.80, leads: 760, cpl: 6.50, gasto: 4940 },
    ],
    ecommerce: [
      { id: "1", nome: "Video_Unboxing_60s", tipo: "video", campanha: "Conversão - Carrinho Abandonado", impressoes: 180000, cliques: 3200, ctr: 1.78, leads: 0, cpl: 0, gasto: 6200 },
      { id: "2", nome: "Carrossel_Produtos_Top", tipo: "carrossel", campanha: "Prospecção - Lookalike 1%", impressoes: 240000, cliques: 4800, ctr: 2.00, leads: 0, cpl: 0, gasto: 9600 },
      { id: "3", nome: "Imagem_Desconto_30pct", tipo: "imagem", campanha: "Catálogo - Dinâmico", impressoes: 160000, cliques: 2800, ctr: 1.75, leads: 0, cpl: 0, gasto: 5280 },
      { id: "4", nome: "Video_Testemunho_Cliente", tipo: "video", campanha: "Upsell - Compradores 90d", impressoes: 90000, cliques: 1600, ctr: 1.78, leads: 0, cpl: 0, gasto: 3840 },
    ],
  },
  google: {
    "lead-gen": [
      { id: "1", nome: "Anuncio_Responsivo_Marca_V1", tipo: "imagem", campanha: "Search - Marca", impressoes: 60000, cliques: 3200, ctr: 5.33, leads: 1600, cpl: 2.80, gasto: 4480 },
      { id: "2", nome: "Anuncio_RSA_Concorrentes_V2", tipo: "imagem", campanha: "Search - Concorrentes", impressoes: 140000, cliques: 3600, ctr: 2.57, leads: 1800, cpl: 3.10, gasto: 5580 },
      { id: "3", nome: "Anuncio_Generico_Pain_V1", tipo: "imagem", campanha: "Search - Genérico", impressoes: 160000, cliques: 3700, ctr: 2.31, leads: 2100, cpl: 2.90, gasto: 6090 },
    ],
    ecommerce: [
      { id: "1", nome: "Shopping_Smart_TopProdutos", tipo: "imagem", campanha: "Shopping - Produtos Top", impressoes: 240000, cliques: 7200, ctr: 3.00, leads: 0, cpl: 0, gasto: 8400 },
      { id: "2", nome: "RSA_BrandSearch_V3", tipo: "imagem", campanha: "Search - Produto + Marca", impressoes: 160000, cliques: 5200, ctr: 3.25, leads: 0, cpl: 0, gasto: 6240 },
      { id: "3", nome: "PMAX_Asset_Group_A", tipo: "imagem", campanha: "PMAX - Conversões", impressoes: 210000, cliques: 5600, ctr: 2.67, leads: 0, cpl: 0, gasto: 7200 },
    ],
  },
};

// ─── KEYWORDS ─────────────────────────────────────────────────────────────────
export const keywords: Record<Mode, Keyword[]> = {
  "lead-gen": [
    { id: "1", termo: "software de gestão empresarial", correspondencia: "exata", campanha: "Search - Genérico", impressoes: 42000, cliques: 2100, ctr: 5.00, cpc: 1.20, leads: 980, cpl: 2.57, gasto: 2520 },
    { id: "2", termo: "sistema erp pequena empresa", correspondencia: "frase", campanha: "Search - Genérico", impressoes: 38000, cliques: 1800, ctr: 4.74, cpc: 1.35, leads: 820, cpl: 2.96, gasto: 2430 },
    { id: "3", termo: "[nome concorrente] alternativa", correspondencia: "exata", campanha: "Search - Concorrentes", impressoes: 28000, cliques: 1680, ctr: 6.00, cpc: 1.55, leads: 780, cpl: 3.34, gasto: 2604 },
    { id: "4", termo: "gestão financeira empresas", correspondencia: "ampla", campanha: "Search - Genérico", impressoes: 62000, cliques: 1860, ctr: 3.00, cpc: 1.72, leads: 740, cpl: 4.33, gasto: 3200 },
    { id: "5", termo: "crm vendas b2b", correspondencia: "frase", campanha: "Search - Genérico", impressoes: 31000, cliques: 1240, ctr: 4.00, cpc: 1.41, leads: 560, cpl: 3.13, gasto: 1748 },
    { id: "6", termo: "automatizar processos empresa", correspondencia: "ampla", campanha: "Search - Genérico", impressoes: 44000, cliques: 1320, ctr: 3.00, cpc: 1.62, leads: 520, cpl: 4.12, gasto: 2139 },
  ],
  ecommerce: [
    { id: "1", termo: "comprar [produto]", correspondencia: "exata", campanha: "Search - Produto + Marca", impressoes: 56000, cliques: 3360, ctr: 6.00, cpc: 1.10, leads: 0, cpl: 0, gasto: 3696 },
    { id: "2", termo: "[produto] melhor preço", correspondencia: "frase", campanha: "Shopping - Produtos Top", impressoes: 48000, cliques: 2400, ctr: 5.00, cpc: 1.25, leads: 0, cpl: 0, gasto: 3000 },
    { id: "3", termo: "[produto] frete grátis", correspondencia: "exata", campanha: "Search - Produto + Marca", impressoes: 36000, cliques: 2160, ctr: 6.00, cpc: 1.32, leads: 0, cpl: 0, gasto: 2851 },
    { id: "4", termo: "[produto] online", correspondencia: "ampla", campanha: "PMAX - Conversões", impressoes: 82000, cliques: 2460, ctr: 3.00, cpc: 1.48, leads: 0, cpl: 0, gasto: 3641 },
    { id: "5", termo: "[marca] oficial", correspondencia: "exata", campanha: "Search - Produto + Marca", impressoes: 24000, cliques: 1680, ctr: 7.00, cpc: 1.05, leads: 0, cpl: 0, gasto: 1764 },
  ],
};

// ─── SALES ────────────────────────────────────────────────────────────────────
export const sales: Record<Platform, Sale[]> = {
  meta: [
    { id: "1", produto: "Plano Pro Anual", campanha: "Conversão - Carrinho Abandonado", data: "30/01/2025", valor: 89760, roas: 4.93, gasto: 18200, conversoes: 420, ticketMedio: 213.71 },
    { id: "2", produto: "Plano Starter", campanha: "Prospecção - Lookalike 1%", data: "30/01/2025", valor: 94770, roas: 3.90, gasto: 24300, conversoes: 680, ticketMedio: 139.37 },
    { id: "3", produto: "Plano Enterprise", campanha: "Catálogo - Dinâmico", data: "30/01/2025", valor: 75520, roas: 4.61, gasto: 16400, conversoes: 520, ticketMedio: 145.23 },
    { id: "4", produto: "Plano Pro Mensal", campanha: "Upsell - Compradores 90d", data: "30/01/2025", valor: 29440, roas: 3.20, gasto: 9200, conversoes: 180, ticketMedio: 163.56 },
    { id: "5", produto: "Add-on Premium", campanha: "Remarketing - Visualizações", data: "30/01/2025", valor: 13960, roas: 5.10, gasto: 4380, conversoes: 40, ticketMedio: 349.00 },
  ],
  google: [
    { id: "1", produto: "Plano Pro Anual", campanha: "Shopping - Produtos Top", data: "30/01/2025", valor: 129600, roas: 7.20, gasto: 18000, conversoes: 1040, ticketMedio: 124.62 },
    { id: "2", produto: "Plano Starter", campanha: "Search - Produto + Marca", data: "30/01/2025", valor: 90880, roas: 6.40, gasto: 14200, conversoes: 880, ticketMedio: 103.27 },
    { id: "3", produto: "Plano Enterprise", campanha: "PMAX - Conversões", data: "30/01/2025", valor: 104000, roas: 6.50, gasto: 16000, conversoes: 840, ticketMedio: 123.81 },
    { id: "4", produto: "Add-on Premium", campanha: "Display - Remarketing", data: "30/01/2025", valor: 68000, roas: 6.80, gasto: 10000, conversoes: 360, ticketMedio: 188.89 },
  ],
};

export const clients = ["Todos os Clientes", "TechCorp Brasil", "Inova Solutions", "MaxVendas"];
export const campaignNames: Record<Platform, Record<Mode, string[]>> = {
  meta: {
    "lead-gen": ["Todas", "Prospecção - Lookalike 2%", "Remarketing - Visitantes 30d", "Interesses - Concorrentes"],
    ecommerce: ["Todas", "Conversão - Carrinho Abandonado", "Prospecção - Lookalike 1%", "Catálogo - Dinâmico"],
  },
  google: {
    "lead-gen": ["Todas", "Search - Marca", "Search - Concorrentes", "Search - Genérico"],
    ecommerce: ["Todas", "Shopping - Produtos Top", "Search - Produto + Marca", "PMAX - Conversões"],
  },
};
export const products = ["Todos", "Plano Pro Anual", "Plano Starter", "Plano Enterprise", "Add-on Premium"];
export const periods = ["Últimos 7 dias", "Últimos 14 dias", "Últimos 30 dias", "Este mês", "Mês anterior"];
