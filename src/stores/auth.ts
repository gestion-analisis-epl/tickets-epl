import { create } from "zustand";
import type { Role } from "@/types/user";

export type { Role };

interface AuthState {
  uid: string | null;
  nombre: string | null;
  email: string | null;
  role: Role;
  status: "loading" | "signed-in" | "signed-out";
  setUser: (user: { uid: string; nombre: string; email: string; role: Role }) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  nombre: null,
  email: null,
  role: "solicitante",
  status: "loading",
  setUser: ({ uid, nombre, email, role }) => set({ uid, nombre, email, role, status: "signed-in" }),
  clearUser: () => set({ uid: null, nombre: null, email: null, role: "solicitante", status: "signed-out" }),
}));
