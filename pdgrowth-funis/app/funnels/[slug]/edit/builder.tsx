"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2, Edit2, X, Save, ChevronRight, BarChart3 } from "lucide-react";

type Step    = { id: string; ordem: number; type: string; name: string };
type Variant = { id: string; step_id: string; name: string; destination_url: string; weight: number; status: string };
type Funnel  = { id: string; name: string; slug: string; status: string; clients?: { name: string } };

const STEP_TYPES = [
  { value: "sales",   label: "Página de Vendas" },
  { value: "bump",    label: "Order Bump" },
  { value: "upsell",  label: "Upsell" },
  { value: "downsell",label: "Downsell" },
  { value: "thanks",  label: "Obrigado" },
  { value: "custom",  label: "Custom" },
];

function typeColor(t: string) {
  switch (t) {
    case "sales":   return "border-accent/40 bg-accent/[0.04]";
    case "bump":    return "border-blue/40 bg-blue/[0.04]";
    case "upsell":  return "border-pop/40 bg-pop/[0.04]";
    case "downsell":return "border-gold/40 bg-gold/[0.04]";
    case "thanks":  return "border-green/40 bg-green/[0.04]";
    default:        return "border-border bg-card";
  }
}

export function Builder({ funnel, initialSteps, initialVariants }: {
  funnel: Funnel; initialSteps: Step[]; initialVariants: Variant[];
}) {
  const [steps,    setSteps]    = useState<Step[]>(initialSteps);
  const [variants, setVariants] = useState<Variant[]>(initialVariants);
  const [pending, startTransition] = useTransition();
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [editingStep,    setEditingStep]    = useState<Step | null>(null);

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const r = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j?.error ?? r.statusText);
    }
    return r.json();
  }

  async function addStep(type: string) {
    const tplName = STEP_TYPES.find(t => t.value === type)?.label ?? "Etapa";
    const j = await api<{ step: Step }>(`/api/funnels/${funnel.id}/steps`, {
      method: "POST",
      body: JSON.stringify({ type, name: tplName }),
    });
    setSteps(s => [...s, j.step]);
  }

  async function patchStep(id: string, patch: Partial<Step>) {
    await api(`/api/funnels/${funnel.id}/steps/${id}`, {
      method: "PATCH", body: JSON.stringify(patch),
    });
    setSteps(s => s.map(x => x.id === id ? { ...x, ...patch } : x));
  }

  async function deleteStep(id: string) {
    if (!confirm("Remover esta etapa e suas variantes?")) return;
    await api(`/api/funnels/${funnel.id}/steps/${id}`, { method: "DELETE" });
    setSteps(s => s.filter(x => x.id !== id));
    setVariants(v => v.filter(x => x.step_id !== id));
  }

  async function addVariant(stepId: string) {
    const letter = String.fromCharCode(65 + variants.filter(v => v.step_id === stepId).length);
    const j = await api<{ variant: Variant }>(`/api/funnels/${funnel.id}/variants`, {
      method: "POST",
      body: JSON.stringify({ step_id: stepId, name: letter, destination_url: "", weight: 0 }),
    });
    setVariants(v => [...v, j.variant]);
    setEditingVariant(j.variant);
  }

  async function patchVariant(id: string, patch: Partial<Variant>) {
    await api(`/api/funnels/${funnel.id}/variants/${id}`, {
      method: "PATCH", body: JSON.stringify(patch),
    });
    setVariants(v => v.map(x => x.id === id ? { ...x, ...patch } : x));
  }

  async function deleteVariant(id: string) {
    if (!confirm("Remover variante?")) return;
    await api(`/api/funnels/${funnel.id}/variants/${id}`, { method: "DELETE" });
    setVariants(v => v.filter(x => x.id !== id));
  }

  function variantsOf(stepId: string) {
    return variants.filter(v => v.step_id === stepId);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href={`/funnels/${funnel.slug}`} className="text-text-muted text-xs hover:text-text-secondary">← {funnel.name}</Link>
          <h1 className="text-xl font-display font-bold text-text-primary mt-1">Editar funil</h1>
          <p className="text-text-secondary text-xs">{funnel.clients?.name ?? "—"}</p>
        </div>
        <Link href={`/funnels/${funnel.slug}`}
          className="inline-flex items-center gap-1.5 border border-border bg-card px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary">
          <BarChart3 size={12} /> Métricas
        </Link>
      </div>

      {/* Canvas horizontal de steps */}
      <div className="overflow-x-auto pb-4">
        <div className="flex items-stretch gap-3 min-w-fit">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-stretch">
              <div className={`w-72 border rounded-xl flex flex-col ${typeColor(step.type)}`}>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div>
                    <div className="text-text-muted text-[10px] font-mono uppercase tracking-wider">
                      {step.ordem.toString().padStart(2, "0")} · {step.type}
                    </div>
                    <div className="text-text-primary text-sm font-semibold mt-0.5">{step.name}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditingStep(step)}
                      className="text-text-muted hover:text-text-primary p-1"><Edit2 size={12} /></button>
                    {step.ordem !== 1 && (
                      <button onClick={() => deleteStep(step.id)}
                        className="text-text-muted hover:text-red p-1"><Trash2 size={12} /></button>
                    )}
                  </div>
                </div>
                <div className="p-3 flex-1 space-y-1.5">
                  {variantsOf(step.id).length === 0 && (
                    <p className="text-text-muted text-xs text-center py-4">Sem variantes</p>
                  )}
                  {variantsOf(step.id).map(v => (
                    <button key={v.id} onClick={() => setEditingVariant(v)}
                      className="w-full text-left bg-bg border border-border rounded-lg px-3 py-2 hover:border-accent/40 transition-colors">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-text-primary text-xs font-medium">{v.name}</span>
                        <span className="text-text-muted text-[10px] font-mono">
                          {step.type === "sales" ? `${v.weight}%` : v.status}
                        </span>
                      </div>
                      {v.destination_url && (
                        <p className="text-text-muted text-[10px] font-mono truncate">{v.destination_url}</p>
                      )}
                    </button>
                  ))}
                  <button onClick={() => addVariant(step.id)}
                    className="w-full border border-dashed border-border hover:border-accent/40 rounded-lg py-1.5 text-text-muted hover:text-accent text-xs flex items-center justify-center gap-1">
                    <Plus size={11} /> Variante
                  </button>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="flex items-center text-text-muted px-1"><ChevronRight size={16} /></div>
              )}
            </div>
          ))}

          {/* Adicionar nova etapa */}
          <AddStepCard onAdd={addStep} disabled={pending} />
        </div>
      </div>

      {/* Modal de edição da variante */}
      {editingVariant && (
        <VariantEditor
          variant={editingVariant}
          step={steps.find(s => s.id === editingVariant.step_id)!}
          onClose={() => setEditingVariant(null)}
          onSave={async (patch) => { await patchVariant(editingVariant.id, patch); setEditingVariant(null); }}
          onDelete={async () => { await deleteVariant(editingVariant.id); setEditingVariant(null); }}
        />
      )}

      {editingStep && (
        <StepEditor
          step={editingStep}
          onClose={() => setEditingStep(null)}
          onSave={async (patch) => { await patchStep(editingStep.id, patch); setEditingStep(null); }}
        />
      )}
    </>
  );
}

