"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import type { UserRow } from "@/lib/users";

interface SupervisadosPickerProps {
  usuarios: UserRow[];
  // El usuario que se edita: no puede supervisarse a si mismo.
  propioUid: string;
  value: string[];
  onChange: (uids: string[]) => void;
}

const etiqueta = (u: UserRow) => `${u.nombre} — ${u.email}`;

// Usuarios cuyos tickets podra ver (sin editarlos) un gerente de area. Se guarda en su supervisaUids.
export function SupervisadosPicker({ usuarios, propioUid, value, onChange }: SupervisadosPickerProps) {
  const porUid = useMemo(() => new Map(usuarios.map((u) => [u.uid, u])), [usuarios]);

  const disponibles = useMemo(
    () => usuarios.filter((u) => u.uid !== propioUid && u.activo && !value.includes(u.uid)),
    [usuarios, propioUid, value]
  );
  const porEtiqueta = useMemo(() => new Map(disponibles.map((u) => [etiqueta(u), u.uid])), [disponibles]);
  const opciones = useMemo(
    () => disponibles.map(etiqueta).sort((a, b) => a.localeCompare(b, "es")),
    [disponibles]
  );

  function agregar(seleccion: string) {
    const uid = porEtiqueta.get(seleccion);
    if (uid) onChange([...value, uid]);
  }

  return (
    <div className="space-y-2">
      <Combobox value="" options={opciones} onChange={agregar} placeholder="Busca un usuario para agregarlo..." />

      {value.length === 0 ? (
        <p className="text-xs text-muted">Sin usuarios asignados: solo vera sus propios tickets.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {value.map((uid) => {
            const usuario = porUid.get(uid);
            return (
              <li
                key={uid}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-sm"
              >
                <span title={usuario?.email}>{usuario?.nombre ?? "Usuario eliminado"}</span>
                <button
                  type="button"
                  aria-label={`Quitar a ${usuario?.nombre ?? uid}`}
                  onClick={() => onChange(value.filter((u) => u !== uid))}
                  className="text-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
