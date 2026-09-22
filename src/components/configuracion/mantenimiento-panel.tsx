"use client";

import { useState } from "react";
import { ShieldAlert, Wrench, Mail, Send } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { backfillSlaHistorico, type BackfillResultado } from "@/lib/tickets";
import { enviarEmailNotificacion } from "@/lib/notificaciones";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { isAdminRole } from "@/types/user";

interface ReenvioResultado {
  modo: "dry-run" | "envio";
  tickets: number;
  totalCorreos: number;
  resumenPorTipo: Record<string, number>;
  sinDestinatario: string[];
}

async function llamarReenvio(send: boolean): Promise<ReenvioResultado> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Sesion invalida.");
  const res = await fetch("/api/notificaciones/reenviar-retroactivo", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ send }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "No se pudo completar.");
  return res.json();
}

export function MantenimientoPanel() {
  const role = useAuthStore((s) => s.role);
  const [confirmando, setConfirmando] = useState(false);
  const [corriendo, setCorriendo] = useState(false);
  const [resultado, setResultado] = useState<BackfillResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [enviandoPrueba, setEnviandoPrueba] = useState(false);
  const [pruebaEnviada, setPruebaEnviada] = useState(false);

  const [corriendoReenvio, setCorriendoReenvio] = useState(false);
  const [reenvioDryRun, setReenvioDryRun] = useState<ReenvioResultado | null>(null);
  const [reenvioFinal, setReenvioFinal] = useState<ReenvioResultado | null>(null);
  const [reenvioError, setReenvioError] = useState<string | null>(null);
  const [confirmandoReenvio, setConfirmandoReenvio] = useState(false);

  async function handleDryRunReenvio() {
    setCorriendoReenvio(true);
    setReenvioError(null);
    setReenvioDryRun(null);
    setReenvioFinal(null);
    setConfirmandoReenvio(false);
    try {
      setReenvioDryRun(await llamarReenvio(false));
    } catch (err) {
      setReenvioError(err instanceof Error ? err.message : "No se pudo calcular el reenvio.");
    } finally {
      setCorriendoReenvio(false);
    }
  }

  async function handleEnviarReenvio() {
    setCorriendoReenvio(true);
    setReenvioError(null);
    try {
      setReenvioFinal(await llamarReenvio(true));
      setConfirmandoReenvio(false);
    } catch (err) {
      setReenvioError(err instanceof Error ? err.message : "No se pudo enviar.");
    } finally {
      setCorriendoReenvio(false);
    }
  }

  async function handleEnviarPrueba() {
    setEnviandoPrueba(true);
    setPruebaEnviada(false);
    try {
      await enviarEmailNotificacion({
        tipo: "nuevo_ticket",
        mensaje: "Este es un correo de prueba disparado manualmente desde Mantenimiento, sin ticket real de por medio.",
        ticketId: "test",
        ticketFolio: "TEST-0000",
      });
      setPruebaEnviada(true);
    } finally {
      setEnviandoPrueba(false);
    }
  }

  async function handleCorrer() {
    setCorriendo(true);
    setError(null);
    setResultado(null);
    try {
      const r = await backfillSlaHistorico();
      setResultado(r);
      setConfirmando(false);
    } catch {
      setError("No se pudo completar el recalculo. Intenta de nuevo.");
    } finally {
      setCorriendo(false);
    }
  }

  if (!isAdminRole(role)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-center max-w-lg">
        <ShieldAlert className="h-6 w-6 text-danger" />
        <p className="text-sm font-medium">No tienes permiso para ver esta pagina.</p>
        <p className="text-xs opacity-60">Solo cuentas con rol admin pueden usar herramientas de mantenimiento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <section className="rounded-lg border border-border bg-card p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Recalcular SLA historico</h2>
        <p className="text-sm opacity-80">
          Recalcula <span className="font-medium">nivel de servicio</span> y{" "}
          <span className="font-medium">dias en pipeline</span> de los tickets ya cerrados, usando la fecha de
          asignacion del abogado como inicio del SLA (antes se calculaba desde la fecha de solicitud). Los tickets
          abiertos no se ven afectados — se recalculan solos en cada lectura.
        </p>

        {!confirmando ? (
          <Button variant="warning" onClick={() => setConfirmando(true)}>
            <Wrench className="h-4 w-4" />
            Recalcular SLA historico
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              Esto sobrescribe <span className="font-medium">nivel de servicio</span>,{" "}
              <span className="font-medium">dias transcurridos</span> y{" "}
              <span className="font-medium">dias en pipeline</span> de todos los tickets ya cerrados. No se puede
              deshacer.
            </p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <Button variant="warning" onClick={handleCorrer} disabled={corriendo}>
                {corriendo ? "Recalculando..." : "Si, recalcular"}
              </Button>
              <Button variant="outline" onClick={() => setConfirmando(false)} disabled={corriendo}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {resultado && (
          <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            {resultado.actualizados} tickets actualizados
            {resultado.omitidos > 0 && `, ${resultado.omitidos} omitidos (sin fechaSolicitud/fechaCierre)`}.
          </div>
        )}

        {resultado && resultado.detalles.length > 0 && (
          <details className="text-xs opacity-70">
            <summary className="cursor-pointer select-none">Ver detalle por ticket</summary>
            <ul className="mt-2 space-y-0.5 max-h-64 overflow-y-auto font-mono">
              {resultado.detalles.map((linea, i) => (
                <li key={i}>{linea}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Correo de prueba</h2>
        <p className="text-sm opacity-80">
          Dispara el mismo flujo de notificacion por correo que usan los tickets reales, sin necesidad de crear uno.
          Llega a todo el staff de Legal (destinatario real de &quot;nuevo ticket&quot;), salvo que{" "}
          <span className="font-mono text-xs">NOTIFICACIONES_DESTINATARIOS_PRUEBA</span> este configurada.
        </p>
        <Button variant="outline" onClick={handleEnviarPrueba} disabled={enviandoPrueba}>
          <Mail className="h-4 w-4" />
          {enviandoPrueba ? "Enviando..." : "Enviar correo de prueba"}
        </Button>
        {pruebaEnviada && (
          <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            Solicitud enviada.
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Reenvio retroactivo de correos</h2>
        <p className="text-sm opacity-80">
          Recalcula y reenvia los avisos de correo (nuevo ticket, creacion, asignacion, cambio de estatus/cierre)
          de todos los tickets desde el 21 de septiembre de 2026 — usa el mismo flujo y destinatarios reales que
          los tickets nuevos, solo que basado en el estado <span className="font-medium">actual</span> de cada
          ticket. Util porque muchos abogados no tenian vinculo con su cuenta y no recibieron sus avisos.
        </p>

        {reenvioError && <p className="text-sm text-danger">{reenvioError}</p>}

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleDryRunReenvio} disabled={corriendoReenvio}>
            <Wrench className="h-4 w-4" />
            {corriendoReenvio ? "Calculando..." : "Simular (sin enviar)"}
          </Button>
        </div>

        {reenvioDryRun && !reenvioFinal && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm space-y-1">
              <p>
                {reenvioDryRun.tickets} tickets, {reenvioDryRun.totalCorreos} correos se enviarian:
              </p>
              <ul className="text-xs opacity-80 pl-4 list-disc">
                {Object.entries(reenvioDryRun.resumenPorTipo).map(([tipo, n]) => (
                  <li key={tipo}>{tipo}: {n}</li>
                ))}
              </ul>
              {reenvioDryRun.sinDestinatario.length > 0 && (
                <details className="text-xs opacity-70 mt-1">
                  <summary className="cursor-pointer select-none">
                    {reenvioDryRun.sinDestinatario.length} sin destinatario (no se enviaran)
                  </summary>
                  <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto font-mono">
                    {reenvioDryRun.sinDestinatario.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </details>
              )}
            </div>

            {!confirmandoReenvio ? (
              <Button variant="warning" onClick={() => setConfirmandoReenvio(true)} disabled={corriendoReenvio}>
                <Send className="h-4 w-4" />
                Enviar estos {reenvioDryRun.totalCorreos} correos de verdad
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm">
                  Esto manda <span className="font-medium">{reenvioDryRun.totalCorreos} correos reales</span> a
                  staff, abogados y solicitantes. No se puede deshacer.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="warning" onClick={handleEnviarReenvio} disabled={corriendoReenvio}>
                    {corriendoReenvio ? "Enviando..." : "Si, enviar"}
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmandoReenvio(false)} disabled={corriendoReenvio}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {reenvioFinal && (
          <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            Listo: {reenvioFinal.totalCorreos} correos enviados de {reenvioFinal.tickets} tickets.
          </div>
        )}
      </section>
    </div>
  );
}
