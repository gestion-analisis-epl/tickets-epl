"use client";

import { useEffect } from "react";
import { subscribeCatalogo } from "@/lib/catalogo";
import { subscribeCategorias } from "@/lib/categorias";

// Montado dentro de (app)/layout.tsx, solo una vez confirmado el login — las
// rules de catalogoServicios/categorias exigen isSignedIn(), montarlo antes fallaria.
export function CatalogoProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unsubCatalogo = subscribeCatalogo();
    const unsubCategorias = subscribeCategorias();
    return () => {
      unsubCatalogo();
      unsubCategorias();
    };
  }, []);
  return <>{children}</>;
}
