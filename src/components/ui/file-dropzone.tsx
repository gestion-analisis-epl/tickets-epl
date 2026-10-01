"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSize } from "@/lib/format-size";
import { MAX_FILE_SIZE_BYTES } from "@/lib/storage";

export interface UploadingFile {
  id: string;
  name: string;
  size: number;
  progress: number; // 0-100
  status: "uploading" | "validando" | "done" | "error";
  url?: string;
  path?: string;
  error?: string;
}

interface Props {
  files: UploadingFile[];
  onFilesSelected: (files: File[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
  multiple?: boolean;
}

export function FileDropzone({ files, onFilesSelected, onRemove, disabled, multiple = true }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="space-y-3">
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          if (e.dataTransfer.files.length) {
            const dropped = Array.from(e.dataTransfer.files);
            onFilesSelected(multiple ? dropped : [dropped[0]]);
          }
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-input hover:bg-surface",
          disabled && "text-muted cursor-not-allowed"
        )}
      >
        <UploadCloud className="h-6 w-6 text-muted" />
        <p className="text-sm">
          <span className="font-medium text-primary">Selecciona archivos</span> o arrastralos aqui
        </p>
        <p className="text-xs text-muted">PDF, Word, Excel, imagenes... · Maximo {formatSize(MAX_FILE_SIZE_BYTES)} por archivo</p>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              const selected = Array.from(e.target.files);
              onFilesSelected(multiple ? selected : [selected[0]]);
            }
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li
              key={f.id}
              className={cn(
                "flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm",
                f.status === "error" ? "border-danger/40 border-l-[3px] border-l-danger bg-danger/10" : "items-center border-border bg-surface"
              )}
            >
              {(f.status === "uploading" || f.status === "validando") && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" />}
              {f.status === "done"      && <FileText className="h-4 w-4 shrink-0 text-success" />}
              {f.status === "error"     && <AlertCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" />}

              <div className="min-w-0 flex-1">
                <p className="truncate">{f.name}</p>
                {f.status === "uploading" && (
                  <div className="mt-1 h-1 w-full rounded-full bg-border overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${f.progress}%` }} />
                  </div>
                )}
                {f.status === "validando" && <p className="text-xs text-muted mt-0.5">Validando archivo...</p>}
                {f.status === "error" && <p className="text-xs font-medium text-danger mt-0.5">{f.error ?? "Error al subir el archivo."}</p>}
                {f.status === "done" && <p className="text-xs text-muted mt-0.5">{formatSize(f.size)}</p>}
              </div>

              <button
                type="button"
                onClick={() => onRemove(f.id)}
                disabled={f.status === "uploading" || f.status === "validando"}
                title={f.status === "uploading" || f.status === "validando" ? "Espera a que termine" : "Quitar"}
                className="p-1 rounded hover:bg-danger/15 hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
