"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoriaBadge } from "@/components/ui/badge";
import { FileDropzone, type UploadingFile } from "@/components/ui/file-dropzone";
import { useAuthStore } from "@/stores/auth";
import { AREAS_EMPRESA } from "@/lib/data/listas";
import { findServicio } from "@/lib/catalogo";
import {
  SERVICIOS_ARRENDAMIENTO_IDS, SERVICIOS_CON_FORMATO_OBLIGATORIO_IDS, SERVICIO_CONTRATO_ARRENDAMIENTO_ID,
  URL_FORMATO_SOLICITUD_ARRENDAMIENTO, CONDICIONES_PAGO_CODIGOS, CONDICIONES_PAGO_TIPOS, MOTIVO_CONTRATO_OPTIONS,
  DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO, type DocumentoRequeridoArrendamientoKey,
} from "@/lib/data/arrendamientos-temporal";
import { toTitleCase, toSentenceCase, formatMontoInput, parseMontoInput } from "@/lib/text-format";
import { validarFormatoArrendamiento } from "@/lib/validar-formato";
import { ServicioSelector } from "./servicio-selector";
import { uploadTicketFile, deleteTicketDocument } from "@/lib/storage";
import { createTicket } from "@/lib/tickets";
import type { ContratoArrendamientoInput, DocumentosArrendamientoInput } from "@/types/ticket";

const DOCUMENTOS_FILES_VACIO = Object.fromEntries(
  DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO.map((d) => [d.key, []])
) as unknown as Record<DocumentoRequeridoArrendamientoKey, UploadingFile[]>;

interface FormState {
  areaEmpresa: string;
  servicioId: string;
  descripcion: string;
}

const EMPTY_FORM: FormState = { areaEmpresa: "", servicioId: "", descripcion: "" };

interface ContratoFormState {
  sitio: string;
  domicilio: string;
  altaArrendador: string;
  solicitante: string;
  periodoInicio: string;
  periodoFin: string;
  condicionesCodigo: string;
  condicionesTipo: string;
  montoPago: string;
  motivo: string;
  notas: string;
}

const EMPTY_CONTRATO: ContratoFormState = {
  sitio: "", domicilio: "", altaArrendador: "", solicitante: "",
  periodoInicio: "", periodoFin: "", condicionesCodigo: "", condicionesTipo: "", montoPago: "", motivo: "", notas: "",
};

