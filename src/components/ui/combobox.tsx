"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { filtrarOpciones } from "@/domain/sitios/sitios-rules";
import { cn } from "@/lib/utils";

interface ComboboxProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}

// Dropdown con buscador. Cerrado muestra el valor elegido; abierto, lo que se escribe.
export function Combobox({ value, options, onChange, placeholder = "Selecciona...", disabled, invalid }: ComboboxProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [activo, setActivo] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  const listaId = useId();

  const filtradas = useMemo(() => filtrarOpciones(options, busqueda), [options, busqueda]);

  useEffect(() => {
    if (!abierto) return;
    function alClicFuera(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) cerrar();
    }
    document.addEventListener("mousedown", alClicFuera);
    return () => document.removeEventListener("mousedown", alClicFuera);
  }, [abierto]);

  function abrir() {
    if (disabled || abierto) return;
    setBusqueda("");
    setActivo(Math.max(0, options.indexOf(value)));
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    setBusqueda("");
  }

  function elegir(opcion: string) {
    onChange(opcion);
    cerrar();
  }

  function alPresionar(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!abierto) return abrir();
      setActivo((i) => Math.min(i + 1, filtradas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && abierto) {
      e.preventDefault();
      if (filtradas[activo] !== undefined) elegir(filtradas[activo]);
    } else if (e.key === "Escape" || e.key === "Tab") {
      cerrar();
    }
  }

  return (
    <div ref={contenedor} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-controls={listaId}
        aria-invalid={invalid}
        autoComplete="off"
        disabled={disabled}
        value={abierto ? busqueda : value}
        placeholder={placeholder}
        onFocus={abrir}
        onClick={abrir}
        onChange={(e) => {
          setBusqueda(e.target.value);
          setActivo(0);
          if (!abierto) setAbierto(true);
        }}
        onKeyDown={alPresionar}
        className={cn(
          "w-full h-10 pl-3 pr-16 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50",
          invalid ? "border-danger" : "border-input"
        )}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {value && !disabled && (
          <button
            type="button"
            aria-label="Limpiar"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              cerrar();
            }}
            className="p-0.5 rounded text-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronDown className="h-4 w-4 text-muted pointer-events-none" />
      </div>

      {abierto && (
        <ul
          id={listaId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card py-1 text-sm shadow-lg"
        >
          {filtradas.length === 0 ? (
            <li className="px-3 py-2 text-muted">Sin resultados</li>
          ) : (
            filtradas.map((o, i) => (
              <li
                key={o}
                role="option"
                aria-selected={o === value}
                ref={(el) => {
                  if (el && i === activo) el.scrollIntoView({ block: "nearest" });
                }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(o)}
                onMouseEnter={() => setActivo(i)}
                className={cn(
                  "cursor-pointer px-3 py-1.5",
                  i === activo && "bg-surface",
                  o === value && "font-medium text-primary"
                )}
              >
                {o}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
