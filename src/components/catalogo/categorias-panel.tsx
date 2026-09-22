"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useCategoriasStore } from "@/stores/categorias";
import {
  crearCategoria, actualizarTonoCategoria, eliminarCategoria, importarCategoriasEstaticas,
  type CategoriaCatalogo,
} from "@/lib/categorias";
import { BADGE_TONES, type BadgeTone } from "@/types/badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CatalogoServicio } from "@/types/catalogo";
import { isAdminRole } from "@/types/user";

type Panel = { mode: "crear" } | { mode: "editar"; categoria: CategoriaCatalogo } | null;

export function CategoriasPanel({ servicios }: { servicios: CatalogoServicio[] }) {
  const isAdmin = useAuthStore((s) => isAdminRole(s.role));
  const categorias = useCategoriasStore((s) => s.categorias);

  const [panel, setPanel] = useState<Panel>(null);
  const [nombre, setNombre] = useState("");
  const [tono, setTono] = useState<BadgeTone>("gray");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  if (!isAdmin) return null;

  function abrirCrear() {
    setNombre("");
    setTono("gray");
    setFormError(null);
    setInfoMsg(null);
    setPanel({ mode: "crear" });
  }

  function abrirEditar(c: CategoriaCatalogo) {
    setNombre(c.nombre);
    setTono(c.tono);
    setFormError(null);
    setInfoMsg(null);
    setPanel({ mode: "editar", categoria: c });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      if (panel?.mode === "crear") {
        if (categorias.some((c) => c.nombre === nombre.trim())) {
          setFormError("Ya existe una categoria con ese nombre.");
          return;
        }
        await crearCategoria({ nombre: nombre.trim(), tono });
      } else if (panel?.mode === "editar") {
        await actualizarTonoCategoria(panel.categoria.id, tono);
      }
      setPanel(null);
    } catch {
      setFormError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(id: string) {
    setEliminandoId(id);
    try {
      await eliminarCategoria(id);
      setConfirmandoId(null);
    } catch {
      setInfoMsg("No se pudo eliminar. Intenta de nuevo.");
    } finally {
      setEliminandoId(null);
    }
  }

  async function handleImportar() {
    setImportando(true);
    try {
      const { importadas, omitidas } = await importarCategoriasEstaticas();
      setInfoMsg(`Importacion lista: ${importadas} agregadas, ${omitidas} ya existian.`);
    } catch {
      setInfoMsg("No se pudo importar las categorias por defecto.");
    } finally {
      setImportando(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Categorias</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleImportar}
            disabled={importando}
            className="flex items-center gap-1.5 h-8 rounded-lg border border-border bg-card px-3 text-sm hover:bg-surface transition-colors shrink-0 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {importando ? "Importando..." : "Importar por defecto"}
          </button>
          <Button variant="primary" size="sm" onClick={abrirCrear}>
            <Plus className="h-4 w-4" />
            Agregar categoria
          </Button>
        </div>
      </div>

      {infoMsg && (
        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{infoMsg}</div>
      )}

      {panel && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nombre</label>
              <input
                type="text" required
                disabled={panel.mode === "editar"}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                title={panel.mode === "editar" ? "El nombre no se puede editar — elimina y crea de nuevo si necesitas renombrar" : undefined}
                className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Color</label>
              <div className="flex items-center gap-2">
                <select
                  value={tono}
                  onChange={(e) => setTono(e.target.value as BadgeTone)}
                  className="flex-1 h-10 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {BADGE_TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <Badge tone={tono}>{nombre || "vista previa"}</Badge>
              </div>
            </div>
          </div>

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="success" size="sm" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPanel(null)} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {categorias.length === 0 && <p className="text-sm opacity-50">Sin categorias todavia.</p>}
        {categorias.map((c) => {
          const enUso = servicios.filter((s) => s.categoria === c.nombre).length;
          return (
            <div key={c.id} className="flex items-center gap-1.5 rounded-full border border-border pl-3 pr-1 py-1">
              <Badge tone={c.tono}>{c.nombre}</Badge>
              <span className="text-xs opacity-50">{enUso}</span>
              {confirmandoId === c.id ? (
                <>
                  <Button variant="danger" size="sm" onClick={() => handleEliminar(c.id)} disabled={eliminandoId === c.id}>
                    {eliminandoId === c.id ? "..." : "Si"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmandoId(null)} disabled={eliminandoId === c.id}>
                    No
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="icon" onClick={() => abrirEditar(c)} title="Editar color">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setConfirmandoId(c.id)}
                    title="Eliminar"
                    className="text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
