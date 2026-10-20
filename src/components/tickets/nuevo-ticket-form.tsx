"use client";

import { useEffect, useMemo, useState } from "react";
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
  SERVICIOS_ARRENDAMIENTO_IDS, SERVICIOS_CON_FORMATO_OBLIGATORIO_IDS, SERVICIOS_CON_DATOS_CONTRATO_IDS, SERVICIOS_CON_DOCUMENTOS_INDIVIDUALES_IDS,
  URL_FORMATO_SOLICITUD_ARRENDAMIENTO, DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO, type DocumentoRequeridoArrendamientoKey,
} from "@/lib/data/arrendamientos-temporal";
import { parseMontoInput } from "@/lib/text-format";
import { validarFormatoArrendamiento } from "@/lib/validar-formato";
import { validarSolicitud, type ContratoCapturado } from "@/domain/tickets/nuevo-ticket-validacion";
import { ServicioSelector } from "./servicio-selector";
import { SitioSelector } from "./sitio-selector";
import { DatosContratoFields } from "./datos-contrato-fields";
import { SELECCION_VACIA, type SeleccionSitio } from "@/domain/sitios/sitios-rules";
import { uploadTicketFile, deleteTicketDocument } from "@/lib/storage";
import { createTicket } from "@/lib/tickets";
import { solicitarResumenContrato } from "@/lib/contratos";
import { encontrarContrato } from "@/domain/contratos/contrato-rules";
import { precargarSitios } from "@/lib/sitios";
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

const EMPTY_CONTRATO: ContratoCapturado = {
  domicilio: "", altaArrendador: "", solicitante: "",
  periodoInicio: "", periodoFin: "", condicionesCodigo: "", condicionesTipo: "", montoPago: "", motivo: "",
};

