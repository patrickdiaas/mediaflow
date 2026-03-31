"use client";
import Image from "next/image";
import { Play, Image as ImageIcon, LayoutGrid, Layers, ExternalLink, TrendingUp, AlertTriangle, FlaskConical, Clock } from "lucide-react";
import type { CreativeRow } from "@/lib/types";

function fmtMoney(n: number) {
  if (n >= 1_000) return `R$${(n / 1_000).toFixed(1)}k`;
  return `R$${n.toFixed(0)}`;
}

const typeIcon = {
  video:      Play,
  image:      ImageIcon,
  carousel:   LayoutGrid,
  collection: Layers,
};
const typeLabel = {
  video:      "Vídeo",
  image:      "Imagem",
  carousel:   "Carrossel",
  collection: "Coleção",
};

type Decision = "escalar" | "otimizar" | "pausar" | "aguardar";

function getDecision(c: CreativeRow): Decision {
  if (c.spend < 200) return "aguardar";
  if (c.roas >= 4)   return "escalar";
  if (c.roas >= 2)   return "otimizar";
  return "pausar";
}

const decisionConfig: Record<Decision, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  escalar:  { label: "Escalar",  icon: TrendingUp,    color: "text-accent", bg: "bg-accent/10 border-accent/30" },
  otimizar: { label: "Otimizar", icon: FlaskConical,  color: "text-gold",   bg: "bg-gold/10 border-gold/30"   },
  pausar:   { label: "Pausar",   icon: AlertTriangle, color: "text-red",    bg: "bg-red/10 border-red/30"      },
  aguardar: { label: "Aguardar", icon: Clock,         color: "text-text-muted", bg: "bg-card border-border"   },
};

export default function CreativeCard({ creative: c }: { creative: CreativeRow }) {
  const TypeIcon = c.creative_type ? typeIcon[c.creative_type] : ImageIcon;
  const roasColor = c.roas >= 4.5 ? "text-accent" : c.roas >= 3 ? "text-gold" : "text-red";
  const decision  = getDecision(c);
  const dCfg      = decisionConfig[decision];
  const DIcon     = dCfg.icon;
  const linkUrl   = c.permalink_url ?? c.video_url;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-border-light transition-colors flex flex-col">
      {/* Thumbnail — altura fixa menor */}
      <div className="relative w-full bg-bg flex-shrink-0 overflow-hidden" style={{ height: 140 }}>
        {c.thumbnail_url ? (
          <Image src={c.thumbnail_url} alt={c.ad_name} fill className="object-cover" sizes="320px" unoptimized />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-1.5 text-text-muted">
            <TypeIcon size={24} />
            <span className="text-[10px]">Sem prévia</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2">
          <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border backdrop-blur-sm ${c.platform === "meta" ? "text-blue border-blue/30 bg-blue/10" : "text-gold border-gold/30 bg-gold/10"}`}>
            <TypeIcon size={9} />{c.creative_type ? typeLabel[c.creative_type] : "—"}
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border backdrop-blur-sm ${dCfg.bg} ${dCfg.color}`}>
            <DIcon size={9} />{dCfg.label}
          </span>
        </div>

        {/* Play overlay */}
        {c.creative_type === "video" && c.thumbnail_url && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-black/60 border border-white/20 flex items-center justify-center">
              <Play size={12} className="text-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Link direto — overlay no canto inferior direito */}
        {linkUrl && (
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver criativo no Meta"
            className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-black/70 text-white border border-white/20 hover:bg-black/90 transition-colors"
          >
            <ExternalLink size={9} /> Ver anúncio
          </a>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex flex-col gap-2 flex-1">
        {/* Nome + campanha */}
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-primary truncate leading-snug" title={c.ad_name}>{c.ad_name}</p>
          {c.headline && (
            <p className="text-[10px] text-text-secondary truncate italic mt-0.5" title={c.headline}>"{c.headline}"</p>
          )}
          <p className="text-[10px] text-text-muted truncate mt-0.5">{c.campaign_name || "—"}</p>
        </div>

        {/* Métricas principais */}
        <div className="grid grid-cols-3 gap-1">
          <Metric label="Invest."  value={fmtMoney(c.spend)}         color="text-blue"   />
          <Metric label="Receita"  value={fmtMoney(c.revenue)}       color="text-accent" />
          <Metric label="ROAS"     value={`${c.roas.toFixed(2)}×`}   color={roasColor}   />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <Metric label="CPA"  value={c.cpa > 0 ? `R$${c.cpa.toFixed(0)}` : "—"} color="text-gold" />
          <Metric label="CTR"  value={`${c.ctr.toFixed(1)}%`}                      color="text-text-secondary" />
          <Metric label="CPM"  value={c.cpm > 0 ? `R$${c.cpm.toFixed(0)}` : "—"} color="text-text-secondary" />
        </div>

        {/* Frequência se relevante */}
        {c.frequency !== null && c.frequency >= 3.5 && (
          <div className="pt-1 border-t border-border">
            <span className={`text-[10px] font-mono ${c.frequency >= 4.5 ? "text-red" : "text-gold"}`}>
              {c.frequency.toFixed(1)}× freq · {c.frequency >= 4.5 ? "Fadiga alta" : "Atenção"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-bg rounded-md p-1 text-center">
      <div className="text-[9px] text-text-muted mb-0.5 uppercase tracking-wide">{label}</div>
      <div className={`text-[11px] font-mono font-semibold ${color}`}>{value}</div>
    </div>
  );
}
