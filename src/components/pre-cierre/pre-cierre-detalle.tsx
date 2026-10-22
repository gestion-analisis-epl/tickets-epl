"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ShieldAlert, Download, ArrowLeft, AlertTriangle, FileText } from "lucide-react";
import { useResumen } from "@/hooks/use-resumenes-contrato";
import { registrarVistoBueno } from "@/lib/resumenes-contrato";
import { useAuthStore } from "@/stores/auth";
import { esJefeZona, puedeDarVistoBueno } from "@/types/user";
import { actorDesdeSesion } from "@/domain/tickets/historial-rules";
import { ConversacionPanel } from "@/components/tickets/conversacion-panel";
import { solicitarCambios } from "@/lib/conversacion";
import { solicitarResumenContrato } from "@/lib/contratos";
import { MAX_TEXTO_COMENTARIO, validarTextoComentario } from "@/domain/tickets/conversacion-rules";
import { Button } from "@/components/ui/button";
import { EstatusBadge } from "@/components/ui/badge";
import { formatFecha, formatFechaSolo } from "@/lib/format-fecha";
import { esUrlStorageSegura } from "@/lib/storage-ruta";
import { findServicio } from "@/lib/catalogo";
import { SERVICIO_ALTA_ARRENDADOR_ID, SERVICIO_CAMBIO_ARRENDADOR_ID } from "@/lib/data/arrendamientos-temporal";
import { formaPagoLabel, formatMonto, textoDiscrepancia, textoODisponible } from "@/domain/contratos/resumen-presentacion";
import type { EstadoResumen } from "@/types/resumen-contrato";

const AVISO_ESTADO: Partial<Record<EstadoResumen, string>> = {
  pendiente: "El resumen del contrato aún no se genera.",
  error: "No se pudo generar el resumen.",
  sin_contrato: "El ticket no tiene el contrato de arrendamiento adjunto.",
};

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="field-label">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

