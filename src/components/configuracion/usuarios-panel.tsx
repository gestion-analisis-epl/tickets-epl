"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { listUsers, updateUserRole, type UserRow } from "@/lib/users";
import type { Role } from "@/types/user";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<Role, string> = {
  solicitante: "Solicitante",
  mesa_control: "Mesa de Control",
  abogado: "Abogado",
  gerente_juridico: "Gerente Juridico",
  admin: "Admin",
};

const ROLE_OPTIONS: Role[] = ["solicitante", "mesa_control", "abogado", "gerente_juridico", "admin"];

export function UsuariosPanel() {
  const myRole = useAuthStore((s) => s.role);
  const myUid = useAuthStore((s) => s.uid);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [savingUid, setSavingUid] = useState<string | null>(null);

  useEffect(() => {
    if (myRole !== "admin") return;
    listUsers()
      .then(setUsers)
      .catch(() => setError("No se pudo cargar la lista de usuarios."))
      .finally(() => setLoading(false));
  }, [myRole]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  async function handleRoleChange(uid: string, role: Role) {
    setSavingUid(uid);
    const prev = users;
    setUsers((cur) => cur.map((u) => (u.uid === uid ? { ...u, role } : u)));
    try {
      await updateUserRole(uid, role);
    } catch {
      setUsers(prev);
      setError("No se pudo actualizar el rol. Intenta de nuevo.");
    } finally {
      setSavingUid(null);
    }
  }

  if (myRole !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-center max-w-lg">
        <ShieldAlert className="h-6 w-6 text-danger" />
        <p className="text-sm font-medium">No tienes permiso para ver esta pagina.</p>
        <p className="text-xs opacity-60">Solo cuentas con rol admin pueden gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-50 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o correo..."
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin opacity-50" />
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider opacity-70">Nombre</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider opacity-70">Correo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider opacity-70">Rol</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.uid} className={cn("border-b border-border last:border-0", i % 2 === 1 && "bg-surface/30")}>
                  <td className="px-4 py-2.5">{u.nombre}</td>
                  <td className="px-4 py-2.5 opacity-80">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={u.role}
                      disabled={savingUid === u.uid || u.uid === myUid}
                      onChange={(e) => handleRoleChange(u.uid, e.target.value as Role)}
                      title={u.uid === myUid ? "No puedes cambiar tu propio rol desde aqui" : undefined}
                      className="h-8 px-2 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                      {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center opacity-50">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
