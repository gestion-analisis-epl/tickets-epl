import { create } from "zustand";
import type { CatalogoServicio } from "@/types/catalogo";

interface CatalogoState {
  servicios: CatalogoServicio[];
  loaded: boolean;
  setServicios: (servicios: CatalogoServicio[]) => void;
}

export const useCatalogoStore = create<CatalogoState>((set) => ({
  servicios: [],
  loaded: false,
  setServicios: (servicios) => set({ servicios, loaded: true }),
}));
