"use client";

import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useComentarios } from "@/hooks/use-comentarios";
import { comentar, editarComentario, eliminarComentario } from "@/lib/conversacion";
import { actorDesdeSesion } from "@/domain/tickets/historial-rules";
import { MAX_TEXTO_COMENTARIO, puedeEditarComentario, validarTextoComentario } from "@/domain/tickets/conversacion-rules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFecha } from "@/lib/format-fecha";
import { cn } from "@/lib/utils";
import type { Comentario } from "@/types/comentario";
import type { Role } from "@/types/user";

const ETIQUETA_ROL: Record<Role, string> = {
  solicitante: "Solicitante",
  gerente_area: "Solicitante",
  mesa_control: "Mesa de Control",
  abogado: "Abogado",
  gerente_juridico: "Gerente Juridico",
  admin: "Admin",
  jefe_zona: "Jefe de Zona",
  sitios: "Sitios", // nunca es autor (no participa); requerido por Record<Role, string>
};

// El texto de los comentarios se pinta siempre como texto de React (nunca como HTML).
export function ConversacionPanel({ ticketId, escribible }: { ticketId: string; escribible: boolean }) {
  const uid = useAuthStore((s) => s.uid);
  const nombre = useAuthStore((s) => s.nombre);
  const role = useAuthStore((s) => s.role);
  const actor = actorDesdeSesion({ uid, nombre, role });
  const { comentarios, loading, error } = useComentarios(ticketId);

  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicion, setTextoEdicion] = useState("");
  const [confirmandoBorrarId, setConfirmandoBorrarId] = useState<string | null>(null);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  async function enviar() {
    if (!actor) return;
    const validado = validarTextoComentario(texto);
    if (!validado.ok) {
      setErrorEnvio(validado.error);
      return;
    }
    setEnviando(true);
    setErrorEnvio(null);
    try {
      await comentar(ticketId, actor, validado.texto);
      setTexto("");
    } catch {
      setErrorEnvio("No se pudo enviar el comentario. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  function iniciarEdicion(c: Comentario) {
    setEditandoId(c.id);
    setTextoEdicion(c.texto ?? "");
    setConfirmandoBorrarId(null);
    setErrorAccion(null);
  }

  async function guardarEdicion(c: Comentario) {
    if (!actor) return;
    const validado = validarTextoComentario(textoEdicion);
    if (!validado.ok) {
      setErrorAccion(validado.error);
      return;
    }
    setOcupadoId(c.id);
    setErrorAccion(null);
    try {
      await editarComentario(ticketId, actor, c, validado.texto);
      setEditandoId(null);
    } catch {
      setErrorAccion("No se pudo guardar el comentario. Intenta de nuevo.");
    } finally {
      setOcupadoId(null);
    }
  }

  async function borrar(c: Comentario) {
    if (!actor) return;
    setOcupadoId(c.id);
    setErrorAccion(null);
    try {
      await eliminarComentario(ticketId, actor, c);
      setConfirmandoBorrarId(null);
    } catch {
      setErrorAccion("No se pudo eliminar el comentario. Intenta de nuevo.");
    } finally {
      setOcupadoId(null);
    }
  }

  return (
    <section className="section-card p-6 space-y-4">
      <h2 className="eyebrow">Conversacion</h2>

      {loading ? (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger">No se pudo cargar la conversacion.</p>
      ) : comentarios.length === 0 ? (
        <p className="text-sm text-muted">Aun no hay comentarios.</p>
      ) : (
        <ol className="space-y-3">
          {comentarios.map((c) => {
            const propio = escribible && puedeEditarComentario(uid, c);
            const editando = editandoId === c.id;
            const ocupado = ocupadoId === c.id;
            return (
              <li
                key={c.id}
                className={cn(
                  "rounded-md border p-3",
                  c.tipo === "cambios_solicitados"
                    ? "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                    : "border-border"
                )}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-medium text-foreground">{c.autorNombre || "Sin nombre"}</span>
                  <span>{ETIQUETA_ROL[c.autorRol] ?? c.autorRol}</span>
                  <span>{formatFecha(c.creadoEn, { conHora: true })}</span>
                  {c.editadoEn && !c.eliminado && <span>(editado)</span>}
                  {c.tipo === "cambios_solicitados" && <Badge tone="amber">Cambios solicitados</Badge>}
                </div>

                {c.eliminado ? (
                  <p className="mt-1 text-sm italic text-muted">Comentario eliminado</p>
                ) : editando ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={textoEdicion}
                      onChange={(e) => setTextoEdicion(e.target.value)}
                      rows={3}
                      maxLength={MAX_TEXTO_COMENTARIO}
                      aria-label="Editar comentario"
                      className="field w-full resize-y"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => guardarEdicion(c)} disabled={ocupado}>
                        Guardar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditandoId(null)} disabled={ocupado}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">{c.texto}</p>
                )}

                {propio && !editando && (
                  confirmandoBorrarId === c.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span>Eliminar este comentario?</span>
                      <Button size="sm" variant="danger" onClick={() => borrar(c)} disabled={ocupado}>
                        Si, eliminar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmandoBorrarId(null)} disabled={ocupado}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => iniciarEdicion(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmandoBorrarId(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </Button>
                    </div>
                  )
                )}
              </li>
            );
          })}
        </ol>
      )}

      {errorAccion && <p role="alert" className="text-sm text-danger">{errorAccion}</p>}

      {escribible ? (
        <div className="space-y-2">
          <label htmlFor={`comentario-${ticketId}`} className="field-label">Nuevo comentario</label>
          <textarea
            id={`comentario-${ticketId}`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            maxLength={MAX_TEXTO_COMENTARIO}
            placeholder="Observaciones sobre el ticket o el contrato..."
            className="field w-full resize-y"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted tabular-nums">{texto.length} / {MAX_TEXTO_COMENTARIO}</span>
            <Button onClick={enviar} disabled={enviando || !texto.trim()}>
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
              Comentar
            </Button>
          </div>
          {errorEnvio && <p role="alert" className="text-sm text-danger">{errorEnvio}</p>}
        </div>
      ) : (
        <p className="text-xs text-muted">La conversacion esta cerrada (solo lectura).</p>
      )}
    </section>
  );
}
