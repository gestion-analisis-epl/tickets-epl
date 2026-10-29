import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UploadingFile } from "@/components/ui/file-dropzone";

interface DocumentoSlotProps {
  titulo: string;
  ayuda?: string;
  obligatorio?: boolean;
  archivos: UploadingFile[];
  error?: string;
  children: React.ReactNode; // el FileDropzone
}

// Un documento por tarjeta: que es, para que sirve y si ya esta subido.
export function DocumentoSlot({ titulo, ayuda, obligatorio = true, archivos, error, children }: DocumentoSlotProps) {
  const listo = archivos.some((f) => f.status === "done");
  return (
    <div className={cn("rounded-md border p-4", error ? "border-danger bg-danger/5" : "border-border bg-card")}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 mb-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">
            {titulo}{" "}
            {obligatorio
              ? <><span className="text-danger" aria-hidden="true">*</span><span className="sr-only"> (obligatorio)</span></>
              : <span className="ml-1 rounded-full border border-border px-2 py-px text-xs font-medium text-muted">Opcional</span>}
          </p>
          {ayuda && <p className="text-xs text-muted mt-0.5">{ayuda}</p>}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold",
            listo ? "border-transparent bg-success/10 text-success" : "border-border text-muted"
          )}
        >
          {listo ? "Listo" : obligatorio ? "Falta" : "Sin subir"}
        </span>
      </div>
      {children}
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
