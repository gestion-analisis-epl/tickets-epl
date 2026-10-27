"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDropzone, type UploadingFile } from "@/components/ui/file-dropzone";
import { uploadTicketFile, deleteTicketDocumentByUrl } from "@/lib/storage";
import { faltantesRevisionLegal, normalizarRevisionLegal } from "@/domain/tickets/revision-legal-rules";
import type { Beneficiario, EscenarioBeneficiario, ModalidadVarios, RevisionLegal, TipoPropietario } from "@/types/ticket";

interface Props {
  ticketId: string;
  revision: RevisionLegal | undefined;
  editable: boolean;
  onGuardar: (revision: RevisionLegal) => Promise<void>;
}

type CampoDoc =
  | "documentoPersonalidad" | "documentoPropiedad" | "cartaAutorizacion"
  | "documentoBeneficiario" | "documentoRepresentante" | "cartaRepresentante";

// Por ahora el tipo de limitacion es campo libre; pasara a lista desplegable.
const TIPO_LIMITACION_LIBRE = true;

// Texto estable (llaves ordenadas) para comparar contenido sin depender del orden que devuelva Firestore.
function clave(o: object): string {
  return JSON.stringify(o, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );
}

function SiNo({ valor, onChange, disabled }: { valor: boolean | undefined; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <div className="flex gap-4">
      {[true, false].map((v) => (
        <label key={String(v)} className="inline-flex items-center gap-2 text-sm">
          <input type="radio" checked={valor === v} onChange={() => onChange(v)} disabled={disabled} />
          {v ? "Sí" : "No"}
        </label>
      ))}
    </div>
  );
}

