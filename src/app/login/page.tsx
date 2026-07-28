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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Scale className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-semibold">Tickets Legal EPL</h1>
          <p className="text-sm opacity-70">Inicia sesion para continuar</p>
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
            <p className="text-xs text-center opacity-60">
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
              <label className="block text-sm font-medium mb-1.5">Correo</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Iniciar sesion
            </Button>
            <button
              type="button"
              onClick={() => { setMostrarStaff(false); setError(null); }}
              className="w-full text-center text-sm opacity-60 hover:opacity-100"
            >
              Volver a la opcion de solicitante
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
