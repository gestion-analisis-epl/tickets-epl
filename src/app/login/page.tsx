"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signInWithGoogle, signInStaff, AuthActionError } from "@/lib/auth-actions";

export default function LoginPage() {
  const router = useRouter();
  const [mostrarStaff, setMostrarStaff] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      router.push("/");
    } catch (err) {
      setError(err instanceof AuthActionError ? err.message : "No se pudo iniciar sesion. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStaffSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInStaff(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof AuthActionError ? err.message : "Correo o contraseña incorrectos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-background">
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-sidebar text-sidebar-foreground p-14">
        <div className="absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full border border-accent/30" />
        <div className="absolute -right-10 -top-10 h-[22rem] w-[22rem] rounded-full border border-accent/20" />
        <div className="relative flex items-center gap-2.5">
          <Scale className="h-6 w-6 text-accent-light" />
          <span className="font-display text-xl font-semibold">Legal <span className="italic text-accent-light">EPL</span></span>
        </div>
        <div className="relative max-w-md stagger">
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent-light">Area juridica</p>
          <p className="font-display text-5xl leading-[1.05] font-semibold mt-4 text-white">
            Cada solicitud, <span className="italic text-accent-light">con folio</span> y con plazo.
          </p>
          <p className="mt-6 text-sm leading-relaxed">
            Seguimiento de tickets, niveles de servicio y documentacion en un solo expediente.
          </p>
        </div>
        <p className="relative text-xs">Grupo EPL</p>
      </aside>

      <div className="flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8 stagger">
        <div className="space-y-2">
          <Scale className="h-7 w-7 text-primary lg:hidden" />
          <h1 className="page-rule text-4xl font-semibold">Bienvenido</h1>
          <p className="text-sm text-muted pt-1">Inicia sesion para continuar con Tickets Legal EPL.</p>
        </div>

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        {!mostrarStaff ? (
          <div className="space-y-4">
            <Button variant="primary" className="w-full" onClick={handleGoogle} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continuar con Google
            </Button>
            <p className="text-xs text-center text-muted">
              Usa tu correo de la empresa (Google Workspace).
            </p>
            <button
              type="button"
              onClick={() => setMostrarStaff(true)}
              className="w-full text-center text-sm text-primary hover:underline"
            >
              ¿Eres de Legal o administrador del sistema? Inicia sesion aqui
            </button>
          </div>
        ) : (
          <form onSubmit={handleStaffSubmit} className="space-y-4">
            <div>
              <label className="field-label">Correo</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full field"
              />
            </div>
            <div>
              <label className="field-label">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full field"
              />
            </div>
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Iniciar sesion
            </Button>
            <button
              type="button"
              onClick={() => { setMostrarStaff(false); setError(null); }}
              className="w-full text-center text-sm text-muted hover:text-foreground"
            >
              Volver a la opcion de solicitante
            </button>
          </form>
        )}
      </div>
      </div>
    </div>
  );
}