function AddStepCard({ onAdd, disabled }: { onAdd: (t: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-48 border border-dashed border-border rounded-xl flex flex-col items-center justify-center p-4 relative">
      {!open ? (
        <button onClick={() => setOpen(true)} disabled={disabled}
          className="text-text-muted hover:text-accent text-sm inline-flex items-center gap-1.5">
          <Plus size={14} /> Adicionar etapa
        </button>
      ) : (
        <div className="space-y-1 w-full">
          {STEP_TYPES.filter(t => t.value !== "sales").map(t => (
            <button key={t.value} onClick={() => { onAdd(t.value); setOpen(false); }}
              className="w-full text-left text-xs text-text-secondary hover:text-text-primary hover:bg-card-hover rounded-lg px-2 py-1.5">
              {t.label}
            </button>
          ))}
          <button onClick={() => setOpen(false)} className="text-text-muted text-[10px] mt-1">cancelar</button>
        </div>
      )}
    </div>
  );
}

function VariantEditor({ variant, step, onClose, onSave, onDelete }: {
  variant: Variant; step: Step;
  onClose: () => void;
  onSave: (patch: Partial<Variant>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName]   = useState(variant.name);
  const [url, setUrl]     = useState(variant.destination_url);
  const [weight, setWeight] = useState(variant.weight);
  const [status, setStatus] = useState(variant.status);

  return (
    <div className="fixed inset-0 bg-bg/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Editar variante · {step.name}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={14} /></button>
        </div>
        <div className="space-y-3">
          <Field label="Nome">
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/40" />
          </Field>
          {step.type === "sales" && (
            <Field label="URL de destino (página de vendas)">
              <input value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent/40" />
            </Field>
          )}
          {step.type === "sales" ? (
            <Field label="Peso no split (%)">
              <input type="number" min={0} max={100} value={weight}
                onChange={e => setWeight(Number(e.target.value))}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent/40" />
            </Field>
          ) : (
            <Field label="Status">
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/40">
                <option value="active">Ativa</option>
                <option value="paused">Pausada</option>
              </select>
            </Field>
          )}
        </div>
        <div className="flex items-center justify-between mt-5">
          <button onClick={onDelete}
            className="text-red text-xs hover:underline inline-flex items-center gap-1">
            <Trash2 size={12} /> Remover
          </button>
          <button onClick={() => onSave({ name, destination_url: url, weight, status: status as any })}
            className="bg-accent text-bg px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5">
            <Save size={12} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function StepEditor({ step, onClose, onSave }: {
  step: Step; onClose: () => void; onSave: (patch: Partial<Step>) => Promise<void>;
}) {
  const [name, setName] = useState(step.name);
  const [type, setType] = useState(step.type);
  return (
    <div className="fixed inset-0 bg-bg/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Editar etapa</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={14} /></button>
        </div>
        <div className="space-y-3">
          <Field label="Nome">
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/40" />
          </Field>
          <Field label="Tipo">
            <select value={type} onChange={e => setType(e.target.value)} disabled={step.ordem === 1}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/40 disabled:opacity-50">
              {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {step.ordem === 1 && <p className="text-text-muted text-[10px] mt-1">Tipo da etapa de entrada não pode mudar.</p>}
          </Field>
        </div>
        <div className="flex justify-end mt-5">
          <button onClick={() => onSave({ name, type })}
            className="bg-accent text-bg px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5">
            <Save size={12} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-text-secondary text-[10px] font-mono uppercase tracking-wider block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
