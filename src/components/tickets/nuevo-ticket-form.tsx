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
  URL_FORMATO_SOLICITUD_ARRENDAMIENTO, DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO, SERVICIO_ALTA_ARRENDADOR_ID, type DocumentoRequeridoArrendamientoKey,
} from "@/lib/data/arrendamientos-temporal";
import { parseMontoInput } from "@/lib/text-format";
import { validarFormatoArrendamiento } from "@/lib/validar-formato";
import { validarSolicitud, type ContratoCapturado, type SolicitudCapturada } from "@/domain/tickets/nuevo-ticket-validacion";
import { faltantesPorSeccion, textoFaltan, totalFaltantes } from "@/domain/tickets/avance-formulario";
import { Campo } from "@/components/forms/campo";
import { SeccionFormulario } from "@/components/forms/seccion-formulario";
import { ResumenErrores } from "@/components/forms/resumen-errores";
import { RielAvance } from "@/components/forms/riel-avance";
import { BarraAcciones } from "@/components/forms/barra-acciones";
import { ConfirmarEnvio } from "@/components/forms/confirmar-envio";
import { DocumentoSlot } from "@/components/forms/documento-slot";
import { ServicioSelector } from "./servicio-selector";
import { SitioSelector } from "./sitio-selector";
import { DatosContratoFields } from "./datos-contrato-fields";
import { AltaArrendadorFields } from "./alta-arrendador-fields";
import { documentosAltaRequeridos, type AltaCapturada } from "@/domain/tickets/alta-arrendador-rules";
import { useSitios } from "@/hooks/use-sitios";
import { SELECCION_VACIA, sitioDeSeleccion, type SeleccionSitio } from "@/domain/sitios/sitios-rules";
import { uploadTicketFile, deleteTicketDocument } from "@/lib/storage";
import { createTicket } from "@/lib/tickets";
import { solicitarResumenContrato } from "@/lib/contratos";
import { encontrarContrato } from "@/domain/contratos/contrato-rules";
import { precargarSitios } from "@/lib/sitios";
import type { AltaArrendadorInput, ContratoArrendamientoInput, DocumentoAltaKey, DocumentosArrendamientoInput } from "@/types/ticket";

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
  domicilio: "", altaArrendador: "",
  periodoInicio: "", periodoFin: "", condicionesCodigo: "", condicionesTipo: "", montoPago: "", motivo: "",
};

const EMPTY_ALTA: AltaCapturada = { tipoAlta: "", motivoCambio: "" };

// Que errores de validacion le tocan a cada seccion; los documentos reciben el resto.
const CLAVES_SOLICITUD = ["areaEmpresa", "servicioId", "sitio", "descripcion"];
const CLAVES_ALTA = ["tipoAlta", "motivoCambio"];
const CLAVES_CONTRATO = ["domicilio", "altaArrendador", "periodoInicio", "periodoFin", "condicionesPago", "montoPago", "motivo"];

