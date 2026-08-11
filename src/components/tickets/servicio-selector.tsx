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
  // TEMPORAL: si se pasa, Categoria queda fija y Servicio solo lista estos ids.
  soloIds?: string[];
}

export function ServicioSelector({ value, onChange, error, soloIds }: ServicioSelectorProps) {
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

  if (soloIds) {
    const serviciosPermitidos = servicios.filter((s) => soloIds.includes(s.id));
    const categoriaFija = serviciosPermitidos[0]?.categoria ?? "";

    return (
      <>
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Categoria <span className="text-danger">*</span>
          </label>
          <select
            value={categoriaFija}
            disabled
            className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm opacity-70 disabled:cursor-not-allowed"
          >
            <option value={categoriaFija}>{categoriaFija}</option>
          </select>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium mb-1.5">
            Servicio <span className="text-danger">*</span>
          </label>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Selecciona un servicio...</option>
            {serviciosPermitidos.map((s) => <option key={s.id} value={s.id}>{s.servicio}</option>)}
          </select>
          {error && <p className="text-xs text-danger mt-1">{error}</p>}
        </div>
      </>
    );
  }

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