export function RevisionLegalPanel({ ticketId, revision, editable, onGuardar }: Props) {
  const [r, setR] = useState<RevisionLegal>(revision ?? {});
  const [archivos, setArchivos] = useState<Partial<Record<CampoDoc, UploadingFile[]>>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Archivos reemplazados o quitados: se borran de Storage solo despues de guardar bien.
  const [porBorrar, setPorBorrar] = useState<string[]>([]);

  // Reinicia desde lo guardado solo si cambio el contenido real y no hay cambios sin guardar.
  const claveGuardada = clave(revision ?? {});
  const [claveBase, setClaveBase] = useState(claveGuardada);
  if (claveBase !== claveGuardada) {
    setClaveBase(claveGuardada);
    if (clave(r) === claveBase && porBorrar.length === 0) {
      setR(revision ?? {});
      setArchivos({});
    }
  }

  const set = <K extends keyof RevisionLegal>(k: K, v: RevisionLegal[K]) => setR((prev) => ({ ...prev, [k]: v }));
  const normalizada = normalizarRevisionLegal(r);
  const faltantes = faltantesRevisionLegal(normalizada);
  const subiendo = Object.values(archivos).some((fs) => fs?.some((f) => f.status === "uploading"));
  const dis = !editable;

  // Un solo archivo por documento; el nuevo reemplaza al anterior (el anterior se borra al guardar).
  function subir(campo: CampoDoc, selected: File[]) {
    const file = selected[0];
    if (!file) return;
    const anterior = r[campo];
    const entry: UploadingFile = { id: crypto.randomUUID(), name: file.name, size: file.size, progress: 0, status: "uploading" };
    setArchivos((p) => ({ ...p, [campo]: [entry] }));
    uploadTicketFile(`tickets/${ticketId}`, file, (pct) =>
      setArchivos((p) => ({ ...p, [campo]: p[campo]?.map((f) => (f.id === entry.id ? { ...f, progress: pct } : f)) }))
    )
      .then(({ url, path }) => {
        setArchivos((p) => ({ ...p, [campo]: [{ ...entry, status: "done", progress: 100, url, path }] }));
        set(campo, url);
        if (anterior) setPorBorrar((p) => [...p, anterior]);
      })
      .catch((err) => setArchivos((p) => ({ ...p, [campo]: [{ ...entry, status: "error", error: err?.message }] })));
  }

  function quitar(campo: CampoDoc) {
    setArchivos((p) => ({ ...p, [campo]: [] }));
    const anterior = r[campo];
    if (anterior) setPorBorrar((p) => [...p, anterior]);
    setR((prev) => { const { [campo]: _omitido, ...resto } = prev; return resto; });
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const guardada = normalizarRevisionLegal(r);
      await onGuardar(guardada);
      const vigentes = new Set(Object.values(guardada).filter((v): v is string => typeof v === "string"));
      for (const url of porBorrar) if (!vigentes.has(url)) deleteTicketDocumentByUrl(url).catch(() => {});
      setPorBorrar([]);
      setArchivos({});
      setR(guardada);
    }
    catch { setError("No se pudo guardar. Intenta de nuevo."); }
    finally { setGuardando(false); }
  }

  const documento = (campo: CampoDoc, etiqueta: string) => (
    <div>
      <label className="field-label">{etiqueta} <span className="text-danger">*</span></label>
      {editable ? (
        <FileDropzone files={archivos[campo] ?? []} onFilesSelected={(f) => subir(campo, f)} onRemove={() => quitar(campo)} multiple={false} />
      ) : null}
      {r[campo] && (
        <a href={r[campo]} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Ver documento subido</a>
      )}
      {!r[campo] && !editable && <p className="text-sm text-muted">Sin adjuntar</p>}
    </div>
  );

  const lista: Beneficiario[] = r.beneficiarios ?? [];
  const setLista = (nueva: Beneficiario[]) => set("beneficiarios", nueva);

  function elegirEscenario(e: EscenarioBeneficiario | "") {
    if (!e) return;
    setR((prev) => ({
      ...prev,
      escenarioBeneficiario: e,
      beneficiarios: e === "varios" && !prev.beneficiarios?.length
        ? [{ nombre: "", porcentaje: 0 }, { nombre: "", porcentaje: 0 }]
        : prev.beneficiarios,
    }));
  }

  function quitarBeneficiario(i: number) {
    setR((prev) => {
      const nueva = (prev.beneficiarios ?? []).filter((_, j) => j !== i);
      let rep = prev.representanteComun;
      if (rep !== undefined) rep = rep === i ? undefined : rep > i ? rep - 1 : rep;
      return { ...prev, beneficiarios: nueva, representanteComun: rep };
    });
  }

  return (
    <div className="space-y-5">
      {/* 1. Propietario */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label">Tipo de propietario</label>
          <select
            value={r.tipoPropietario ?? ""}
            onChange={(e) => e.target.value && set("tipoPropietario", e.target.value as TipoPropietario)}
            disabled={dis}
            className="w-full field"
          >
            <option value="">Selecciona...</option>
            <option value="fisica">Persona física</option>
            <option value="moral">Persona moral</option>
          </select>
        </div>
        {r.tipoPropietario && (
          <div>
            <label className="field-label">{r.tipoPropietario === "moral" ? "Razón social" : "Nombre completo del propietario"}</label>
            <input value={r.nombrePropietario ?? ""} onChange={(e) => set("nombrePropietario", e.target.value)} disabled={dis} className="w-full field" />
          </div>
        )}
        {r.tipoPropietario === "moral" && (
          <div className="sm:col-span-2">
            <label className="field-label">Nombre del representante legal</label>
            <input value={r.representanteLegal ?? ""} onChange={(e) => set("representanteLegal", e.target.value)} disabled={dis} className="w-full field" />
          </div>
        )}
      </div>
      {r.tipoPropietario === "moral" && documento("documentoPersonalidad", "Personalidad con actos de dominio para arrendar el inmueble")}

      {/* 2. Propiedad */}
      {r.tipoPropietario && (
        <div className="space-y-3">
          <label className="field-label">¿Se acredita la propiedad?</label>
          <SiNo valor={r.acreditaPropiedad} onChange={(v) => set("acreditaPropiedad", v)} disabled={dis} />
          {r.acreditaPropiedad === true && documento("documentoPropiedad", "Documento que acredita la propiedad")}
          {r.acreditaPropiedad === false && documento("cartaAutorizacion", "Carta de autorización")}
        </div>
      )}

      {/* 3. Limitacion */}
      {r.acreditaPropiedad !== undefined && (
        <div className="space-y-3">
          <label className="field-label">¿Existe alguna limitación sobre el inmueble?</label>
          <SiNo valor={r.hayLimitacion} onChange={(v) => set("hayLimitacion", v)} disabled={dis} />
          {r.hayLimitacion === true && TIPO_LIMITACION_LIBRE && (
            <div>
              <label className="field-label">Tipo de limitación</label>
              <input value={r.tipoLimitacion ?? ""} onChange={(e) => set("tipoLimitacion", e.target.value)} disabled={dis} className="w-full field" />
            </div>
          )}
        </div>
      )}

      {/* 4. Beneficiarios */}
      {r.hayLimitacion !== undefined && (
        <div className="space-y-3">
          <div>
            <label className="field-label">¿Quién recibe el pago de las rentas?</label>
            <select
              value={r.escenarioBeneficiario ?? ""}
              onChange={(e) => elegirEscenario(e.target.value as EscenarioBeneficiario | "")}
              disabled={dis}
              className="w-full field"
            >
              <option value="">Selecciona...</option>
              <option value="propietario">El propietario</option>
              <option value="tercero">Una persona o empresa distinta al propietario</option>
              <option value="varios">Varios beneficiarios</option>
            </select>
          </div>

          {r.escenarioBeneficiario === "tercero" && (
            <div className="space-y-3">
              <div>
                <label className="field-label">Nombre del beneficiario</label>
                <input value={r.beneficiarioNombre ?? ""} onChange={(e) => set("beneficiarioNombre", e.target.value)} disabled={dis} className="w-full field" />
              </div>
              {documento("documentoBeneficiario", "Acreditación del beneficiario")}
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={r.clausulaEspecial === true} onChange={(e) => set("clausulaEspecial", e.target.checked)} disabled={dis} />
                Se redactará una cláusula especial que nombre al beneficiario
              </label>
            </div>
          )}

          {r.escenarioBeneficiario === "varios" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="field-label">Beneficiarios</label>
                {lista.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={b.nombre}
                      onChange={(e) => setLista(lista.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                      disabled={dis}
                      placeholder={`Nombre del beneficiario ${i + 1}`}
                      className="w-full field"
                    />
                    {r.modalidadVarios === "equitativo" && (
                      <span className="text-sm tabular-nums whitespace-nowrap">
                        {((normalizada.beneficiarios?.[i]?.porcentaje ?? 0) / 100).toFixed(2)} %
                      </span>
                    )}
                    {editable && (
                      <Button type="button" variant="outline" size="sm" onClick={() => quitarBeneficiario(i)}>Quitar</Button>
                    )}
                  </div>
                ))}
                {editable && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setLista([...lista, { nombre: "", porcentaje: 0 }])}>
                    Agregar beneficiario
                  </Button>
                )}
              </div>

              <div>
                <label className="field-label">¿Cómo se reparte el pago?</label>
                <select
                  value={r.modalidadVarios ?? ""}
                  onChange={(e) => e.target.value && set("modalidadVarios", e.target.value as ModalidadVarios)}
                  disabled={dis}
                  className="w-full field"
                >
                  <option value="">Selecciona...</option>
                  <option value="equitativo">Partes iguales</option>
                  <option value="representante">Un representante común</option>
                </select>
              </div>

              {r.modalidadVarios === "representante" && (
                <div className="space-y-3">
                  <div>
                    <label className="field-label">Representante común</label>
                    <select
                      value={r.representanteComun === undefined ? "" : String(r.representanteComun)}
                      onChange={(e) => set("representanteComun", e.target.value === "" ? undefined : Number(e.target.value))}
                      disabled={dis}
                      className="w-full field"
                    >
                      <option value="">Selecciona...</option>
                      {lista.map((b, i) => (
                        <option key={i} value={i}>{b.nombre.trim() || `Beneficiario ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>
                  {documento("documentoRepresentante", "Acreditación del representante común")}
                  {documento("cartaRepresentante", "Carta que autoriza al representante a recibir la renta")}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Condicion de pago */}
      {r.escenarioBeneficiario && (
        <div className="space-y-3">
          <label className="field-label">¿Existe condición para el pago del arrendamiento?</label>
          <SiNo valor={r.hayCondicionPago} onChange={(v) => set("hayCondicionPago", v)} disabled={dis} />
          {r.hayCondicionPago === true && (
            <div>
              <label className="field-label">¿Cuál?</label>
              <input value={r.condicionPago ?? ""} onChange={(e) => set("condicionPago", e.target.value)} disabled={dis} className="w-full field" />
            </div>
          )}
        </div>
      )}

      {faltantes.length > 0 && (
        <div>
          <p className="text-sm font-medium">Falta por completar:</p>
          <ul className="list-disc pl-5 text-sm text-muted space-y-0.5">
            {faltantes.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}

      {editable && (
        <div className="space-y-2">
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button variant="success" onClick={guardar} disabled={guardando || subiendo}>
            {guardando ? "Guardando..." : "Guardar revisión legal"}
          </Button>
        </div>
      )}
    </div>
  );
}
