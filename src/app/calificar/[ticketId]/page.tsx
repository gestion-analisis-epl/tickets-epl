"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Scale, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InfoTicket {
  folio: string;
  servicio: string;
  yaCalificado: boolean;
  satisfaccion: number | null;
}

// Pagina publica (fuera del grupo (app), sin login) — se llega aqui desde el
// link del correo de cierre. El token de la URL es lo que autoriza el envio
// (ver api/calificar/[ticketId]/route.ts), no una sesion de Firebase Auth.
export default function CalificarPage() {
  const params = useParams<{ ticketId: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [info, setInfo] = useState<InfoTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [satisfaccionSel, setSatisfaccionSel] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    fetch(`/api/calificar/${params.ticketId}?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo cargar.");
        setInfo(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar."))
      .finally(() => setLoading(false));
  }, [params.ticketId, token]);

  async function handleEnviar() {
    if (satisfaccionSel == null) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/calificar/${params.ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, satisfaccion: satisfaccionSel, comentario }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo enviar.");
      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Scale className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-semibold">Tickets Legal EPL</h1>
        </div>

        {loading ? (
          <div className="flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin opacity-50" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger text-center">
            {error}
          </div>
        ) : enviado || info?.yaCalificado ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
            <p className="text-sm font-medium">
              {enviado ? "¡Gracias por tu calificacion!" : "Este ticket ya fue calificado."}
            </p>
            {info?.yaCalificado && !enviado && (
              <p className="text-sm opacity-70">Calificacion registrada: {info.satisfaccion} / 10</p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div>
              <p className="text-sm opacity-60">Ticket {info?.folio}</p>
              <p className="text-sm font-medium">{info?.servicio}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Califica tu experiencia</label>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSatisfaccionSel(n)}
                    className={cn(
                      "h-9 rounded-md border text-sm font-medium transition-colors",
                      satisfaccionSel === n ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-surface"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Comentarios (opcional)</label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                placeholder="Cuentanos mas sobre tu experiencia..."
                className="w-full px-3 py-2 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
            </div>

            <Button variant="success" className="w-full" onClick={handleEnviar} disabled={satisfaccionSel == null || enviando}>
              {enviando ? "Enviando..." : "Enviar calificacion"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
