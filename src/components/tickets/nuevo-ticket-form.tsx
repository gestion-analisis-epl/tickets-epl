"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoriaBadge } from "@/components/ui/badge";
import { FileDropzone, type UploadingFile } from "@/components/ui/file-dropzone";
import { useAuthStore } from "@/stores/auth";
import { AREAS_EMPRESA } from "@/lib/data/listas";
import { findServicio, SERVICIOS_POR_CATEGORIA } from "@/lib/data/catalogo-servicios";
import { uploadTicketFile, deleteTicketDocument } from "@/lib/storage";
import { createTicket } from "@/lib/tickets";
import type { Categoria } from "@/types/catalogo";

interface FormState {
  areaEmpresa: string;
  servicioId: string;
  descripcion: string;
}

const EMPTY_FORM: FormState = { areaEmpresa: "", servicioId: "", descripcion: "" };

export function NuevoTicketForm() {
  const router = useRouter();
  const { uid, nombre } = useAuthStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [folioCreado, setFolioCreado] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadingFile[]>([]);
  // Los archivos se suben antes de que exista un folio real, bajo esta carpeta
  // temporal (ver lib/storage.ts para el porque).
  const [draftId] = useState(() => crypto.randomUUID());

  const hoy = useMemo(() => new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }), []);
  const servicioSeleccionado = form.servicioId ? findServicio(form.servicioId) : undefined;
  const filesUploading = files.some((f) => f.status === "uploading");

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

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validar(): boolean {
    const next: typeof errors = {};
    if (!form.areaEmpresa) next.areaEmpresa = "Selecciona el area o empresa solicitante.";
    if (!form.servicioId) next.servicioId = "Selecciona el servicio que necesitas.";
    if (!form.descripcion.trim()) next.descripcion = "Describe brevemente la solicitud.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validar() || filesUploading || !uid || !nombre) return;

    setSubmitError(null);
    setCreating(true);
    try {
      const { folio } = await createTicket({
        solicitanteId: uid,
        solicitanteNombre: nombre,
        areaEmpresa: form.areaEmpresa,
        servicioId: form.servicioId,
        descripcion: form.descripcion,
        documentacion: files.filter((f) => f.status === "done" && f.url).map((f) => f.url!),
      });
      setFolioCreado(folio);
    } catch {
      setSubmitError("No se pudo guardar el ticket. Intenta de nuevo en unos segundos.");
    } finally {
      setCreating(false);
    }
  }

  if (folioCreado) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 max-w-xl">
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
        <div className="flex gap-3 mt-6">
          <Button variant="primary" onClick={() => { setFolioCreado(null); setForm(EMPTY_FORM); setFiles([]); }}>
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
          <label className="block text-sm font-medium mb-1.5">
            Servicio solicitado <span className="text-danger">*</span>
          </label>
          <select
            value={form.servicioId}
            onChange={(e) => set("servicioId", e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Selecciona un servicio del catalogo...</option>
            {(Object.keys(SERVICIOS_POR_CATEGORIA) as Categoria[]).map((categoria) => (
              <optgroup key={categoria} label={categoria}>
                {SERVICIOS_POR_CATEGORIA[categoria].map((s) => (
                  <option key={s.id} value={s.id}>{s.servicio}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {errors.servicioId && <p className="text-xs text-danger mt-1">{errors.servicioId}</p>}

          {servicioSeleccionado && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-surface px-3 py-2 text-sm">
              <CategoriaBadge categoria={servicioSeleccionado.categoria} />
              <span className="opacity-70">Puesto responsable: <span className="font-medium opacity-100">{servicioSeleccionado.puestoResponsable}</span></span>
              <span className="opacity-70">SLA interno: <span className="font-medium opacity-100">{servicioSeleccionado.slaInterno} dias habiles</span></span>
            </div>
          )}
        </div>

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

      <div className="flex gap-3">
        <Button type="submit" variant="success" disabled={filesUploading || creating}>
          {filesUploading ? "Esperando archivos..." : creating ? "Guardando..." : "Crear ticket"}
        </Button>
        <Button type="button" variant="danger" onClick={() => router.push("/tickets")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
