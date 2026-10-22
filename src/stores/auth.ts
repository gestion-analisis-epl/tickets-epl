import { create } from "zustand";
import type { Role } from "@/types/user";
import type { AjustesPermisos } from "@/domain/users/permisos";

export type { Role };

const CLAVE_VER_COMO = "ver-como-rol";

function leerVerComo(): Role | null {
  try {
    return (sessionStorage.getItem(CLAVE_VER_COMO) as Role | null) || null;
  } catch {
    return null;
  }
}

function guardarVerComo(rol: Role | null) {
  try {
    if (rol) sessionStorage.setItem(CLAVE_VER_COMO, rol);
    else sessionStorage.removeItem(CLAVE_VER_COMO);
  } catch {
    // sessionStorage no disponible: la simulacion solo dura lo que la pestana.
  }
}

interface AuthState {
  uid: string | null;
  nombre: string | null;
  email: string | null;
  // Rol efectivo para la UI: el real, o el simulado si un admin usa "Ver como".
  role: Role;
  // Rol y permisos guardados en users/{uid}; los que aplican firestore.rules y las rutas API.
  roleReal: Role;
  // Solo cuando roleReal === "admin": rol que la UI simula. No cambia nada en Firestore.
  verComo: Role | null;
  // Liga a Abogado.id (data/abogados.ts) cuando role === "abogado" — permite
  // saber si el usuario es el abogado asignado a un ticket (ver ticket-detail.tsx).
  abogadoId: string | null;
  // Solo gerente_area: usuarios cuyos tickets puede ver.
  supervisaUids: string[];
  // Excepciones a los permisos de su rol (ver domain/users/permisos.ts).
  permisos: AjustesPermisos;
  permisosReales: AjustesPermisos;
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
  // Ignorado si la cuenta real no es admin.
  setVerComo: (rol: Role | null) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  uid: null,
  nombre: null,
  email: null,
  role: "solicitante",
  roleReal: "solicitante",
  verComo: null,
  abogadoId: null,
  supervisaUids: [],
  permisos: {},
  permisosReales: {},
  status: "loading",
  setUser: ({ uid, nombre, email, role, abogadoId, supervisaUids, permisos }) => {
    const verComo = role === "admin" ? leerVerComo() : null;
    set({
      uid, nombre, email,
      role: verComo ?? role,
      roleReal: role,
      verComo,
      abogadoId: abogadoId ?? null,
      supervisaUids: supervisaUids ?? [],
      permisos: verComo ? {} : permisos ?? {},
      permisosReales: permisos ?? {},
      status: "signed-in",
    });
  },
  setVerComo: (rol) => {
    const { roleReal, permisosReales } = get();
    if (roleReal !== "admin") return;
    const verComo = rol && rol !== "admin" ? rol : null;
    guardarVerComo(verComo);
    set({ verComo, role: verComo ?? roleReal, permisos: verComo ? {} : permisosReales });
  },
  clearUser: () => {
    guardarVerComo(null);
    set({ uid: null, nombre: null, email: null, role: "solicitante", roleReal: "solicitante", verComo: null, abogadoId: null, supervisaUids: [], permisos: {}, permisosReales: {}, status: "signed-out" });
  },
}));
