import { create } from "zustand";
import type { Role } from "@/types/user";

export type { Role };

interface AuthState {
  uid: string | null;
  nombre: string | null;
  email: string | null;
  role: Role;
  // Liga a Abogado.id (data/abogados.ts) cuando role === "abogado" — permite
  // saber si el usuario es el abogado asignado a un ticket (ver ticket-detail.tsx).
  abogadoId: string | null;
  status: "loading" | "signed-in" | "signed-out";
  setUser: (user: { uid: string; nombre: string; email: string; role: Role; abogadoId?: string | null }) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  nombre: null,
  email: null,
  role: "solicitante",
  abogadoId: null,
  status: "loading",
  setUser: ({ uid, nombre, email, role, abogadoId }) =>
    set({ uid, nombre, email, role, abogadoId: abogadoId ?? null, status: "signed-in" }),
  clearUser: () => set({ uid: null, nombre: null, email: null, role: "solicitante", abogadoId: null, status: "signed-out" }),
}));
