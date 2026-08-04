"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ShieldAlert, Plus, Pencil, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import {
  listUsers, crearUsuarioStaff, actualizarUsuario, eliminarUsuario,
  type UserRow, type ActualizarUsuarioInput,
} from "@/lib/users";
import { STAFF_ROLES, LEGAL_STAFF_ROLES, type Role } from "@/types/user";
import { ABOGADOS, findAbogado } from "@/lib/data/abogados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<Role, string> = {
  solicitante: "Solicitante",
  mesa_control: "Mesa de Control",
  abogado: "Abogado",
  gerente_juridico: "Gerente Juridico",
  admin: "Admin",
};

const ROLE_OPTIONS: Role[] = ["solicitante", "mesa_control", "abogado", "gerente_juridico", "admin"];

type Panel = { mode: "crear" } | { mode: "editar"; user: UserRow } | null;

export function UsuariosPanel() {
  const myRole = useAuthStore((s) => s.role);
  const myUid = useAuthStore((s) => s.uid);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [panel, setPanel] = useState<Panel>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<Role>("mesa_control");
  const [formActivo, setFormActivo] = useState(true);
  const [formAbogadoId, setFormAbogadoId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmandoEliminarUid, setConfirmandoEliminarUid] = useState<string | null>(null);
  const [eliminandoUid, setEliminandoUid] = useState<string | null>(null);

  async function refresh() {
    setUsers(await listUsers());
  }

  useEffect(() => {
    if (myRole !== "admin") return;
    refresh()
      .catch(() => setListError("No se pudo cargar la lista de usuarios."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRole]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  function abrirCrear() {
    setFormNombre("");
    setFormEmail("");
    setFormRole("mesa_control");
    setFormActivo(true);
    setFormAbogadoId("");
    setFormError(null);
    setInfoMsg(null);
    setPanel({ mode: "crear" });
  }

  function abrirEditar(u: UserRow) {
    setFormNombre(u.nombre);
    setFormEmail(u.email);
    setFormRole(u.role);
    setFormActivo(u.activo);
    setFormAbogadoId(u.abogadoId ?? "");
    setFormError(null);
    setInfoMsg(null);
    setPanel({ mode: "editar", user: u });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      if (panel?.mode === "crear") {
        const { correoEnviado } = await crearUsuarioStaff({
          nombre: formNombre.trim(),
          email: formEmail.trim(),
          role: formRole,
        });
        setInfoMsg(
          correoEnviado
            ? `Cuenta creada. Se envio un correo a ${formEmail.trim()} para que fije su contrasena.`
            : "Cuenta creada, pero no se pudo enviar el correo para fijar contrasena — comparte el acceso por otro medio."
        );
      } else if (panel?.mode === "editar") {
        const patch: ActualizarUsuarioInput = { nombre: formNombre.trim(), role: formRole, activo: formActivo };
        if (panel.user.role !== "solicitante") patch.email = formEmail.trim();
        patch.abogadoId = LEGAL_STAFF_ROLES.includes(formRole) ? (formAbogadoId || null) : null;
        await actualizarUsuario(panel.user.uid, patch);
        setInfoMsg("Cambios guardados.");
      }
      await refresh();
      setPanel(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(uid: string) {
    setEliminandoUid(uid);
    setListError(null);
    try {
      await eliminarUsuario(uid);
      await refresh();
      setConfirmandoEliminarUid(null);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "No se pudo eliminar.");
    } finally {
      setEliminandoUid(null);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-50 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button variant="primary" size="sm" onClick={abrirCrear}>
          <Plus className="h-4 w-4" />
          Agregar usuario
        </Button>
      </div>

      {infoMsg && (
        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{infoMsg}</div>
      )}
      {listError && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{listError}</div>
      )}

      {panel && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">
            {panel.mode === "crear" ? "Agregar usuario de staff" : `Editar usuario — ${panel.user.nombre}`}
          </h2>

          {panel.mode === "crear" && (
            <p className="text-xs opacity-60">
              Solo para cuentas de Legal/admin (correo + contrasena). Los solicitantes se registran solos al
              entrar con su cuenta de Google.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nombre</label>
              <input
                type="text"
                required
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Correo</label>
              <input
                type="email"
                required
                disabled={panel.mode === "editar" && panel.user.role === "solicitante"}
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                title={
                  panel.mode === "editar" && panel.user.role === "solicitante"
                    ? "El correo de un solicitante se administra desde su cuenta de Google"
                    : undefined
                }
                className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Rol</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as Role)}
                className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(panel.mode === "crear" ? STAFF_ROLES : ROLE_OPTIONS).map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </div>
            {panel.mode === "editar" && (
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActivo}
                    onChange={(e) => setFormActivo(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                  />
                  Cuenta activa
                </label>
              </div>
            )}
            {panel.mode === "editar" && LEGAL_STAFF_ROLES.includes(formRole) && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Abogado del catalogo</label>
                <select
                  value={formAbogadoId}
                  onChange={(e) => setFormAbogadoId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Sin vincular</option>
                  {ABOGADOS.map((a) => <option key={a.id} value={a.id}>{a.nombre} — {a.puesto}</option>)}
                </select>
                <p className="text-xs opacity-60 mt-1">
                  Necesario para que le llegue la notificacion cuando le asignen un ticket.
                </p>
              </div>
            )}
          </div>

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="success" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setPanel(null)} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin opacity-50" />
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider opacity-70">Nombre</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider opacity-70">Correo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider opacity-70">Rol</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider opacity-70">Activo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider opacity-70">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.uid} className={cn("border-b border-border last:border-0", i % 2 === 1 && "bg-surface/30")}>
                  <td className="px-4 py-2.5">{u.nombre}</td>
                  <td className="px-4 py-2.5 opacity-80">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone="blue">{ROLE_LABEL[u.role]}</Badge>
                    {u.abogadoId && (
                      <div className="text-[11px] opacity-50 mt-1">{findAbogado(u.abogadoId)?.nombre}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={u.activo ? "green" : "gray"}>{u.activo ? "Si" : "No"}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {u.uid === myUid ? (
                      <span className="text-xs opacity-50">Tu cuenta</span>
                    ) : confirmandoEliminarUid === u.uid ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs opacity-70">¿Seguro?</span>
                        <Button
                          variant="danger" size="sm"
                          onClick={() => handleEliminar(u.uid)}
                          disabled={eliminandoUid === u.uid}
                        >
                          {eliminandoUid === u.uid ? "..." : "Si"}
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setConfirmandoEliminarUid(null)}
                          disabled={eliminandoUid === u.uid}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => abrirEditar(u)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setConfirmandoEliminarUid(u.uid)}
                          title="Eliminar"
                          className="text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center opacity-50">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}
