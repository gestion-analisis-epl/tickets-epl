"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, ShieldAlert, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ArrowUpDown, ListFilter } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import {
  listUsers, crearUsuarioStaff, actualizarUsuario, eliminarUsuario,
  type UserRow, type ActualizarUsuarioInput,
} from "@/lib/users";
import { STAFF_ROLES, LEGAL_STAFF_ROLES, isAdminRole, type Role } from "@/types/user";
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

type ColumnKey = "nombre" | "email" | "role" | "activo";
type SortState = { key: ColumnKey; dir: "asc" | "desc" } | null;

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "nombre", label: "Nombre" },
  { key: "email", label: "Correo" },
  { key: "role", label: "Rol" },
  { key: "activo", label: "Activo" },
];

// Portal a document.body: el header vive dentro de un contenedor con
// overflow-x-auto/overflow-hidden (scroll horizontal de la tabla), que
// recorta cualquier dropdown posicionado con position:absolute adentro.
function ColumnFilterButton({
  options, selected, onToggle, onClear,
}: {
  options: { value: string; label: string }[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const left = Math.min(r.left, window.innerWidth - 216);
      setCoords({ top: r.bottom + 4, left: Math.max(8, left) });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (dropRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={cn("hover:opacity-100", selected.size > 0 ? "opacity-100 text-primary" : "opacity-40")}
        title="Filtrar"
      >
        <ListFilter className="h-3 w-3" />
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 9999 }}
          className="bg-card text-card-foreground rounded-lg border border-border shadow-lg min-w-[200px] overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-70">Filtrar</span>
            {selected.size > 0 && (
              <button type="button" onClick={onClear} className="text-xs font-normal normal-case text-primary hover:underline">
                Limpiar
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {options.map((o) => (
              <label key={o.value} className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(o.value)}
                  onChange={() => onToggle(o.value)}
                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-ring cursor-pointer shrink-0"
                />
                <span className="text-sm font-normal normal-case leading-none">{o.label}</span>
              </label>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export function UsuariosPanel() {
  const myRole = useAuthStore((s) => s.role);
  const myUid = useAuthStore((s) => s.uid);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [roleFilter, setRoleFilter] = useState<Set<Role>>(new Set());
  const [activoFilter, setActivoFilter] = useState<Set<"si" | "no">>(new Set());

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
    if (!isAdminRole(myRole)) return;
    refresh()
      .catch(() => setListError("No se pudo cargar la lista de usuarios."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRole]);

  function toggleSort(key: ColumnKey) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function toggleSetValue<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = users.filter((u) => {
      if (q && !(u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || ROLE_LABEL[u.role].toLowerCase().includes(q))) {
        return false;
      }
      if (roleFilter.size > 0 && !roleFilter.has(u.role)) return false;
      if (activoFilter.size > 0 && !activoFilter.has(u.activo ? "si" : "no")) return false;
      return true;
    });

    if (sort) {
      const { key, dir } = sort;
      rows = [...rows].sort((a, b) => {
        let cmp = 0;
        if (key === "nombre") cmp = a.nombre.localeCompare(b.nombre);
        else if (key === "email") cmp = a.email.localeCompare(b.email);
        else if (key === "role") cmp = ROLE_LABEL[a.role].localeCompare(ROLE_LABEL[b.role]);
        else if (key === "activo") cmp = Number(a.activo) - Number(b.activo);
        return dir === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [users, search, sort, roleFilter, activoFilter]);

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

  if (!isAdminRole(myRole)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-center max-w-lg">
        <ShieldAlert className="h-6 w-6 text-danger" />
        <p className="text-sm font-medium">No tienes permiso para ver esta pagina.</p>
        <p className="text-xs opacity-60">Solo cuentas con rol admin pueden gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-50 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo o rol..."
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
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="bg-surface border-b border-border">
                {COLUMNS.map((col) => (
                  <th key={col.key} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider opacity-70">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="flex items-center gap-1 hover:opacity-100"
                      >
                        {col.label}
                        {sort?.key === col.key ? (
                          sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                      {col.key === "role" && (
                        <ColumnFilterButton
                          options={ROLE_OPTIONS.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                          selected={roleFilter}
                          onToggle={(v) => toggleSetValue(roleFilter, v as Role, setRoleFilter)}
                          onClear={() => setRoleFilter(new Set())}
                        />
                      )}
                      {col.key === "activo" && (
                        <ColumnFilterButton
                          options={[{ value: "si", label: "Si" }, { value: "no", label: "No" }]}
                          selected={activoFilter}
                          onToggle={(v) => toggleSetValue(activoFilter, v as "si" | "no", setActivoFilter)}
                          onClear={() => setActivoFilter(new Set())}
                        />
                      )}
                    </div>
                  </th>
                ))}
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