export function NuevoTicketForm() {
  const router = useRouter();
  const { uid, nombre } = useAuthStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [contrato, setContratoState] = useState<ContratoFormState>(EMPTY_CONTRATO);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [folioCreado, setFolioCreado] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [formatoFiles, setFormatoFiles] = useState<UploadingFile[]>([]);
  const [documentosFiles, setDocumentosFiles] = useState(DOCUMENTOS_FILES_VACIO);
  // Los archivos se suben a esta carpeta temporal antes de que exista un folio real.
  const [draftId] = useState(() => crypto.randomUUID());

  const hoy = useMemo(() => new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }), []);
  const servicioSeleccionado = form.servicioId ? findServicio(form.servicioId) : undefined;
  const filesUploading = files.some((f) => f.status === "uploading");
  const formatoUploading = formatoFiles.some((f) => f.status === "uploading" || f.status === "validando");
  const documentosUploading = Object.values(documentosFiles).some((fs) => fs.some((f) => f.status === "uploading"));

  const requiereFormato = SERVICIOS_CON_FORMATO_OBLIGATORIO_IDS.includes(form.servicioId);
  const esContrato = form.servicioId === SERVICIO_CONTRATO_ARRENDAMIENTO_ID;

  function handleFilesSelected(selected: File[]) {
    const entries: UploadingFile[] = selected.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading",
    }));
    setFiles((prev) => [...prev, ...entries]);

    selected.forEach((file, i) => {
      const id = entries[i].id;
      uploadTicketFile(
        `tickets-drafts/${draftId}`,
        file,
        (pct) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress: pct } : f)))
      )
        .then(({ url, path }) => {
          setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "done", progress: 100, url, path } : f)));
        })
        .catch((err) => {
          setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "error", error: err?.message } : f)));
        });
    });
  }

  async function handleRemoveFile(id: string) {
    const target = files.find((f) => f.id === id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (target?.status === "done" && target.path) {
      try { await deleteTicketDocument(target.path); } catch { /* ya se quito de la lista, no bloquea al usuario */ }
    }
  }

  // Slot unico: un archivo nuevo reemplaza al anterior, que se borra de Storage.
  function handleFormatoSeleccionado(selected: File[]) {
    const file = selected[0];
    if (!file) return;
    const anterior = formatoFiles[0];
    const entry: UploadingFile = { id: crypto.randomUUID(), name: file.name, size: file.size, progress: 0, status: "uploading" };
    setFormatoFiles([entry]);
    setErrors((prev) => ({ ...prev, formato: "" }));

    uploadTicketFile(
      `tickets-drafts/${draftId}`,
      file,
      (pct) => setFormatoFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, progress: pct } : f)))
    )
      .then(async ({ url, path }) => {
        setFormatoFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, status: "validando", progress: 100, url, path } : f)));

        const resultado = await validarFormatoArrendamiento(url);
        if (resultado === "valido") {
          setFormatoFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, status: "done" } : f)));
          return;
        }

        const mensaje = resultado === "invalido"
          ? "Este archivo no parece ser el formato oficial de solicitud de arrendamiento. Descarga la plantilla oficial y vuelve a subirla."
          : "No se pudo validar el archivo. Intenta de nuevo.";
        setFormatoFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, status: "error", error: mensaje } : f)));
        deleteTicketDocument(path).catch(() => {});
      })
      .catch((err) => {
        setFormatoFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, status: "error", error: err?.message } : f)));
      });

    if (anterior?.status === "done" && anterior.path) {
      deleteTicketDocument(anterior.path).catch(() => {});
    }
  }

  async function handleRemoveFormato(id: string) {
    const target = formatoFiles.find((f) => f.id === id);
    setFormatoFiles([]);
    if (target?.status === "done" && target.path) {
      try { await deleteTicketDocument(target.path); } catch { /* ya se quito de la lista, no bloquea al usuario */ }
    }
  }

  function handleDocumentoSeleccionado(key: DocumentoRequeridoArrendamientoKey, selected: File[]) {
    const file = selected[0];
    if (!file) return;
    const anterior = documentosFiles[key][0];
    const entry: UploadingFile = { id: crypto.randomUUID(), name: file.name, size: file.size, progress: 0, status: "uploading" };
    setDocumentosFiles((prev) => ({ ...prev, [key]: [entry] }));
    setErrors((prev) => ({ ...prev, [key]: "" }));

    uploadTicketFile(
      `tickets-drafts/${draftId}`,
      file,
      (pct) => setDocumentosFiles((prev) => ({ ...prev, [key]: prev[key].map((f) => (f.id === entry.id ? { ...f, progress: pct } : f)) }))
    )
      .then(({ url, path }) => {
        setDocumentosFiles((prev) => ({ ...prev, [key]: prev[key].map((f) => (f.id === entry.id ? { ...f, status: "done", progress: 100, url, path } : f)) }));
      })
      .catch((err) => {
        setDocumentosFiles((prev) => ({ ...prev, [key]: prev[key].map((f) => (f.id === entry.id ? { ...f, status: "error", error: err?.message } : f)) }));
      });

    if (anterior?.status === "done" && anterior.path) {
      deleteTicketDocument(anterior.path).catch(() => {});
    }
  }

  async function handleRemoveDocumento(key: DocumentoRequeridoArrendamientoKey, id: string) {
    const target = documentosFiles[key].find((f) => f.id === id);
    setDocumentosFiles((prev) => ({ ...prev, [key]: [] }));
    if (target?.status === "done" && target.path) {
      try { await deleteTicketDocument(target.path); } catch { /* ya se quito de la lista, no bloquea al usuario */ }
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  function setContrato<K extends keyof ContratoFormState>(key: K, value: ContratoFormState[K]) {
    setContratoState((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  function sanitizarContrato(key: keyof ContratoFormState, formatear: (v: string) => string) {
    setContratoState((prev) => ({ ...prev, [key]: formatear(prev[key]) }));
  }

  function validar(): boolean {
    const next: Record<string, string> = {};
    if (!form.areaEmpresa) next.areaEmpresa = "Selecciona el area o empresa solicitante.";
    if (!form.servicioId) next.servicioId = "Selecciona el servicio que necesitas.";
    if (!form.descripcion.trim()) next.descripcion = "Describe brevemente la solicitud.";

    if (requiereFormato) {
      if (!(formatoFiles.length === 1 && formatoFiles[0].status === "done")) {
        next.formato = "Adjunta el formato de solicitud de arrendamiento (obligatorio para este servicio).";
      }
      for (const doc of DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO) {
        const archivos = documentosFiles[doc.key];
        if (!(archivos.length === 1 && archivos[0].status === "done")) {
          next[doc.key] = `Adjunta: ${doc.label}.`;
        }
      }
    }

    if (esContrato) {
      if (!contrato.sitio.trim()) next.sitio = "Captura el sitio.";
      if (!contrato.domicilio.trim()) next.domicilio = "Captura el domicilio.";
      if (!contrato.altaArrendador.trim()) next.altaArrendador = "Captura el arrendador dado de alta.";
      if (!contrato.solicitante.trim()) next.solicitante = "Captura el solicitante.";
      if (!contrato.periodoInicio) next.periodoInicio = "Captura la fecha de inicio.";
      if (!contrato.periodoFin) next.periodoFin = "Captura la fecha de fin.";
      if (contrato.periodoInicio && contrato.periodoFin && contrato.periodoFin < contrato.periodoInicio) {
        next.periodoFin = "La fecha de fin no puede ser anterior a la de inicio.";
      }
      if (!contrato.condicionesCodigo || !contrato.condicionesTipo) next.condicionesPago = "Selecciona las condiciones para pago.";
      const monto = parseMontoInput(contrato.montoPago);
      if (!contrato.montoPago.trim() || !Number.isFinite(monto) || monto <= 0) next.montoPago = "Captura un monto valido.";
      if (!contrato.motivo) next.motivo = "Selecciona el motivo.";
      if (!contrato.notas.trim()) next.notas = "Captura las notas.";
    }

    setErrors(next);
    return Object.values(next).every((v) => !v);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validar() || filesUploading || formatoUploading || documentosUploading || !uid || !nombre) return;

    setSubmitError(null);
    setCreating(true);
    try {
      const contratoArrendamiento: ContratoArrendamientoInput | undefined = esContrato
        ? {
            sitio: contrato.sitio,
            domicilio: contrato.domicilio,
            altaArrendador: contrato.altaArrendador,
            solicitante: contrato.solicitante,
            periodoInicio: contrato.periodoInicio,
            periodoFin: contrato.periodoFin,
            condicionesPago: `${contrato.condicionesCodigo} - ${contrato.condicionesTipo}`,
            montoPago: parseMontoInput(contrato.montoPago),
            motivo: contrato.motivo,
            notas: contrato.notas,
          }
        : undefined;

      const documentosArrendamiento: DocumentosArrendamientoInput | undefined = requiereFormato
        ? (Object.fromEntries(
            DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO.map((doc) => [doc.key, documentosFiles[doc.key][0]?.url ?? ""])
          ) as unknown as DocumentosArrendamientoInput)
        : undefined;

      const { folio } = await createTicket({
        solicitanteId: uid,
        solicitanteNombre: nombre,
        areaEmpresa: form.areaEmpresa,
        servicioId: form.servicioId,
        descripcion: form.descripcion,
        documentacion: files.filter((f) => f.status === "done" && f.url).map((f) => f.url!),
        formatoArrendamientoUrl: requiereFormato ? formatoFiles[0]?.url : undefined,
        documentosArrendamiento,
        contratoArrendamiento,
      });
      setFolioCreado(folio);
    } catch {
      setSubmitError("No se pudo guardar el ticket. Intenta de nuevo en unos segundos.");
    } finally {
      setCreating(false);
    }
  }

  function reiniciar() {
    setFolioCreado(null);
    setForm(EMPTY_FORM);
    setContratoState(EMPTY_CONTRATO);
    setFiles([]);
    setFormatoFiles([]);
    setDocumentosFiles(DOCUMENTOS_FILES_VACIO);
  }

  if (folioCreado) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 sm:p-8 max-w-xl">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
          <div>
            <h2 className="text-lg font-semibold">Solicitud creada: {folioCreado}</h2>
            <p className="text-sm opacity-70 mt-0.5">
              Tu ticket ya quedo guardado y Mesa de Control lo puede ver.
              {files.length > 0 && ` Se adjuntaron ${files.length} archivo(s).`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-6">
          <Button variant="primary" onClick={reiniciar}>
            Crear otra solicitud
          </Button>
          <Link href="/tickets">
            <Button variant="outline">Ir a Tickets</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      {/* Datos automaticos (no editables) */}
      <section className="rounded-lg border border-border bg-surface p-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div><span className="opacity-60">Fecha de solicitud: </span><span className="font-medium">{hoy}</span></div>
        <div><span className="opacity-60">Solicitante: </span><span className="font-medium">{nombre}</span></div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Area / Empresa solicitante <span className="text-danger">*</span>
          </label>
          <select
            value={form.areaEmpresa}
            onChange={(e) => set("areaEmpresa", e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Selecciona un area o empresa...</option>
            {AREAS_EMPRESA.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {errors.areaEmpresa && <p className="text-xs text-danger mt-1">{errors.areaEmpresa}</p>}
        </div>

        <div>
          <ServicioSelector
            value={form.servicioId}
            onChange={(v) => set("servicioId", v)}
            error={errors.servicioId}
            soloIds={SERVICIOS_ARRENDAMIENTO_IDS}
          />

          {servicioSeleccionado && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-surface px-3 py-2 text-sm">
              <CategoriaBadge categoria={servicioSeleccionado.categoria} />
              <span className="opacity-70">Puesto responsable: <span className="font-medium opacity-100">{servicioSeleccionado.puestoResponsable}</span></span>
              <span className="opacity-70">SLA interno: <span className="font-medium opacity-100">{servicioSeleccionado.slaInterno} dias habiles</span></span>
            </div>
          )}
        </div>

        {requiereFormato && (
          <div className="space-y-4">
            <label className="block text-sm font-medium mb-1.5">
              Subir Formato de Solicitud de Arrendamiento <span className="text-danger">*</span>
            </label>
            <a
              href={URL_FORMATO_SOLICITUD_ARRENDAMIENTO}
              download
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-2"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar formato oficial
            </a>
            <FileDropzone
              files={formatoFiles}
              onFilesSelected={handleFormatoSeleccionado}
              onRemove={handleRemoveFormato}
              multiple={false}
            />
            <p className="text-xs opacity-60 mt-1.5">
              Descarga el formato oficial, llenalo, y sube aqui el mismo archivo — no se acepta otra plantilla.
            </p>
            {errors.formato && <p className="text-xs text-danger mt-1">{errors.formato}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO.map((doc) => (
                <div key={doc.key}>
                  <label className="block text-sm font-medium mb-1.5">
                    {doc.label} <span className="text-danger">*</span>
                  </label>
                  <FileDropzone
                    files={documentosFiles[doc.key]}
                    onFilesSelected={(selected) => handleDocumentoSeleccionado(doc.key, selected)}
                    onRemove={(id) => handleRemoveDocumento(doc.key, id)}
                    multiple={false}
                  />
                  {errors[doc.key] && <p className="text-xs text-danger mt-1">{errors[doc.key]}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {esContrato && (
          <div className="space-y-4 rounded-md border border-border bg-surface/40 p-4">
            <p className="text-sm font-semibold uppercase tracking-wide opacity-70">Datos del contrato / convenio</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Sitio <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={contrato.sitio}
                  onChange={(e) => setContrato("sitio", e.target.value)}
                  onBlur={() => sanitizarContrato("sitio", toTitleCase)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {errors.sitio && <p className="text-xs text-danger mt-1">{errors.sitio}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Domicilio <span className="text-danger">*</span></label>
                <textarea
                  value={contrato.domicilio}
                  onChange={(e) => setContrato("domicilio", e.target.value)}
                  onBlur={() => sanitizarContrato("domicilio", toTitleCase)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
                {errors.domicilio && <p className="text-xs text-danger mt-1">{errors.domicilio}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Alta de Arrendador <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={contrato.altaArrendador}
                  onChange={(e) => setContrato("altaArrendador", e.target.value)}
                  onBlur={() => sanitizarContrato("altaArrendador", toTitleCase)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {errors.altaArrendador && <p className="text-xs text-danger mt-1">{errors.altaArrendador}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Solicitante <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={contrato.solicitante}
                  onChange={(e) => setContrato("solicitante", e.target.value)}
                  onBlur={() => sanitizarContrato("solicitante", toTitleCase)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {errors.solicitante && <p className="text-xs text-danger mt-1">{errors.solicitante}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Periodo de arrendamiento <span className="text-danger">*</span></label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={contrato.periodoInicio}
                    onChange={(e) => setContrato("periodoInicio", e.target.value)}
                    className="h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-sm opacity-60">a</span>
                  <input
                    type="date"
                    value={contrato.periodoFin}
                    onChange={(e) => setContrato("periodoFin", e.target.value)}
                    className="h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {(errors.periodoInicio || errors.periodoFin) && (
                  <p className="text-xs text-danger mt-1">{errors.periodoInicio || errors.periodoFin}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Condiciones para pago <span className="text-danger">*</span></label>
                <div className="flex gap-2">
                  <select
                    value={contrato.condicionesCodigo}
                    onChange={(e) => setContrato("condicionesCodigo", e.target.value)}
                    className="w-24 h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Codigo...</option>
                    {CONDICIONES_PAGO_CODIGOS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    value={contrato.condicionesTipo}
                    onChange={(e) => setContrato("condicionesTipo", e.target.value)}
                    className="flex-1 h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Selecciona...</option>
                    {CONDICIONES_PAGO_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {errors.condicionesPago && <p className="text-xs text-danger mt-1">{errors.condicionesPago}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Monto de pago (MXN) <span className="text-danger">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={contrato.montoPago}
                    onChange={(e) => setContrato("montoPago", formatMontoInput(e.target.value))}
                    className="w-full h-10 pl-7 pr-14 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-50">MXN</span>
                </div>
                {errors.montoPago && <p className="text-xs text-danger mt-1">{errors.montoPago}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Motivo <span className="text-danger">*</span></label>
                <select
                  value={contrato.motivo}
                  onChange={(e) => setContrato("motivo", e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecciona...</option>
                  {MOTIVO_CONTRATO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                {errors.motivo && <p className="text-xs text-danger mt-1">{errors.motivo}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Notas <span className="text-danger">*</span></label>
              <textarea
                value={contrato.notas}
                onChange={(e) => setContrato("notas", e.target.value)}
                onBlur={() => sanitizarContrato("notas", toSentenceCase)}
                rows={3}
                className="w-full px-3 py-2 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
              {errors.notas && <p className="text-xs text-danger mt-1">{errors.notas}</p>}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Descripcion de la solicitud <span className="text-danger">*</span>
          </label>
          <textarea
            value={form.descripcion}
            onChange={(e) => set("descripcion", e.target.value)}
            rows={4}
            placeholder="Describe con el mayor detalle posible lo que necesitas..."
            className="w-full px-3 py-2 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
          {errors.descripcion && <p className="text-xs text-danger mt-1">{errors.descripcion}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Documentacion adjunta</label>
          <FileDropzone files={files} onFilesSelected={handleFilesSelected} onRemove={handleRemoveFile} />
        </div>
      </section>

      {submitError && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger max-w-3xl">
          {submitError}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="success" disabled={filesUploading || formatoUploading || documentosUploading || creating}>
          {filesUploading || formatoUploading || documentosUploading ? "Esperando archivos..." : creating ? "Guardando..." : "Crear ticket"}
        </Button>
        <Button type="button" variant="danger" onClick={() => router.push("/tickets")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
