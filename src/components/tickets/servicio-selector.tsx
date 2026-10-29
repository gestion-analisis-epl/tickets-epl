"use client";

import { useEffect, useMemo, useState } from "react";
import { Campo } from "@/components/forms/campo";
import { findServicio } from "@/lib/catalogo";
import { cn } from "@/lib/utils";
import { useCatalogoStore } from "@/stores/catalogo";
import { useCategoriasStore } from "@/stores/categorias";
import type { CatalogoServicio, Categoria } from "@/types/catalogo";

interface ServicioSelectorProps {
  value: string;
  onChange: (servicioId: string) => void;
  error?: string;
  // TEMPORAL: si se pasa, Categoria queda fija y Servicio solo lista estos ids.
  soloIds?: string[];
  // Con "contents" los dos campos se acomodan en la cuadricula de quien los usa.
  className?: string;
}

export function ServicioSelector({ value, onChange, error, soloIds, className }: ServicioSelectorProps) {
  const servicios = useCatalogoStore((s) => s.servicios);
  const categorias = useCategoriasStore((s) => s.categorias);
  const [categoria, setCategoria] = useState<Categoria | "">(() => findServicio(value)?.categoria ?? "");

  // Sincroniza la categoria si `value` cambia desde afuera.
  useEffect(() => {
    const actual = findServicio(value)?.categoria;
    if (actual) setCategoria(actual);
  }, [value]);

  function handleCategoriaChange(next: string) {
    setCategoria(next as Categoria | "");
    onChange(""); // el servicio elegido ya no aplica a la nueva categoria
  }

  const serviciosPorCategoria = useMemo(() => {
    return servicios.reduce((acc, s) => {
      (acc[s.categoria] ??= []).push(s);
      return acc;
    }, {} as Partial<Record<Categoria, CatalogoServicio[]>>);
  }, [servicios]);

  let categoriaElegida: string;
  let opcionesCategoria: string[];
  let placeholderCategoria: string | null;
  let serviciosVisibles: CatalogoServicio[];
  let servicioBloqueado = false;
  let placeholderServicio = "Selecciona un servicio...";

  if (soloIds) {
    const serviciosPermitidos = servicios.filter((s) => soloIds.includes(s.id));
    opcionesCategoria = Array.from(new Set(serviciosPermitidos.map((s) => s.categoria)));
    categoriaElegida = categoria || serviciosPermitidos[0]?.categoria || "";
    placeholderCategoria = null;
    serviciosVisibles = categoriaElegida
      ? serviciosPermitidos.filter((s) => s.categoria === categoriaElegida)
      : serviciosPermitidos;
  } else {
    categoriaElegida = categoria;
    opcionesCategoria = categorias.map((c) => c.nombre);
    placeholderCategoria = "Selecciona una categoría...";
    serviciosVisibles = categoria ? serviciosPorCategoria[categoria] ?? [] : [];
    servicioBloqueado = !categoria;
    if (!categoria) placeholderServicio = "Primero elige una categoría";
  }

  return (
    <div className={cn("grid grid-cols-1 gap-6", className)}>
      <Campo id="servicio-categoria" etiqueta="Categoría">
        <select
          id="servicio-categoria"
          value={categoriaElegida}
          onChange={(e) => handleCategoriaChange(e.target.value)}
          className="w-full field"
        >
          {placeholderCategoria && <option value="">{placeholderCategoria}</option>}
          {opcionesCategoria.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Campo>

      <Campo id="servicio-servicio" etiqueta="Servicio" error={error}>
        <select
          id="servicio-servicio"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={servicioBloqueado}
          aria-invalid={!!error}
          className="w-full field disabled:opacity-50"
        >
          <option value="">{placeholderServicio}</option>
          {serviciosVisibles.map((s) => <option key={s.id} value={s.id}>{s.servicio}</option>)}
        </select>
      </Campo>
    </div>
  );
}
