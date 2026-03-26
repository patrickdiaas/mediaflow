"use client";
import Image from "next/image";
import { Play, Image as ImageIcon, LayoutGrid, Layers } from "lucide-react";
import type { CreativeRow } from "@/lib/types";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
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

const gatewayColors: Record<string, string> = {
  meta:   "text-blue border-blue/30 bg-blue/10",
  google: "text-gold border-gold/30 bg-gold/10",
};

interface Props {
  creative: CreativeRow;
}

export default function CreativeCard({ creative }: Props) {
  const TypeIcon = creative.creative_type ? typeIcon[creative.creative_type] : ImageIcon;
  const roasColor = creative.roas >= 4.5 ? "text-accent" : creative.roas >= 3 ? "text-gold" : "text-red";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-border-light transition-colors">
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-bg flex items-center justify-center overflow-hidden">
        {creative.thumbnail_url ? (
          <Image
            src={creative.thumbnail_url}
            alt={creative.ad_name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-text-muted">
            <TypeIcon size={32} />
            <span className="text-xs">Sem prévia</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${gatewayColors[creative.platform] ?? ""}`}>
            <TypeIcon size={10} />
            {creative.creative_type ? typeLabel[creative.creative_type] : "—"}
          </span>
        </div>

        {/* Play overlay for videos */}
        {creative.creative_type === "video" && creative.thumbnail_url && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center">
              <Play size={16} className="text-white ml-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs font-medium text-text-primary truncate mb-0.5" title={creative.ad_name}>
          {creative.ad_name}
        </p>
        <p className="text-[11px] text-text-muted truncate mb-3" title={creative.campaign_name ?? ""}>
          {creative.campaign_name ?? "—"}
        </p>

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <Metric label="Invest."  value={`R$${(creative.spend / 1000).toFixed(1)}k`}  color="text-blue"   />
          <Metric label="Receita"  value={`R$${(creative.revenue / 1000).toFixed(1)}k`} color="text-accent" />
          <Metric label="ROAS"     value={`${creative.roas.toFixed(2)}×`}               color={roasColor}   />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Vendas"   value={String(creative.sales)}             color="text-purple" />
          <Metric label="Cliques"  value={fmt(creative.clicks)}               color="text-text-secondary" />
          <Metric label="CTR"      value={`${creative.ctr.toFixed(1)}%`}      color="text-gold"   />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-bg rounded-lg p-2 text-center">
      <div className="text-[10px] text-text-muted mb-0.5">{label}</div>
      <div className={`text-xs font-mono font-semibold ${color}`}>{value}</div>
    </div>
  );
}
