"use client";
import Image from "next/image";
import { Play, Image as ImageIcon, LayoutGrid, Layers, ExternalLink, TrendingUp, AlertTriangle, FlaskConical, Clock } from "lucide-react";
import type { CreativeRow } from "@/lib/types";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
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
const platformColors: Record<string, string> = {
  meta:   "text-blue border-blue/30 bg-blue/10",
  google: "text-gold border-gold/30 bg-gold/10",
};

// ─── Decision badge ────────────────────────────────────────────────────────────
type Decision = "escalar" | "otimizar" | "pausar" | "aguardar";

function getDecision(c: CreativeRow): Decision {
  const MIN_SPEND = 200; // R$ mínimo para ter dados confiáveis
  if (c.spend < MIN_SPEND) return "aguardar";
  if (c.roas >= 4)  return "escalar";
  if (c.roas >= 2)  return "otimizar";
  return "pausar";
}

const decisionConfig: Record<Decision, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  escalar:  { label: "Escalar",  icon: TrendingUp,    color: "text-accent", bg: "bg-accent/10 border-accent/30" },
  otimizar: { label: "Otimizar", icon: FlaskConical,  color: "text-gold",   bg: "bg-gold/10 border-gold/30" },
  pausar:   { label: "Pausar",   icon: AlertTriangle, color: "text-red",    bg: "bg-red/10 border-red/30" },
  aguardar: { label: "Aguardar", icon: Clock,         color: "text-text-muted", bg: "bg-card border-border" },
};

// ─── Frequency warning ─────────────────────────────────────────────────────────
function FrequencyBadge({ freq }: { freq: number | null }) {
  if (freq === null) return null;
  const color = freq >= 4.5 ? "text-red" : freq >= 3.5 ? "text-gold" : "text-text-muted";
  const label = freq >= 4.5 ? "Fadiga alta" : freq >= 3.5 ? "Atenção" : null;
  return (
    <span className={`text-[10px] font-mono ${color}`} title="Frequência média">
      {freq.toFixed(1)}× freq{label ? ` · ${label}` : ""}
    </span>
  );
}

interface Props {
  creative: CreativeRow;
}

export default function CreativeCard({ creative: c }: Props) {
  const TypeIcon   = c.creative_type ? typeIcon[c.creative_type] : ImageIcon;
  const roasColor  = c.roas >= 4.5 ? "text-accent" : c.roas >= 3 ? "text-gold" : "text-red";
  const decision   = getDecision(c);
  const dCfg       = decisionConfig[decision];
  const DIcon      = dCfg.icon;

  const openLink = () => {
    const url = c.permalink_url ?? c.video_url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  const hasLink = !!(c.permalink_url ?? c.video_url);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-border-light transition-colors flex flex-col">
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-bg flex items-center justify-center overflow-hidden flex-shrink-0">
        {c.thumbnail_url ? (
          <Image
            src={c.thumbnail_url}
            alt={c.ad_name}
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

        {/* Top-left: type badge */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border backdrop-blur-sm ${platformColors[c.platform] ?? ""}`}>
            <TypeIcon size={9} />
            {c.creative_type ? typeLabel[c.creative_type] : "—"}
          </span>
        </div>

        {/* Top-right: decision badge */}
        <div className="absolute top-2 right-2">
          <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border backdrop-blur-sm ${dCfg.bg} ${dCfg.color}`}>
            <DIcon size={9} />
            {dCfg.label}
          </span>
        </div>

        {/* Play overlay for videos */}
        {c.creative_type === "video" && c.thumbnail_url && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center">
              <Play size={16} className="text-white ml-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Name + link button */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-primary truncate" title={c.ad_name}>
              {c.ad_name}
            </p>
            {c.headline && (
              <p className="text-[11px] text-text-secondary truncate mt-0.5 italic" title={c.headline}>
                "{c.headline}"
              </p>
            )}
            <p className="text-[11px] text-text-muted truncate mt-0.5" title={c.campaign_name ?? ""}>
              {c.campaign_name ?? "—"}
            </p>
          </div>
          <button
            onClick={openLink}
            disabled={!hasLink}
            title={hasLink ? "Abrir criativo" : "Link não disponível ainda"}
            className={`flex-shrink-0 p-1.5 rounded-lg border transition-colors ${
              hasLink
                ? "border-border text-text-secondary hover:text-accent hover:border-accent/40"
                : "border-border/40 text-text-dark cursor-not-allowed"
            }`}
          >
            <ExternalLink size={12} />
          </button>
        </div>

        {/* Primary metrics */}
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Invest."   value={fmtMoney(c.spend)}            color="text-blue"   />
          <Metric label="Receita"   value={fmtMoney(c.revenue)}          color="text-accent" />
          <Metric label="ROAS"      value={`${c.roas.toFixed(2)}×`}      color={roasColor}   />
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="CPA"       value={c.cpa > 0 ? `R$${c.cpa.toFixed(0)}` : "—"}   color="text-gold" />
          <Metric label="CTR"       value={`${c.ctr.toFixed(1)}%`}                        color="text-text-secondary" />
          <Metric label="CPM"       value={c.cpm > 0 ? `R$${c.cpm.toFixed(0)}` : "—"}   color="text-text-secondary" />
        </div>

        {/* Tertiary: conv rate + video metrics or frequency */}
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="Conv.%"    value={c.conv_rate > 0 ? `${c.conv_rate.toFixed(1)}%` : "—"} color="text-text-secondary" />
          {c.video_3s_rate !== null
            ? <Metric label="Hook"  value={`${c.video_3s_rate.toFixed(0)}%`}           color={c.video_3s_rate >= 30 ? "text-accent" : "text-gold"} />
            : <Metric label="Cliq." value={fmt(c.clicks)}                              color="text-text-secondary" />
          }
          {c.video_thruplay_rate !== null
            ? <Metric label="Hold"  value={`${c.video_thruplay_rate.toFixed(0)}%`}     color={c.video_thruplay_rate >= 20 ? "text-accent" : "text-gold"} />
            : <Metric label="Imp."  value={fmt(c.impressions)}                         color="text-text-secondary" />
          }
        </div>

        {/* Frequency warning */}
        {c.frequency !== null && (
          <div className="pt-1 border-t border-border">
            <FrequencyBadge freq={c.frequency} />
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-bg rounded-lg p-1.5 text-center">
      <div className="text-[9px] text-text-muted mb-0.5 uppercase tracking-wide">{label}</div>
      <div className={`text-xs font-mono font-semibold ${color}`}>{value}</div>
    </div>
  );
}
