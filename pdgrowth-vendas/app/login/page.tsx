"use client";
import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const from         = searchParams.get("from") ?? "/";

  const [password, setPassword] = useState("");
  const [show,     setShow]     = useState(false);
  const [error,    setError]    = useState(false);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push(from);
    } else {
      setError(true);
      setPassword("");
    }

    setLoading(false);
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Lock size={14} className="text-text-secondary" />
        <h1 className="text-sm font-semibold text-text-primary">Acesso restrito</h1>
      </div>
      <p className="text-xs text-text-muted mb-5">Digite a senha para acessar o dashboard.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Senha"
            autoFocus
            className={`w-full bg-bg border rounded-lg px-3 py-2.5 text-sm text-text-primary pr-10 focus:outline-none transition-colors ${
              error
                ? "border-red/50 focus:border-red/70"
                : "border-border focus:border-accent/40"
            }`}
          />
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-red text-xs">
            <AlertCircle size={12} />
            Senha incorreta.
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-2.5 rounded-lg bg-accent text-bg text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Verificando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl border border-accent/30 bg-accent/5">
            <span className="font-display font-bold text-accent text-base tracking-tight">PD</span>
          </div>
          <div className="leading-tight">
            <span className="font-display font-bold text-text-primary text-sm block">PD Growth</span>
            <span className="text-text-muted text-[11px] font-mono">// vendas</span>
          </div>
        </div>
        <Suspense fallback={<div className="bg-card border border-border rounded-2xl p-6 text-text-muted text-sm">Carregando...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
