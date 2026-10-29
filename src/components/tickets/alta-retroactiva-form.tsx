"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDropzone, type UploadingFile } from "@/components/ui/file-dropzone";
import { useSitios } from "@/hooks/use-sitios";
import { sitioDeSeleccion } from "@/domain/sitios/sitios-rules";
import { uploadTicketFile, deleteTicketDocumentByUrl } from "@/lib/storage";
import {
  documentosAltaIniciales, documentosAltaRequeridos, validarAltaRetroactiva,
  type AltaCapturada, type AltaRetroactivaCapturada,
} from "@/domain/tickets/alta-arrendador-rules";
import type { DocumentoAltaKey, Ticket } from "@/types/ticket";
import { AltaArrendadorFields } from "./alta-arrendador-fields";
import { seleccionDeSitio } from "./sitio-selector";

interface Props {
  ticketId: string;
  ticket: Pick<Ticket, "altaArrendador" | "documentosArrendamiento" | "sitioArrendamiento">;
  onGuardar: (entrada: AltaRetroactivaCapturada) => Promise<void>;
}

type Documentos = Partial<Record<DocumentoAltaKey, string>>;

function altaInicial(ticket: Props["ticket"]): AltaCapturada {
  const a = ticket.altaArrendador;
  return { tipoAlta: a?.tipoAlta ?? "", motivoCambio: a?.motivoCambio ?? "" };
}

// Tickets de Alta anteriores al formulario nuevo: el abogado captura lo que el solicitante no pudo.
// Solo el tipo de alta es obligatorio; los documentos se capturan si se conocen.
export function AltaRetroactivaForm({ ticketId, ticket, onGuardar }: Props) {
  const { sitios } = useSitios();
  const [abierto, setAbierto] = useState(false);
  const [alta, setAlta] = useState<AltaCapturada>(() => altaInicial(ticket));
  const [documentos, setDocumentos] = useState<Documentos>(() => documentosAltaIniciales(ticket));
  const [archivos, setArchivos] = useState<Partial<Record<DocumentoAltaKey, UploadingFile[]>>>({});
  // Archivos reemplazados o quitados: se borran de Storage solo despues de guardar bien.
  const [porBorrar, setPorBorrar] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const geolocalizacion = sitioDeSeleccion(sitios, seleccionDeSitio(ticket.sitioArrendamiento))?.geolocalizacion ?? null;
  const subiendo = Object.values(archivos).some((fs) => fs?.some((f) => f.status === "uploading"));
  const completado = !!ticket.altaArrendador;

  function abrir() {
    setAlta(altaInicial(ticket));
    setDocumentos(documentosAltaIniciales(ticket));
    setArchivos({});
    setPorBorrar([]);
    setErrors({});
    setError(null);
    setAbierto(true);
  }

  function subir(key: DocumentoAltaKey, selected: File[]) {
    const file = selected[0];
    if (!file) return;
    const anterior = documentos[key];
    const entry: UploadingFile = { id: crypto.randomUUID(), name: file.name, size: file.size, progress: 0, status: "uploading" };
    setArchivos((p) => ({ ...p, [key]: [entry] }));
    uploadTicketFile(`tickets/${ticketId}`, file, (pct) =>
      setArchivos((p) => ({ ...p, [key]: p[key]?.map((f) => (f.id === entry.id ? { ...f, progress: pct } : f)) }))
    )
      .then(({ url, path }) => {
        setArchivos((p) => ({ ...p, [key]: [{ ...entry, status: "done", progress: 100, url, path }] }));
        setDocumentos((p) => ({ ...p, [key]: url }));
        if (anterior) setPorBorrar((p) => [...p, anterior]);
      })
      .catch((err) => setArchivos((p) => ({ ...p, [key]: [{ ...entry, status: "error", error: err?.message }] })));
  }

  function quitar(key: DocumentoAltaKey) {
    setArchivos((p) => ({ ...p, [key]: [] }));
    const anterior = documentos[key];
    if (anterior) setPorBorrar((p) => [...p, anterior]);
    setDocumentos((p) => { const { [key]: _omitido, ...resto } = p; return resto; });
  }

  async function guardar() {
    const entrada: AltaRetroactivaCapturada = { ...alta, geolocalizacion, documentos };
    const errores = validarAltaRetroactiva(entrada);
    setErrors(errores);
    if (Object.keys(errores).length > 0) return;

    setGuardando(true);
    setError(null);
    try {
      await onGuardar(entrada);
      const vigentes = new Set(Object.values(documentos));
      for (const url of porBorrar) if (!vigentes.has(url)) deleteTicketDocumentByUrl(url).catch(() => {});
      setPorBorrar([]);
      setAbierto(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          {completado
            ? "Estos datos los capturó Legal después de la solicitud. Puedes corregirlos mientras el ticket no esté en Pre-Cierre."
            : "Este ticket se creó antes del formulario nuevo. Captura aquí lo que falte: el tipo de alta y los documentos."}
        </p>
        <Button type="button" variant="outline" onClick={abrir}>
          {completado ? "Editar datos de alta" : "Completar datos de alta"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AltaArrendadorFields
        alta={alta}
        errors={errors}
        geolocalizacion={geolocalizacion}
        onChange={(a) => { setAlta(a); setErrors({}); }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {documentosAltaRequeridos(alta.tipoAlta).map((doc) => (
          <div key={doc.key}>
            <label className="field-label">{doc.label}</label>
            <FileDropzone files={archivos[doc.key] ?? []} onFilesSelected={(f) => subir(doc.key, f)} onRemove={() => quitar(doc.key)} multiple={false} />
            {documentos[doc.key] && (
              <a href={documentos[doc.key]} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                Ver documento subido
              </a>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted">Solo el tipo de alta es obligatorio. Captura todo lo que conozcas.</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="success" onClick={guardar} disabled={guardando || subiendo}>
          {guardando ? "Guardando..." : subiendo ? "Esperando archivos..." : "Guardar datos de alta"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setAbierto(false)} disabled={guardando}>Cancelar</Button>
      </div>
    </div>
  );
}
