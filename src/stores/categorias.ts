import { create } from "zustand";
import type { CategoriaCatalogo } from "@/domain/catalogo/categoria";

interface CategoriasState {
  categorias: CategoriaCatalogo[];
  loaded: boolean;
  setCategorias: (categorias: CategoriaCatalogo[]) => void;
}

export const useCategoriasStore = create<CategoriasState>((set) => ({
  categorias: [],
  loaded: false,
  setCategorias: (categorias) => set({ categorias, loaded: true }),
}));
