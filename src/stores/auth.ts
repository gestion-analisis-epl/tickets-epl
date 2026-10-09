import { create } from "zustand";
import type { Role } from "@/types/user";
import type { AjustesPermisos } from "@/domain/users/permisos";

export type { Role };

interface AuthState {
  uid: string | null;
  nombre: string | null;
  email: string | null;
  role: Role;
  // Liga a Abogado.id (data/abogados.ts) cuando role === "abogado" — permite
  // saber si el usuario es el abogado asignado a un ticket (ver ticket-detail.tsx).
  abogadoId: string | null;
  // Solo gerente_area: usuarios cuyos tickets puede ver.
  supervisaUids: string[];
  // Excepciones a los permisos de su rol (ver domain/users/permisos.ts).
  permisos: AjustesPermisos;
  status: "loading" | "signed-in" | "signed-out";
  setUser: (user: {
    uid: string;
    nombre: string;
    email: string;
    role: Role;
    abogadoId?: string | null;
    supervisaUids?: string[];
    permisos?: AjustesPermisos;
  }) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  nombre: null,
  email: null,
  role: "solicitante",
  abogadoId: null,
  supervisaUids: [],
  permisos: {},
  status: "loading",
  setUser: ({ uid, nombre, email, role, abogadoId, supervisaUids, permisos }) =>
    set({ uid, nombre, email, role, abogadoId: abogadoId ?? null, supervisaUids: supervisaUids ?? [], permisos: permisos ?? {}, status: "signed-in" }),
  clearUser: () => set({ uid: null, nombre: null, email: null, role: "solicitante", abogadoId: null, supervisaUids: [], permisos: {}, status: "signed-out" }),
}));