export function NuevoTicketForm() {
  const router = useRouter();
  const { uid, nombre } = useAuthStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [contrato, setContratoState] = useState<ContratoCapturado>(EMPTY_CONTRATO);
  const [sitio, setSitio] = useState<SeleccionSitio>(SELECCION_VACIA);
  // Los errores se calculan siempre (para el avance), pero solo se muestran despues de intentar enviar.
  const [intentado, setIntentado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [folioCreado, setFolioCreado] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [formatoFiles, setFormatoFiles] = useState<UploadingFile[]>([]);
  const [documentosFiles, setDocumentosFiles] = useState(DOCUMENTOS_FILES_VACIO);
  const [alta, setAlta] = useState<AltaCapturada>(EMPTY_ALTA);
  const [altaDocsFiles, setAltaDocsFiles] = useState<Partial<Record<DocumentoAltaKey, UploadingFile[]>>>({});
  const { sitios } = useSitios();
  // Los archivos se suben a esta carpeta temporal antes de que exista un folio real.
  const [draftId] = useState(() => crypto.randomUUID());

  // El catalogo de sitios ya va cargado cuando se elige el servicio.
  useEffect(() => { precargarSitios(); }, []);

  const hoy = useMemo(() => new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }), []);
  const servicioSeleccionado = form.servicioId ? findServicio(form.servicioId) : undefined;
  const filesUploading = files.some((f) => f.status === "uploading");
  const formatoUploading = formatoFiles.some((f) => f.status === "uploading" || f.status === "validando");
  const esAlta = form.servicioId === SERVICIO_ALTA_ARRENDADOR_ID;
  const docsAlta = documentosAltaRequeridos(alta.tipoAlta);
  const geolocalizacion = sitioDeSeleccion(sitios, sitio)?.geolocalizacion ?? null;
  const documentosUploading =
    Object.values(documentosFiles).some((fs) => fs.some((f) => f.status === "uploading")) ||
    Object.values(altaDocsFiles).some((fs) => fs?.some((f) => f.status === "uploading"));
  const ocupado = filesUploading || formatoUploading || documentosUploading || creating;

  const requiereFormato = SERVICIOS_CON_FORMATO_OBLIGATORIO_IDS.includes(form.servicioId);
  const requiereDocumentosIndividuales = SERVICIOS_CON_DOCUMENTOS_INDIVIDUALES_IDS.includes(form.servicioId) && !esAlta;
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

  function handleAltaDocSeleccionado(key: DocumentoAltaKey, selected: File[]) {
    const file = selected[0];
    if (!file) return;
    const anterior = altaDocsFiles[key]?.[0];
    const entry: UploadingFile = { id: crypto.randomUUID(), name: file.name, size: file.size, progress: 0, status: "uploading" };
    setAltaDocsFiles((prev) => ({ ...prev, [key]: [entry] }));

    uploadTicketFile(
      `tickets-drafts/${draftId}`,
      file,
      (pct) => setAltaDocsFiles((prev) => ({ ...prev, [key]: (prev[key] ?? []).map((f) => (f.id === entry.id ? { ...f, progress: pct } : f)) }))
    )
      .then(({ url, path }) => {
        setAltaDocsFiles((prev) => ({ ...prev, [key]: (prev[key] ?? []).map((f) => (f.id === entry.id ? { ...f, status: "done", progress: 100, url, path } : f)) }));
      })
      .catch((err) => {
        setAltaDocsFiles((prev) => ({ ...prev, [key]: (prev[key] ?? []).map((f) => (f.id === entry.id ? { ...f, status: "error", error: err?.message } : f)) }));
      });

    if (anterior?.status === "done" && anterior.path) {
      deleteTicketDocument(anterior.path).catch(() => {});
    }
  }

  async function handleRemoveAltaDoc(key: DocumentoAltaKey, id: string) {
    const target = altaDocsFiles[key]?.find((f) => f.id === id);
    setAltaDocsFiles((prev) => ({ ...prev, [key]: [] }));
    if (target?.status === "done" && target.path) {
      try { await deleteTicketDocument(target.path); } catch { /* ya se quito de la lista, no bloquea al usuario */ }
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setContrato<K extends keyof ContratoCapturado>(key: K, value: ContratoCapturado[K]) {
    setContratoState((prev) => ({ ...prev, [key]: value }));
  }

  function construirSolicitud(): SolicitudCapturada {
    return {
      areaEmpresa: form.areaEmpresa,
      servicioId: form.servicioId,
      descripcion: form.descripcion,
      sitioListo: Boolean(sitio.clave && sitio.alias),
      requiereFormato,
      formatoListo: formatoFiles.length === 1 && formatoFiles[0].status === "done",
      documentacionObligatoria: requiereFormato && !requiereDocumentosIndividuales && !esAlta,
      documentosFaltantes: esAlta
        ? docsAlta.filter((d) => altaDocsFiles[d.key]?.[0]?.status !== "done")
        : requiereDocumentosIndividuales
          ? DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO.filter((d) => documentosFiles[d.key][0]?.status !== "done")
          : [],
      documentacionListos: files.filter((f) => f.status === "done").length,
      requiereDatosContrato,
      contrato,
      ...(esAlta ? { alta } : {}),
    };
  }

  const erroresReales = validarSolicitud(construirSolicitud());
  const errors = intentado ? erroresReales : {};

  const secciones = [
    { id: "seccion-solicitud", titulo: "¿Qué necesitas?", claves: CLAVES_SOLICITUD },
    ...(requiereDatosContrato && esAlta ? [{ id: "seccion-alta", titulo: "Tipo de alta", claves: CLAVES_ALTA }] : []),
    ...(requiereDatosContrato ? [{ id: "seccion-contrato", titulo: "Datos del contrato", claves: CLAVES_CONTRATO }] : []),
    { id: "seccion-documentos", titulo: "Documentos" },
  ];
  const avance = faltantesPorSeccion(erroresReales, secciones);
  const faltan = totalFaltantes(avance);

  // Primero revisa: si falta algo lleva al aviso; si todo esta bien pide confirmar antes de enviar.
  function handleRevisar(e: React.FormEvent) {
    e.preventDefault();
    setIntentado(true);
    if (faltan > 0) {
      requestAnimationFrame(() => {
        const aviso = document.getElementById("resumen-errores");
        aviso?.scrollIntoView({ behavior: "smooth", block: "start" });
        aviso?.focus({ preventScroll: true });
      });
      return;
    }
    if (ocupado) return;
    setSubmitError(null);
    setConfirmando(true);
  }

  async function enviar() {
    if (!uid || !nombre) return;
    setSubmitError(null);
    setCreating(true);
    try {
      const contratoArrendamiento: ContratoArrendamientoInput | undefined = requiereDatosContrato
        ? {
            domicilio: contrato.domicilio,
            altaArrendador: contrato.altaArrendador,
            solicitante: nombre,
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

      const altaArrendador: AltaArrendadorInput | undefined = esAlta
        ? {
            tipoAlta: alta.tipoAlta as "nuevo" | "cambio",
            ...(alta.tipoAlta === "cambio" ? { motivoCambio: alta.motivoCambio.trim() } : {}),
            ...(geolocalizacion ? { geolocalizacion } : {}),
            documentos: Object.fromEntries(
              docsAlta.map((d) => [d.key, altaDocsFiles[d.key]?.[0]?.url ?? ""]).filter(([, url]) => url)
            ),
          }
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
        ...(altaArrendador ? { altaArrendador } : {}),
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
    setAlta(EMPTY_ALTA);
    setAltaDocsFiles({});
    setIntentado(false);
    setConfirmando(false);
    setSubmitError(null);
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

  const numero = (id: string) => secciones.findIndex((s) => s.id === id) + 1;
  const archivosSubidos =
    [...files, ...formatoFiles, ...Object.values(documentosFiles).flat(), ...Object.values(altaDocsFiles).flat()]
      .filter((f) => f?.status === "done").length;

  return (
    <form onSubmit={handleRevisar} noValidate className="w-full">
      <section className="rounded-lg border border-border bg-surface p-4 mb-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div><span className="text-muted">Fecha de solicitud: </span><span className="font-medium">{hoy}</span></div>
        <div><span className="text-muted">Solicitante: </span><span className="font-medium">{nombre}</span></div>
      </section>

      <p className="text-sm text-muted mb-5">
        Los campos con <span className="font-bold text-danger" aria-hidden="true">*</span> son obligatorios.
        Los marcados como &quot;Opcional&quot; puedes dejarlos vacíos.
      </p>

      <RielAvance secciones={avance} resaltarFaltantes={intentado} />

      <div>
        <div className="space-y-5 min-w-0">
          <ResumenErrores secciones={avance} visible={intentado} />

          <SeccionFormulario id="seccion-solicitud" numero={numero("seccion-solicitud")} titulo="¿Qué necesitas?" descripcion="Cuéntanos qué trámite pides y para qué sitio.">
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-3">
                <Campo id="solicitud-area" etiqueta="Empresa y área que solicita" error={errors.areaEmpresa}>
                  <select
                    id="solicitud-area"
                    value={form.areaEmpresa}
                    onChange={(e) => set("areaEmpresa", e.target.value)}
                    aria-invalid={!!errors.areaEmpresa}
                    className="w-full field"
                  >
                    <option value="">Selecciona la empresa y el área...</option>
                    {AREAS_EMPRESA.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </Campo>

                <ServicioSelector
                  className="contents"
                  value={form.servicioId}
                  onChange={(v) => set("servicioId", v)}
                  error={errors.servicioId}
                  soloIds={SERVICIOS_ARRENDAMIENTO_IDS}
                />
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
                  <SitioSelector value={sitio} onChange={setSitio} error={errors.sitio} />
                </div>
              )}

              <Campo id="solicitud-descripcion" etiqueta="Descripción de la solicitud" error={errors.descripcion}>
                <textarea
                  id="solicitud-descripcion"
                  value={form.descripcion}
                  onChange={(e) => set("descripcion", e.target.value)}
                  rows={4}
                  placeholder="Describe con el mayor detalle posible lo que necesitas..."
                  aria-invalid={!!errors.descripcion}
                  className="field w-full resize-y"
                />
              </Campo>
            </div>
          </SeccionFormulario>

          {requiereDatosContrato && esAlta && (
            <SeccionFormulario id="seccion-alta" numero={numero("seccion-alta")} titulo="Tipo de alta" descripcion="Dinos si es un arrendador nuevo o si cambia el que ya teníamos.">
              <AltaArrendadorFields alta={alta} errors={errors} geolocalizacion={geolocalizacion} onChange={setAlta} />
            </SeccionFormulario>
          )}

          {requiereDatosContrato && (
            <SeccionFormulario id="seccion-contrato" numero={numero("seccion-contrato")} titulo="Datos del contrato" descripcion="Estos datos son los mismos en todos los trámites de arrendamiento.">
              <DatosContratoFields contrato={contrato} errors={errors} onChange={setContrato} />
            </SeccionFormulario>
          )}

          <SeccionFormulario id="seccion-documentos" numero={numero("seccion-documentos")} titulo="Documentos" descripcion="Sube cada documento en su lugar. Puedes usar PDF o fotos claras.">
            <div className="space-y-4">
              {requiereFormato && (
                <DocumentoSlot
                  titulo="Formato de Solicitud de Arrendamiento"
                  ayuda="Descarga el formato oficial, llénalo y súbelo aquí. No se acepta otra plantilla."
                  archivos={formatoFiles}
                  error={errors.formato}
                >
                  <a
                    href={URL_FORMATO_SOLICITUD_ARRENDAMIENTO}
                    download
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline mb-3"
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
                </DocumentoSlot>
              )}

              {requiereDocumentosIndividuales && DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO.map((doc) => (
                <DocumentoSlot key={doc.key} titulo={doc.label} archivos={documentosFiles[doc.key]} error={errors[doc.key]}>
                  <FileDropzone
                    files={documentosFiles[doc.key]}
                    onFilesSelected={(selected) => handleDocumentoSeleccionado(doc.key, selected)}
                    onRemove={(id) => handleRemoveDocumento(doc.key, id)}
                    multiple={false}
                  />
                </DocumentoSlot>
              ))}

              {esAlta && docsAlta.map((doc) => (
                <DocumentoSlot key={doc.key} titulo={doc.label} ayuda={doc.ayuda} archivos={altaDocsFiles[doc.key] ?? []} error={errors[doc.key]}>
                  <FileDropzone
                    files={altaDocsFiles[doc.key] ?? []}
                    onFilesSelected={(selected) => handleAltaDocSeleccionado(doc.key, selected)}
                    onRemove={(id) => handleRemoveAltaDoc(doc.key, id)}
                    multiple={false}
                  />
                </DocumentoSlot>
              ))}

              <DocumentoSlot
                titulo="Documentación adjunta"
                obligatorio={requiereFormato && !requiereDocumentosIndividuales && !esAlta}
                ayuda={requiereFormato && !requiereDocumentosIndividuales && !esAlta
                  ? `Adjunta aquí, en uno o varios archivos: ${DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO.map((d) => d.label.toLowerCase()).join(", ")}.`
                  : "Cualquier otro archivo que ayude a entender tu solicitud."}
                archivos={files}
                error={errors.documentacion}
              >
                <FileDropzone files={files} onFilesSelected={handleFilesSelected} onRemove={handleRemoveFile} />
              </DocumentoSlot>
            </div>
          </SeccionFormulario>
        </div>
      </div>

      <BarraAcciones estado={faltan === 0 ? "Todo listo para enviar" : `${textoFaltan(faltan)} para poder enviar`}>
        <Button type="button" variant="outline" onClick={() => router.push("/tickets")}>
          Cancelar
        </Button>
        <Button type="submit" variant="success" disabled={ocupado}>
          {filesUploading || formatoUploading || documentosUploading ? "Esperando archivos..." : "Revisar y enviar"}
        </Button>
      </BarraAcciones>

      <ConfirmarEnvio
        abierto={confirmando}
        enviando={creating}
        error={submitError}
        resumen={[
          ["Servicio", servicioSeleccionado?.servicio ?? ""],
          ["Empresa y área", form.areaEmpresa],
          ["Sitio", sitio.clave ? `${sitio.clave} · ${sitio.alias}` : ""],
          ["Archivos subidos", String(archivosSubidos)],
        ]}
        onVolver={() => setConfirmando(false)}
        onConfirmar={enviar}
      />
    </form>
  );
}
