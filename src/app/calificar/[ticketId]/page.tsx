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
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-xl items-center gap-2.5 px-6 py-5">
          <Scale className="h-5 w-5 text-accent-light" />
          <span className="font-display text-lg font-semibold">Legal <span className="italic text-accent-light">EPL</span></span>
        </div>
        <div className="h-[3px] bg-accent" />
      </header>

      <main className="flex-1 mx-auto w-full max-w-xl px-6 py-10 sm:py-14">
        <div className="stagger space-y-8">
          <div>
            <p className="eyebrow text-muted">Encuesta de servicio</p>
            <h1 className="page-rule text-4xl font-semibold mt-2">Tu opinion cuenta</h1>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-danger/30 border-l-[3px] border-l-danger bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : enviado || info?.yaCalificado ? (
            <div className="section-card p-8 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
              <p className="font-display text-2xl font-semibold">
                {enviado ? "¡Gracias por tu calificacion!" : "Este ticket ya fue calificado."}
              </p>
              {info?.yaCalificado && !enviado && (
                <p className="text-sm text-muted">
                  Calificacion registrada: <span className="font-display text-lg font-semibold tabular-nums">{info.satisfaccion}</span> / 10
                </p>
              )}
            </div>
          ) : (
            <div className="section-card p-6 sm:p-8 space-y-7">
              <div className="border-b border-border pb-5">
                <p className="eyebrow text-muted">Ticket</p>
                <p className="font-display text-2xl font-semibold tabular-nums mt-1">{info?.folio}</p>
                <p className="text-sm mt-1">{info?.servicio}</p>
              </div>

              <div>
                <label className="field-label">¿Que tan satisfecho quedaste con la atencion?</label>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 mt-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSatisfaccionSel(n)}
                      aria-pressed={satisfaccionSel === n}
                      className={cn(
                        "h-11 rounded-md border font-display text-lg font-semibold tabular-nums transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                        satisfaccionSel === n
                          ? "bg-primary text-primary-foreground border-primary -translate-y-0.5 shadow-md"
                          : "border-input bg-card hover:bg-accent/15 hover:border-accent"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted">
                  <span>Nada satisfecho</span>
                  <span>Muy satisfecho</span>
                </div>
              </div>

              <div>
                <label className="field-label">Comentarios (opcional)</label>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={3}
                  placeholder="Cuentanos mas sobre tu experiencia..."
                  className="field w-full resize-y"
                />
              </div>

              <Button variant="success" size="lg" className="w-full" onClick={handleEnviar} disabled={satisfaccionSel == null || enviando}>
                {enviando ? "Enviando..." : "Enviar calificacion"}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
