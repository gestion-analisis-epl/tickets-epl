"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert, FileText, Trash2, Pencil } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useTicket } from "@/hooks/use-ticket";
import { updateTicketAsignacion, updateTicketSolicitud, submitSatisfaccion, deleteTicket } from "@/lib/tickets";
import { findServicio } from "@/lib/catalogo";
import { ServicioSelector } from "./servicio-selector";
import { ABOGADOS } from "@/lib/data/abogados";
import { AREAS_EMPRESA } from "@/lib/data/listas";
import { uploadTicketFile, deleteTicketDocument } from "@/lib/storage";
import { FileDropzone, type UploadingFile } from "@/components/ui/file-dropzone";
import { ESTATUS_VALUES, type Estatus } from "@/types/ticket";
import { EstatusBadge, CategoriaBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatFecha } from "@/lib/format-fecha";

function nombreArchivo(url: string): string {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    return path.split("/").pop() ?? url;
  } catch {
    return url;
  }
}

export function TicketDetail({ id }: { id: string }) {
  const router = useRouter();
  const { uid, role } = useAuthStore();
  const { ticket, loading, forbidden } = useTicket(id);
  const puedeEditar = role === "mesa_control" || role === "abogado" || role === "gerente_juridico" || role === "admin";
  const puedeEliminar = role === "admin";

  const [estatusForm, setEstatusForm] = useState<Estatus>("Recepcion de solicitud");
  const [abogadoForm, setAbogadoForm] = useState("");
  const [notasForm, setNotasForm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const [satisfaccionSel, setSatisfaccionSel] = useState<number | null>(null);
  const [comentarioSatisfaccion, setComentarioSatisfaccion] = useState("");
  const [enviandoSatisfaccion, setEnviandoSatisfaccion] = useState(false);

  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [editingSolicitud, setEditingSolicitud] = useState(false);
  const [areaEmpresaForm, setAreaEmpresaForm] = useState("");
  const [servicioIdForm, setServicioIdForm] = useState("");
  const [descripcionForm, setDescripcionForm] = useState("");
  const [nuevosArchivos, setNuevosArchivos] = useState<UploadingFile[]>([]);
  const [savingSolicitud, setSavingSolicitud] = useState(false);
  const [solicitudError, setSolicitudError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticket) return;
    setEstatusForm(ticket.estatus);
    setAbogadoForm(ticket.abogadoAsignadoId ?? "");
    setNotasForm(ticket.notasCierre ?? "");
    setAreaEmpresaForm(ticket.areaEmpresa);
    setServicioIdForm(ticket.servicioId);
    setDescripcionForm(ticket.descripcion);
  }, [ticket]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin opacity-50" />
      </div>
    );
  }

  if (forbidden || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-center max-w-lg">
        <ShieldAlert className="h-6 w-6 text-danger" />
        <p className="text-sm font-medium">
          {forbidden ? "No tienes permiso para ver este ticket." : "Ticket no encontrado."}
        </p>
        <Link href="/tickets" className="text-sm text-primary hover:underline mt-1">Volver a Tickets</Link>
      </div>
    );
  }

  const servicio = findServicio(ticket.servicioId);
  const esDueno = ticket.solicitanteId === uid;
  const puedeCalificar = esDueno && ticket.estatus === "Cierre" && ticket.satisfaccion == null;
  // Admin puede corregir la solicitud (campos verdes) ademas del dueno —
  // util para arreglar un error antes de asignar el ticket a un abogado.
  // Firestore ya lo permitia (isAdmin() sin restriccion de campos, ver
  // firestore.rules); esto solo habilita el boton en la UI.
  const puedeEditarSolicitud = (esDueno || role === "admin") && ticket.estatus !== "Cierre";

  async function handleGuardar() {
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      await updateTicketAsignacion(id, uid!, {
        estatus: estatusForm,
        abogadoAsignadoId: abogadoForm || null,
        notasCierre: notasForm || null,
      });
      setSaveOk(true);
    } catch {
      setSaveError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCalificar() {
    if (satisfaccionSel == null) return;
    setEnviandoSatisfaccion(true);
    try {
      await submitSatisfaccion(id, satisfaccionSel, comentarioSatisfaccion.trim() || undefined);
    } finally {
      setEnviandoSatisfaccion(false);
    }
  }

  function handleNuevosArchivos(selected: File[]) {
    const entries: UploadingFile[] = selected.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading",
    }));
    setNuevosArchivos((prev) => [...prev, ...entries]);

    selected.forEach((file, i) => {
      const entryId = entries[i].id;
      uploadTicketFile(
        `tickets/${id}`,
        file,
        (pct) => setNuevosArchivos((prev) => prev.map((f) => (f.id === entryId ? { ...f, progress: pct } : f)))
      )
        .then(({ url, path }) => {
          setNuevosArchivos((prev) => prev.map((f) => (f.id === entryId ? { ...f, status: "done", progress: 100, url, path } : f)));
        })
        .catch((err) => {
          setNuevosArchivos((prev) => prev.map((f) => (f.id === entryId ? { ...f, status: "error", error: err?.message } : f)));
        });
    });
  }

  async function handleRemoveNuevoArchivo(entryId: string) {
    const target = nuevosArchivos.find((f) => f.id === entryId);
    setNuevosArchivos((prev) => prev.filter((f) => f.id !== entryId));
    if (target?.status === "done" && target.path) {
      try { await deleteTicketDocument(target.path); } catch { /* ya se quito de la lista, no bloquea */ }
    }
  }

  function handleCancelarEdicionSolicitud() {
    setEditingSolicitud(false);
    setSolicitudError(null);
    setNuevosArchivos([]);
    setAreaEmpresaForm(ticket!.areaEmpresa);
    setServicioIdForm(ticket!.servicioId);
    setDescripcionForm(ticket!.descripcion);
  }

  async function handleGuardarSolicitud() {
    setSavingSolicitud(true);
    setSolicitudError(null);
    try {
      const nuevosUrls = nuevosArchivos.filter((f) => f.status === "done" && f.url).map((f) => f.url!);
      await updateTicketSolicitud(id, {
        areaEmpresa: areaEmpresaForm,
        servicioId: servicioIdForm,
        descripcion: descripcionForm,
        documentacion: [...ticket!.documentacion, ...nuevosUrls],
      });
      setNuevosArchivos([]);
      setEditingSolicitud(false);
    } catch {
      setSolicitudError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSavingSolicitud(false);
    }
  }

  async function handleEliminar() {
    setEliminando(true);
    setDeleteError(null);
    try {
      await deleteTicket(id);
      router.push("/tickets");
    } catch {
      setDeleteError("No se pudo eliminar. Intenta de nuevo.");
      setEliminando(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tabular-nums">{ticket.folio}</h1>
        <EstatusBadge estatus={ticket.estatus} />
        <CategoriaBadge categoria={ticket.categoria} />
      </div>

      {/* Datos de la solicitud (verde) — el dueno o admin pueden corregirla mientras no este Cerrada */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Solicitud</h2>
          {puedeEditarSolicitud && !editingSolicitud && (
            <Button variant="outline" size="sm" onClick={() => setEditingSolicitud(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
          )}
        </div>

        {editingSolicitud ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Area / Empresa</label>
                <select
                  value={areaEmpresaForm}
                  onChange={(e) => setAreaEmpresaForm(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {AREAS_EMPRESA.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <ServicioSelector value={servicioIdForm} onChange={setServicioIdForm} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Descripcion</label>
              <textarea
                value={descripcionForm}
                onChange={(e) => setDescripcionForm(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
            </div>

            {ticket.documentacion.length > 0 && (
              <div>
                <p className="opacity-60 text-sm mb-1.5">Documentacion ya adjunta</p>
                <ul className="space-y-1">
                  {ticket.documentacion.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {nombreArchivo(url)}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">Agregar mas documentacion</label>
              <FileDropzone files={nuevosArchivos} onFilesSelected={handleNuevosArchivos} onRemove={handleRemoveNuevoArchivo} />
            </div>

            {solicitudError && <p className="text-sm text-danger">{solicitudError}</p>}

            <div className="flex flex-wrap gap-3">
              <Button
                variant="success"
                onClick={handleGuardarSolicitud}
                disabled={savingSolicitud || nuevosArchivos.some((f) => f.status === "uploading")}
              >
                {savingSolicitud ? "Guardando..." : "Guardar cambios"}
              </Button>
              <Button variant="outline" onClick={handleCancelarEdicionSolicitud} disabled={savingSolicitud}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt className="opacity-60">Solicitante</dt><dd className="font-medium">{ticket.solicitanteNombre}</dd></div>
              <div><dt className="opacity-60">Area / Empresa</dt><dd className="font-medium">{ticket.areaEmpresa}</dd></div>
              <div><dt className="opacity-60">Servicio</dt><dd className="font-medium">{servicio?.servicio ?? ticket.servicioId}</dd></div>
              <div><dt className="opacity-60">Fecha de solicitud</dt><dd className="font-medium">{formatFecha(ticket.fechaSolicitud)}</dd></div>
              <div><dt className="opacity-60">Puesto responsable sugerido</dt><dd className="font-medium">{ticket.puestoResponsableSugerido}</dd></div>
              <div><dt className="opacity-60">SLA interno</dt><dd className="font-medium">{ticket.slaInterno} dias habiles</dd></div>
              <div><dt className="opacity-60">Dias en pipeline</dt><dd className="font-medium tabular-nums">{ticket.diasPipeline ?? 0}</dd></div>
              <div><dt className="opacity-60">Fecha compromiso</dt><dd className="font-medium">{formatFecha(ticket.fechaCompromiso)}</dd></div>
              <div>
                <dt className="opacity-60">Nivel de servicio</dt>
                {ticket.nivelServicio == null ? (
                  <dd className="font-medium opacity-50">SLA aun no inicia (pendiente de asignar abogado)</dd>
                ) : (
                  <dd className={cn("font-medium tabular-nums", ticket.nivelServicio < 0 ? "text-danger" : "text-success")}>
                    {ticket.nivelServicio > 0 ? `+${ticket.nivelServicio}` : ticket.nivelServicio}
                    {" "}({ticket.diasHabilesTranscurridos} dias transcurridos)
                  </dd>
                )}
              </div>
            </dl>

            <div>
              <p className="opacity-60 text-sm mb-1">Descripcion</p>
              <p className="text-sm whitespace-pre-wrap">{ticket.descripcion}</p>
            </div>

            {ticket.documentacion.length > 0 && (
              <div>
                <p className="opacity-60 text-sm mb-1.5">Documentacion adjunta</p>
                <ul className="space-y-1">
                  {ticket.documentacion.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {nombreArchivo(url)}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* Asignacion / estatus (ambar, editable solo por Legal/admin) */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Asignacion y estatus</h2>

        {puedeEditar ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Estatus</label>
                <select
                  value={estatusForm}
                  onChange={(e) => setEstatusForm(e.target.value as Estatus)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {ESTATUS_VALUES.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Abogado asignado</label>
                <select
                  value={abogadoForm}
                  onChange={(e) => setAbogadoForm(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Sin asignar</option>
                  {ABOGADOS.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Notas de cierre / lecciones aprendidas</label>
              <textarea
                value={notasForm}
                onChange={(e) => setNotasForm(e.target.value)}
                rows={3}
                placeholder="Opcional — util sobre todo al cerrar el ticket."
                className="w-full px-3 py-2 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
            </div>

            {ticket.fechaAsignacion && (
              <p className="text-xs opacity-60">Asignado el {formatFecha(ticket.fechaAsignacion, { conHora: true })}</p>
            )}
            {ticket.fechaCierre && (
              <p className="text-xs opacity-60">Cerrado el {formatFecha(ticket.fechaCierre, { conHora: true })}</p>
            )}

            {saveError && <p className="text-sm text-danger">{saveError}</p>}
            {saveOk && <p className="text-sm text-success">Cambios guardados.</p>}

            <Button variant="success" onClick={handleGuardar} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="opacity-60">Abogado asignado</dt><dd className="font-medium">{ticket.abogadoAsignadoId ?? "Sin asignar"}</dd></div>
            <div><dt className="opacity-60">Fecha de asignacion</dt><dd className="font-medium">{formatFecha(ticket.fechaAsignacion, { conHora: true })}</dd></div>
            {ticket.fechaCierre && (
              <>
                <div><dt className="opacity-60">Fecha de cierre</dt><dd className="font-medium">{formatFecha(ticket.fechaCierre, { conHora: true })}</dd></div>
                {ticket.notasCierre && <div className="sm:col-span-2"><dt className="opacity-60">Notas de cierre</dt><dd>{ticket.notasCierre}</dd></div>}
              </>
            )}
          </dl>
        )}
      </section>

      {/* Calificacion — solo el dueno, solo si ya cerro y no ha calificado */}
      {puedeCalificar && (
        <section className="rounded-lg border border-border bg-card p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Califica tu experiencia</h2>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 max-w-md">
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
          <div>
            <label className="block text-sm font-medium mb-1.5">Comentarios (opcional)</label>
            <textarea
              value={comentarioSatisfaccion}
              onChange={(e) => setComentarioSatisfaccion(e.target.value)}
              rows={3}
              placeholder="Cuentanos mas sobre tu experiencia..."
              className="w-full px-3 py-2 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>
          <Button variant="success" onClick={handleCalificar} disabled={satisfaccionSel == null || enviandoSatisfaccion}>
            {enviandoSatisfaccion ? "Enviando..." : "Enviar calificacion"}
          </Button>
        </section>
      )}

      {ticket.satisfaccion != null && (
        <div className="text-sm opacity-70 space-y-1">
          <p>Satisfaccion registrada: <span className="font-medium opacity-100">{ticket.satisfaccion} / 10</span></p>
          {ticket.comentarioSatisfaccion && (
            <p className="opacity-100">&quot;{ticket.comentarioSatisfaccion}&quot;</p>
          )}
        </div>
      )}

      {/* Eliminar ticket — solo admin, accion destructiva y permanente */}
      {puedeEliminar && (
        <section className="rounded-lg border border-danger/30 bg-card p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-danger">Zona de riesgo</h2>

          {!confirmandoEliminar ? (
            <Button variant="danger" onClick={() => setConfirmandoEliminar(true)}>
              <Trash2 className="h-4 w-4" />
              Eliminar ticket
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                Esto borra el ticket <span className="font-medium">{ticket.folio}</span> de forma permanente,
                incluyendo su historial. No se puede deshacer.
              </p>
              {deleteError && <p className="text-sm text-danger">{deleteError}</p>}
              <div className="flex flex-wrap gap-3">
                <Button variant="danger" onClick={handleEliminar} disabled={eliminando}>
                  {eliminando ? "Eliminando..." : "Si, eliminar definitivamente"}
                </Button>
                <Button variant="outline" onClick={() => setConfirmandoEliminar(false)} disabled={eliminando}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