export function PreCierreDetalle({ id }: { id: string }) {
  const { resumen, loading, forbidden } = useResumen(id);
  const uid = useAuthStore((s) => s.uid);
  const nombre = useAuthStore((s) => s.nombre);
  const role = useAuthStore((s) => s.role);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pidiendoCambios, setPidiendoCambios] = useState(false);
  const [textoCambios, setTextoCambios] = useState("");
  const [enviandoCambios, setEnviandoCambios] = useState(false);
  const [errorCambios, setErrorCambios] = useState<string | null>(null);
  const [cambiosEnviados, setCambiosEnviados] = useState(false);
  const [generandoResumen, setGenerandoResumen] = useState(false);
  const [errorResumen, setErrorResumen] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      </div>
    );
  }

  if (forbidden || !resumen) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
        <ShieldAlert className="h-6 w-6 text-muted" />
        <p className="text-sm font-medium text-muted">{forbidden ? "No tienes acceso a este resumen" : "Resumen no encontrado"}</p>
        <Link href="/pre-cierre" className="text-sm underline">Volver a Pre-Cierre / Cierre</Link>
      </div>
    );
  }

  // Alta y Cambio de arrendador no llevan un contrato adjunto: su informacion son los datos capturados y los documentos.
  const sinContratoEsperado = resumen.servicioId === SERVICIO_ALTA_ARRENDADOR_ID || resumen.servicioId === SERVICIO_CAMBIO_ARRENDADOR_ID;
  const aviso = sinContratoEsperado && resumen.estadoResumen === "sin_contrato" ? undefined : AVISO_ESTADO[resumen.estadoResumen];
  // Con contrato adjunto pero sin resumen (aun no se genera o fallo): se puede pedir desde aqui.
  const puedeGenerarResumen = (resumen.estadoResumen === "pendiente" || resumen.estadoResumen === "error") && !!resumen.contratoUrl;
  const servicio = resumen.servicioId ? findServicio(resumen.servicioId)?.servicio ?? null : null;
  const documentos = resumen.documentos ?? [];
  const mostrarVistoBueno = puedeDarVistoBueno(role) && resumen.estatus === "Pre-Cierre" && !resumen.vistoBueno;

  // Rol Sitios: tambien abre esta pantalla (solo lectura del resumen). No pide cambios ni ve la conversacion.
  const esJefe = esJefeZona(role);
  const enPreCierre = resumen.estatus === "Pre-Cierre";
  // El jefe de zona conserva el hilo de sus tickets en cualquier etapa (decision del usuario); en Cierre, solo lectura.
  // Las reglas (hiloEscribible) son la autoridad.
  const hiloAbiertoParaJefe = resumen.estatus !== "Cierre";

  // Tras pedir cambios el jefe de zona se queda en la pantalla: la suscripcion al resumen sigue viva
  // y la etapa cambia sola a "Proceso en tramite" (el boton desaparece porque ya no esta en Pre-Cierre).
  async function enviarCambios() {
    const validado = validarTextoComentario(textoCambios);
    if (!validado.ok) {
      setErrorCambios(validado.error);
      return;
    }
    setEnviandoCambios(true);
    setErrorCambios(null);
    try {
      await solicitarCambios(id, validado.texto);
      setPidiendoCambios(false);
      setTextoCambios("");
      setCambiosEnviados(true);
    } catch (err) {
      setErrorCambios(err instanceof Error ? err.message : "No se pudieron pedir los cambios. Intenta de nuevo.");
    } finally {
      setEnviandoCambios(false);
    }
  }

  // Si el resumen no existe o fallo, cualquiera que vea esta pantalla puede pedirlo (el servidor valida el permiso).
  async function generarResumen() {
    setGenerandoResumen(true);
    setErrorResumen(null);
    try {
      await solicitarResumenContrato(id);
    } catch (err) {
      setErrorResumen(err instanceof Error ? err.message : "No se pudo generar el resumen. Intenta de nuevo en unos minutos.");
    } finally {
      setGenerandoResumen(false);
    }
  }

  async function darVistoBueno() {
    const actor = actorDesdeSesion({ uid, nombre, role });
    if (!actor) return;
    setGuardando(true);
    setError(null);
    try {
      await registrarVistoBueno(id, actor);
    } catch {
      setError("No se pudo registrar el visto bueno. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const periodo =
    resumen.periodoInicio || resumen.periodoFin
      ? `${formatFechaSolo(resumen.periodoInicio)} — ${formatFechaSolo(resumen.periodoFin)}`
      : null;

  const encabezado = (
    <div className="space-y-6">
      <Link href="/pre-cierre" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Pre-Cierre / Cierre
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-rule text-3xl font-semibold tabular-nums">{resumen.folio}</h1>
        <EstatusBadge estatus={resumen.estatus} />
      </div>
    </div>
  );

  const informacion = (
    <div className="space-y-6">
        {aviso && (
          <div role="status" className="flex items-start gap-2 rounded-md border border-border bg-surface p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p>{aviso}</p>
              {puedeGenerarResumen && (
                <>
                  <Button variant="outline" size="sm" onClick={generarResumen} disabled={generandoResumen}>
                    {generandoResumen && <Loader2 className="h-4 w-4 animate-spin" />}
                    {generandoResumen ? "Generando el resumen..." : "Generar resumen del contrato"}
                  </Button>
                  {generandoResumen && <p className="text-xs text-muted">Puede tardar hasta un minuto. No cierres esta pantalla.</p>}
                  {errorResumen && <p role="alert" className="text-sm text-danger">{errorResumen}</p>}
                </>
              )}
            </div>
          </div>
        )}

        {resumen.discrepancias.length > 0 && (
          <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold mb-1">Discrepancias entre el contrato y el ticket</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {resumen.discrepancias.map((d) => (
                <li key={d.campo}>{textoDiscrepancia(d)}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="section-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Datos del ticket</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo label="Servicio">{textoODisponible(servicio)}</Campo>
            {resumen.motivo && <Campo label="Motivo">{resumen.motivo}</Campo>}
            <Campo label="Sitio">
              {resumen.sitioClave ? `${resumen.sitioClave}${resumen.sitioAlias ? ` — ${resumen.sitioAlias}` : ""}` : textoODisponible(null)}
            </Campo>
            <Campo label="Codigo">{textoODisponible(resumen.sitioClave)}</Campo>
            <Campo label="Domicilio">{textoODisponible(resumen.domicilio)}</Campo>
            <Campo label="Alta de arrendador">{textoODisponible(resumen.altaArrendador)}</Campo>
            <Campo label="Solicitante">{textoODisponible(resumen.solicitante)}</Campo>
            <Campo label="Periodo">{textoODisponible(periodo)}</Campo>
            <Campo label="Metodo de pago">{textoODisponible(resumen.metodoPago)}</Campo>
            <Campo label="Condiciones de pago">{textoODisponible(resumen.condicionesPago)}</Campo>
            <Campo label="Monto anual">{formatMonto(resumen.montoPagoAnual)}</Campo>
            <Campo label="Forma de pago">{formaPagoLabel(resumen.formaPago)}</Campo>
          </dl>

          {resumen.contratoUrl && !esUrlStorageSegura(resumen.contratoUrl) && resumen.contratoNombre && (
            <p className="text-sm">Contrato original: {resumen.contratoNombre}</p>
          )}
          {resumen.contratoUrl && esUrlStorageSegura(resumen.contratoUrl) && (
            <a
              href={resumen.contratoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium underline"
            >
              <Download className="h-4 w-4" />
              Descargar contrato original{resumen.contratoNombre ? ` (${resumen.contratoNombre})` : ""}
            </a>
          )}

          {documentos.length > 0 && (
            <div className="space-y-1.5 border-t border-border pt-4">
              <p className="field-label">Documentos del ticket</p>
              <ul className="space-y-1">
                {documentos.map((d) => (
                  <li key={d.url}>
                    {esUrlStorageSegura(d.url) ? (
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium underline">
                        <FileText className="h-4 w-4" /> {d.etiqueta}
                      </a>
                    ) : (
                      <span className="text-sm">{d.etiqueta}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resumen.estadoResumen === "listo" && <p className="text-xs text-muted">Resumen generado automáticamente; no sustituye la revisión legal del contrato.</p>}
        </section>
    </div>
  );

  const accionesVistoBueno = (
    <div className="space-y-6">
      <section className="section-card p-6 space-y-3">
        <h2 className="text-lg font-semibold">Visto bueno</h2>
        {resumen.vistoBueno ? (
          <p className="text-sm font-medium">
            Visto bueno dado por {resumen.vistoBueno.nombre} el {formatFecha(resumen.vistoBueno.fecha, { conHora: true })}
          </p>
        ) : mostrarVistoBueno ? (
          <>
            <Button variant="success" onClick={darVistoBueno} disabled={guardando}>
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              Dar visto bueno
            </Button>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          </>
        ) : (
          <p className="text-sm text-muted">Sin visto bueno registrado.</p>
        )}
        {cambiosEnviados && !enPreCierre && (
          <p role="status" className="text-sm text-muted">
            Se pidieron los cambios. El ticket esta en correccion; puedes seguir la conversacion abajo.
          </p>
        )}
        {esJefe && enPreCierre && (
          <div className="border-t border-border pt-3 space-y-2">
            {!pidiendoCambios ? (
              <Button variant="outline" onClick={() => setPidiendoCambios(true)}>
                Pedir cambios
              </Button>
            ) : (
              <>
                <label htmlFor="texto-cambios" className="field-label">Que hay que corregir (obligatorio)</label>
                <textarea
                  id="texto-cambios"
                  value={textoCambios}
                  onChange={(e) => setTextoCambios(e.target.value)}
                  rows={4}
                  maxLength={MAX_TEXTO_COMENTARIO}
                  className="field w-full resize-y"
                />
                <p className="text-xs text-muted">
                  El ticket regresa a &quot;Proceso en tramite&quot;, se borra el visto bueno y se avisa al abogado y al solicitante.
                </p>
                {errorCambios && <p role="alert" className="text-sm text-danger">{errorCambios}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button variant="warning" onClick={enviarCambios} disabled={enviandoCambios || !textoCambios.trim()}>
                    {enviandoCambios && <Loader2 className="h-4 w-4 animate-spin" />}
                    Enviar y regresar el ticket
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setPidiendoCambios(false); setErrorCambios(null); }}
                    disabled={enviandoCambios}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {esJefe && <ConversacionPanel ticketId={id} escribible={hiloAbiertoParaJefe} />}
    </div>
  );

  return (
    <div className="max-w-5xl space-y-6">
      {encabezado}
      {informacion}
      {accionesVistoBueno}
    </div>
  );
}