export function NuevoTicketForm() {
  const router = useRouter();
  const { uid, nombre } = useAuthStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [contrato, setContratoState] = useState<ContratoCapturado>(EMPTY_CONTRATO);
  const [sitio, setSitio] = useState<SeleccionSitio>(SELECCION_VACIA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [folioCreado, setFolioCreado] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [formatoFiles, setFormatoFiles] = useState<UploadingFile[]>([]);
  const [documentosFiles, setDocumentosFiles] = useState(DOCUMENTOS_FILES_VACIO);
  // Los archivos se suben a esta carpeta temporal antes de que exista un folio real.
  const [draftId] = useState(() => crypto.randomUUID());

  // El catalogo de sitios ya va cargado cuando se elige el servicio.
  useEffect(() => { precargarSitios(); }, []);

  const hoy = useMemo(() => new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }), []);
  const servicioSeleccionado = form.servicioId ? findServicio(form.servicioId) : undefined;
  const filesUploading = files.some((f) => f.status === "uploading");
  const formatoUploading = formatoFiles.some((f) => f.status === "uploading" || f.status === "validando");
  const documentosUploading = Object.values(documentosFiles).some((fs) => fs.some((f) => f.status === "uploading"));

  const requiereFormato = SERVICIOS_CON_FORMATO_OBLIGATORIO_IDS.includes(form.servicioId);
  const requiereDocumentosIndividuales = SERVICIOS_CON_DOCUMENTOS_INDIVIDUALES_IDS.includes(form.servicioId);
  const requiereDatosContrato = SERVICIOS_CON_DATOS_CONTRATO_IDS.includes(form.servicioId);

  function handleFilesSelected(selected: File[]) {
    const entries: UploadingFile[] = selected.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading",
    }));
    setFiles((prev) => [...prev, ...entries]);
    setErrors((prev) => ({ ...prev, documentacion: "" }));

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

  function setContrato<K extends keyof ContratoCapturado>(key: K, value: ContratoCapturado[K]) {
    setContratoState((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  function validar(): boolean {
    const next = validarSolicitud({
      areaEmpresa: form.areaEmpresa,
      servicioId: form.servicioId,
      descripcion: form.descripcion,
      sitioListo: Boolean(sitio.clave && sitio.alias),
      requiereFormato,
      formatoListo: formatoFiles.length === 1 && formatoFiles[0].status === "done",
      documentacionObligatoria: requiereFormato && !requiereDocumentosIndividuales,
      documentosFaltantes: requiereDocumentosIndividuales
        ? DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO.filter((d) => documentosFiles[d.key][0]?.status !== "done")
        : [],
      documentacionListos: files.filter((f) => f.status === "done").length,
      requiereDatosContrato,
      contrato,
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validar() || filesUploading || formatoUploading || documentosUploading || !uid || !nombre) return;

    setSubmitError(null);
    setCreating(true);
    try {
      const contratoArrendamiento: ContratoArrendamientoInput | undefined = requiereDatosContrato
        ? {
            domicilio: contrato.domicilio,
            altaArrendador: contrato.altaArrendador,
            solicitante: contrato.solicitante,
            periodoInicio: contrato.periodoInicio,
            periodoFin: contrato.periodoFin,
            condicionesPago: `${contrato.condicionesCodigo} - ${contrato.condicionesTipo}`,
            montoPago: parseMontoInput(contrato.montoPago),
            motivo: contrato.motivo,
          }
        : undefined;

      const documentosArrendamiento: DocumentosArrendamientoInput | undefined = requiereDocumentosIndividuales
        ? (Object.fromEntries(
            DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO.map((doc) => [doc.key, documentosFiles[doc.key][0]?.url ?? ""])
          ) as unknown as DocumentosArrendamientoInput)
        : undefined;

      const documentacion = files.filter((f) => f.status === "done" && f.url).map((f) => f.url!);

      const { id, folio } = await createTicket({
        solicitanteId: uid,
        solicitanteNombre: nombre,
        areaEmpresa: form.areaEmpresa,
        servicioId: form.servicioId,
        descripcion: form.descripcion,
        documentacion,
        formatoArrendamientoUrl: requiereFormato ? formatoFiles[0]?.url : undefined,
        documentosArrendamiento,
        contratoArrendamiento,
        sitioArrendamiento: { clave: sitio.clave, alias: sitio.alias },
      });
      setFolioCreado(folio);
      // Best-effort: si falla, el ticket ya existe y Legal puede regenerar el resumen.
      if (encontrarContrato(documentacion)) void solicitarResumenContrato(id).catch(() => {});
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
    setSitio(SELECCION_VACIA);
    setFiles([]);
    setFormatoFiles([]);
    setDocumentosFiles(DOCUMENTOS_FILES_VACIO);
    setErrors({});
  }

  if (folioCreado) {
    return (
      <div className="section-card p-5 sm:p-8 max-w-xl">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
          <div>
            <h2 className="text-lg font-semibold">Solicitud creada: {folioCreado}</h2>
            <p className="text-sm text-muted mt-0.5">
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

  const ocupado = filesUploading || formatoUploading || documentosUploading || creating;

  return (
    <form onSubmit={handleSubmit} className="max-w-[1400px]">
      <section className="rounded-lg border border-border bg-surface p-4 mb-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div><span className="text-muted">Fecha de solicitud: </span><span className="font-medium">{hoy}</span></div>
        <div><span className="text-muted">Solicitante: </span><span className="font-medium">{nombre}</span></div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <section className="section-card p-5 sm:p-6 space-y-5">
            <h2 className="section-title"><span className="text-accent mr-2 tabular-nums">1</span>Solicitud</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="field-label">
                  Empresa / Área solicitante <span className="text-danger">*</span>
                </label>
                <select
                  value={form.areaEmpresa}
                  onChange={(e) => set("areaEmpresa", e.target.value)}
                  className="w-full field"
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
              </div>
            </div>

            {servicioSeleccionado && (
              <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface px-3 py-2 text-sm">
                <CategoriaBadge categoria={servicioSeleccionado.categoria} />
                <span className="text-muted">Puesto responsable: <span className="font-medium opacity-100">{servicioSeleccionado.puestoResponsable}</span></span>
                <span className="text-muted">SLA interno: <span className="font-medium opacity-100">{servicioSeleccionado.slaInterno} días hábiles</span></span>
              </div>
            )}

            {servicioSeleccionado && (
              <div>
                <p className="eyebrow mb-3">Sitio</p>
                <SitioSelector
                  value={sitio}
                  onChange={(v) => {
                    setSitio(v);
                    setErrors((prev) => ({ ...prev, sitio: "" }));
                  }}
                  error={errors.sitio}
                />
              </div>
            )}

            <div>
              <label className="field-label">
                Descripción de la solicitud <span className="text-danger">*</span>
              </label>
              <textarea
                value={form.descripcion}
                onChange={(e) => set("descripcion", e.target.value)}
                rows={4}
                placeholder="Describe con el mayor detalle posible lo que necesitas..."
                className="field w-full resize-y"
              />
              {errors.descripcion && <p className="text-xs text-danger mt-1">{errors.descripcion}</p>}
            </div>
          </section>

          {requiereDatosContrato && (
            <section className="section-card p-5 sm:p-6 space-y-5">
              <h2 className="section-title"><span className="text-accent mr-2 tabular-nums">2</span>Datos del contrato / convenio</h2>
              <DatosContratoFields contrato={contrato} errors={errors} onChange={setContrato} />
            </section>
          )}
        </div>

        <aside className="section-card p-5 sm:p-6 space-y-6 min-w-0">
          <h2 className="section-title">
            <span className="text-accent mr-2 tabular-nums">{requiereDatosContrato ? 3 : 2}</span>Documentos
          </h2>

          {requiereFormato && (
            <div>
              <label className="field-label">
                Formato de Solicitud de Arrendamiento <span className="text-danger">*</span>
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
              <p className="text-xs text-muted mt-1.5">
                Descarga el formato oficial, llenalo, y sube aqui el mismo archivo — no se acepta otra plantilla.
              </p>
              {errors.formato && <p className="text-xs text-danger mt-1">{errors.formato}</p>}
            </div>
          )}

          {requiereDocumentosIndividuales && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO.map((doc) => (
                <div key={doc.key}>
                  <label className="field-label">
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
          )}

          <div>
            <label className="field-label">
              Documentación adjunta {requiereFormato && !requiereDocumentosIndividuales && <span className="text-danger">*</span>}
            </label>
            {requiereFormato && !requiereDocumentosIndividuales && (
              <p className="text-xs text-muted mb-2">
                Adjunta aqui, en uno o varios archivos: {DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO.map((d) => d.label.toLowerCase()).join(", ")}.
              </p>
            )}
            <FileDropzone files={files} onFilesSelected={handleFilesSelected} onRemove={handleRemoveFile} />
            {errors.documentacion && <p className="text-xs text-danger mt-1">{errors.documentacion}</p>}
          </div>
        </aside>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="success" disabled={ocupado}>
            {filesUploading || formatoUploading || documentosUploading ? "Esperando archivos..." : creating ? "Guardando..." : "Crear ticket"}
          </Button>
          <Button type="button" variant="danger" onClick={() => router.push("/tickets")}>
            Cancelar
          </Button>
          {submitError && <span className="text-sm text-danger">{submitError}</span>}
        </div>
      </div>
    </form>
  );
}
