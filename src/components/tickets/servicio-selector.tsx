"use client";

import { useEffect, useMemo, useState } from "react";
import { findServicio } from "@/lib/catalogo";
import { useCatalogoStore } from "@/stores/catalogo";
import { useCategoriasStore } from "@/stores/categorias";
import type { CatalogoServicio, Categoria } from "@/types/catalogo";

interface ServicioSelectorProps {
  value: string;
  onChange: (servicioId: string) => void;
  error?: string;
}

// Categoria primero, servicio despues (filtrado por esa categoria) — separado
// de un solo select con optgroups porque el catalogo ya paso de 70 a 73+
// servicios y se volvia dificil de recorrer de un jalon.
export function ServicioSelector({ value, onChange, error }: ServicioSelectorProps) {
  const servicios = useCatalogoStore((s) => s.servicios);
  const categorias = useCategoriasStore((s) => s.categorias);
  const [categoria, setCategoria] = useState<Categoria | "">(() => findServicio(value)?.categoria ?? "");

  // Si `value` cambia desde afuera (ej. al cargar un ticket existente para
  // editar), sincroniza la categoria mostrada.
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

  const serviciosDeLaCategoria = categoria ? serviciosPorCategoria[categoria] ?? [] : [];

  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Categoria <span className="text-danger">*</span>
        </label>
        <select
          value={categoria}
          onChange={(e) => handleCategoriaChange(e.target.value)}
          className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Selecciona una categoria...</option>
          {categorias.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
        </select>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium mb-1.5">
          Servicio <span className="text-danger">*</span>
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!categoria}
          className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          <option value="">{categoria ? "Selecciona un servicio..." : "Primero elige una categoria"}</option>
          {serviciosDeLaCategoria.map((s) => <option key={s.id} value={s.id}>{s.servicio}</option>)}
        </select>
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>
    </>
  );
}
