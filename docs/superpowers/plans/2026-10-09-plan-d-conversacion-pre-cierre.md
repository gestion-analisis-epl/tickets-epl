# Conversación de Pre-Cierre, "Pedir cambios" y bloqueo de la solicitud — Plan D

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Prerrequisito:** Plan C (`docs/superpowers/plans/2026-10-09-plan-c-historial-cambios.md`) completo: Tasks 1-7 implementados y sus reglas de `firestore.rules` (Plan C Task 3) publicadas. Este plan usa sus nombres exactos: `ActorHistorial`, `EntradaHistorial` (`src/types/historial.ts`); `actorDesdeSesion`, `entradaCambiosSolicitados`, `entradaComentarioEditado`, `entradaComentarioEliminado` (`src/domain/tickets/historial-rules.ts`); `TicketRepository.updateConHistorial`; `nuevaEntradaHistorialRef` (`src/infrastructure/firestore/historial-repository.ts`); las firmas `updateTicketAsignacion(id, actor, input)`, `updateTicketSolicitud(id, actor, input)`, `updateTicketSitio(id, actor, sitio)`, `updateTicketExclusion(id, actor, excluido)`; y las funciones de reglas `esDuenoTicket(ticketId)`, `esAbogadoAsignado(ticketId)`, `entradaHistorialValida()`, `vistoBuenoEnEsteLote(ticketId)`.

**Goal:** Abrir una conversación por ticket desde Pre-Cierre (jefe de zona, solicitante dueño, abogado asignado, Gerente Jurídico y admin), con edición/borrado lógico registrados en el historial; bloquear solicitud, documentos y sitio en Pre-Cierre; permitir al jefe de zona "Pedir cambios" (regresa el ticket a "Proceso en tramite") conservando su acceso al resumen y al hilo mientras el ticket está en corrección; y avisar por campana y correo sin incluir el texto.

**Architecture:** Reglas puras en `src/domain/tickets/conversacion-rules.ts` (texto, hilo habilitado, participantes, quién edita) y `etapa-permisos-rules.ts` (tabla de campos por etapa y rol, espejo de las reglas). Los comentarios viven en `tickets/{id}/comentarios` (repositorio de cliente estilo `resumen-contrato-repository.ts`); editar/borrar escribe comentario + entrada de historial en un `writeBatch`. Los avisos los calcula y envía el servidor (Admin SDK), porque ni el solicitante ni el jefe de zona pueden leer `users` ni el jefe de zona `tickets`: el cliente llama `POST /api/tickets/[id]/comentarios/avisar` tras crear un comentario. "Pedir cambios" es `POST /api/tickets/[id]/pedir-cambios`, con la lógica en un servicio de dominio con dependencias inyectadas y escritura en una transacción del Admin SDK.

**Tech Stack:** Next.js 14 (App Router, route handlers `runtime = "nodejs"`), TypeScript, Firebase (Firestore client SDK + firebase-admin), nodemailer (vía `src/lib/email.ts`), vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-09-historial-y-conversacion-design.md` (Parte 2). Antecedentes: `2026-10-08-jefe-zona-pre-cierre-gemini-design.md`, Plan A/B del 2026-10-08 y Plan C.

## Global Constraints

- Subcolección `tickets/{ticketId}/comentarios/{comentarioId}`: `autorUid`, `autorNombre`, `autorRol`, `texto: string | null` (null = eliminado), `tipo: "comentario" | "cambios_solicitados"`, `creadoEn` (ISO), `editadoEn?` (ISO), `eliminado: boolean`; más `avisoEnviado?: boolean` que **solo** escribe el servidor.
- Texto: máximo **4000** caracteres (tras `trim()`), validado en `validarTextoComentario` **y** en las reglas. Se pinta solo como texto de React (`{c.texto}` con `whitespace-pre-wrap`), **nunca** con `dangerouslySetInnerHTML`.
- Hilo escribible: `conversacionAbiertaEn` existe **o** `estatus == "Pre-Cierre"`, y `estatus != "Cierre"`. En Cierre: solo lectura.
- Jefe de zona (decisión confirmada por el usuario): lee el resumen y el hilo de todo ticket cuyo `resumenesContrato/{id}` exista (el ticket ya entró a Pre-Cierre), **en cualquier etapa**; escribe comentarios con la misma regla general del hilo (abierto y no Cierre). Su lista `/pre-cierre` muestra todos sus resúmenes y distingue los "en corrección" (estatus fuera de Pre-Cierre/Cierre). Visto bueno y "Pedir cambios" siguen siendo **solo en Pre-Cierre**. `ETAPAS_VISIBLES_JEFE_ZONA` y `accionResumen` (quién crea/refresca el resumen) **no cambian**; solo cambia el lado de lectura.
- **Rol Sitios** (`sitios`, solo lectura; se implementa en paralelo, fuera de este plan, con los helpers `esSitios`, `ROLES_SOLO_RESUMEN`, `esRolSoloResumen(role)`, `puedeDarVistoBueno(role)` —solo `jefe_zona`— en `src/types/user.ts`, y `ROLES_SIN_SOLO_RESUMEN` en el sidebar): lee `resumenesContrato` **solo** con estatus Pre-Cierre/Cierre (consulta filtrada existente, sin la lectura ampliada del jefe de zona); **no** es participante del hilo (no lee historial ni comentarios, no comenta, no da visto bueno, no pide cambios); recibe solo el correo `pre_cierre` y **no** está entre los destinatarios de avisos de comentarios ni en `esParticipante`. Este plan no agrega permisos para `sitios`; donde un `Record<Role, …>` lo exija, se le da el valor vacío/mínimo indicado en cada tarea. Si al ejecutar el plan el rol aún no existe en `Role`, omitir esas entradas.
- `conversacionAbiertaEn` lo fija `calcularPatchAsignacion` la primera vez que el ticket entra a Pre-Cierre (y, para tickets que ya estaban ahí al desplegar, cuando salen).
- "Pedir cambios": solo `jefe_zona`, solo en Pre-Cierre, texto obligatorio; regresa **siempre** a `"Proceso en tramite"`, agrega su entrada a `historialEstatus` (el SLA se reanuda solo por `sla-pausa-rules.ts`), en `resumenesContrato/{id}` pone `estatus: "Proceso en tramite"`, `vistoBueno: null`, `actualizadoEn`; crea el comentario `cambios_solicitados` y la entrada de historial `cambios_solicitados`. Todo en **una** transacción del Admin SDK.
- Bloqueo en Pre-Cierre: el dueño edita su solicitud solo si `estatus` no está en `["Pre-Cierre", "Cierre"]`; Legal/admin, con el ticket en Pre-Cierre, solo tocan: `estatus`, `historialEstatus`, `abogadoAsignadoId`, `fechaAsignacion`, `fechaCompromiso`, `notasCierre`, `fechaCierre`, `diasPipeline`, `diasHabilesTranscurridos`, `nivelServicio`, `tokenCalificacion`, `conversacionAbiertaEn`, `excluidoDelPipeline`, `resumenContrato`. El admin **sí** puede reasignar en Pre-Cierre.
- Tipos de notificación nuevos (texto exacto): `"comentario_ticket"` y `"cambios_solicitados"`. Correo con folio, autor y enlace (`/tickets/{id}` para solicitante y Legal, `/pre-cierre/{id}` para jefes de zona); **el correo y la campana no incluyen el texto del comentario**.
- Rutas de Admin SDK siguen `src/app/api/contratos/resumir/route.ts` y `src/lib/api-auth.ts`: `verifyCallerToken`, rol desde `users/{uid}`, mensajes genéricos al cliente, sin registrar datos sensibles (nunca el texto del comentario; solo `err.message`), `sinUndefined` en escrituras del Admin SDK, escrituras en un solo lote/transacción.
- Enlaces armados con datos de usuario pasan por `esUrlStorageSegura` (este plan no agrega enlaces a archivos; los comentarios son solo texto).
- `pnpm lint` exige `no-explicit-any`: **nada de `any`** ni `eslint-disable` en código ni pruebas; los falsos se tipan con `Pick<Puerto, ...>` y `as unknown as Puerto`.
- El `target` de tsconfig no permite expandir un `Set`: usar `Array.from(set)`. No usar `Array.prototype.at`.
- Toda prueba que importe `src/domain/tickets/ticket-service.ts` necesita `vi.mock("@/lib/storage", () => ({ deleteTicketDocuments: async () => {} }));` antes del import (ya está en `ticket-service.test.ts:3`). Los servicios nuevos de este plan **no** importan nada de Firebase.
- Verificación con el código de salida real: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`. Nada de `| grep` que oculte fallas. Commit **solo** si los tres terminan con código 0 (y solo si el usuario autorizó commits).
- `firestore.rules` está en `.gitignore`: se edita en disco, **no** se hace commit, **no** hay emulador ni CLI locales y **nunca** se planea `firebase deploy`. La tarea de reglas termina con una lista MANUAL marcada NO EJECUTADA; el usuario publica a mano. Cada regla documenta su conteo de `get()`/`getAfter()` (10 documentos distintos por solicitud simple, 20 por lote).
- No hay pruebas de componentes: los cambios de pantalla son pequeños, la lógica va a módulos puros probados y cada tarea de UI termina con verificación manual marcada NO EJECUTADA. Se usan las clases y piezas existentes (`section-card`, `eyebrow`, `field-label`, `field`, `Badge`, `Button`, `DosColumnas`). La conversación va en la **columna izquierda** de `/pre-cierre/[id]` y del detalle del ticket.
- Comentarios: lectura con un solo `orderBy("creadoEn", "asc")` (índice automático de un campo).
- Identificadores en español sin acentos; textos de UI sin acentos como en `ticket-detail.tsx`.
- **Orden de despliegue:** publicar las reglas del Task 3 antes de probar en la app los Tasks 6-8 (la app usa la base real).

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/types/comentario.ts` (nuevo) | `TipoComentario`, `NuevoComentario`, `Comentario` |
| `src/types/ticket.ts` (mod) | `conversacionAbiertaEn?: string` |
| `src/domain/tickets/conversacion-rules.ts` (nuevo) | `MAX_TEXTO_COMENTARIO`, `validarTextoComentario`, `debeAbrirConversacion`, `hiloVisible`, `hiloEscribible`, `esParticipante`, `puedeEditarComentario` |
| `src/domain/tickets/asignacion-rules.ts` (mod) | Fija `conversacionAbiertaEn` |
| `src/domain/tickets/etapa-permisos-rules.ts` (nuevo) | `camposPermitidosPorEtapa`, `puedeModificarCampos`, `solicitudEditable`, `bloqueadoPorPreCierre` |
| `src/domain/tickets/ticket-service.ts` (mod) | Rechaza editar solicitud/sitio en Pre-Cierre |
| `src/domain/notificaciones/*` (mod/nuevo) | Tipos de aviso, preferencias, `conversacion-avisos.ts`, `ruta-notificacion.ts` |
| `src/lib/notificaciones-email.ts` (mod), `src/lib/avisos-conversacion.ts` (nuevo) | Envío de avisos de la conversación (servidor) |
| `src/app/api/tickets/[id]/comentarios/avisar/route.ts` (nuevo) | Avisos tras crear un comentario |
| `src/domain/tickets/comentario-repository.ts` (nuevo), `src/infrastructure/firestore/comentario-repository.ts` (nuevo) | Puerto e implementación de comentarios |
| `src/domain/tickets/conversacion-service.ts` (nuevo), `src/lib/conversacion.ts` (nuevo), `src/hooks/use-comentarios.ts` (nuevo) | Servicio, fachada, hook |
| `src/domain/tickets/pedir-cambios-service.ts` (nuevo), `src/app/api/tickets/[id]/pedir-cambios/route.ts` (nuevo) | "Pedir cambios" |
| `src/components/tickets/conversacion-panel.tsx` (nuevo); `ticket-detail.tsx`, `pre-cierre-detalle.tsx`, `notification-bell.tsx` (mod) | Pantallas |
| `firestore.rules` (mod, solo disco) | Bloqueo en Pre-Cierre, comentarios, historial de comentarios, lectura de `resumenesContrato` por el jefe de zona sin filtro de etapa |
| `src/domain/contratos/resumen-presentacion.ts` (mod), `src/infrastructure/firestore/resumen-contrato-repository.ts` (mod), `src/hooks/use-resumenes-contrato.ts` (mod), `src/components/pre-cierre/pre-cierre-lista.tsx` (mod) | Lista del jefe de zona con tickets "en correccion" (Task 9) |

---

### Task 1: Modelo del comentario y reglas puras de la conversación

**Files:**
- Create: `src/types/comentario.ts`
- Modify: `src/types/ticket.ts:102-104`
- Create: `src/domain/tickets/conversacion-rules.ts`
- Modify: `src/domain/tickets/asignacion-rules.ts:1-3,60-65`
- Test: `src/domain/tickets/conversacion-rules.test.ts` (nuevo), `src/domain/tickets/asignacion-rules.test.ts` (agregar al final)

**Interfaces:**
- Consumes: `Ticket`, `Estatus` (`src/types/ticket.ts`), `isAdminRole`, `Role` (`src/types/user.ts`), `calcularPatchAsignacion` (`asignacion-rules.ts:19`).
- Produces:
  - `type TipoComentario = "comentario" | "cambios_solicitados"`; `interface NuevoComentario { autorUid: string; autorNombre: string; autorRol: Role; texto: string | null; tipo: TipoComentario; creadoEn: string; editadoEn?: string; eliminado: boolean; avisoEnviado?: boolean }`; `interface Comentario extends NuevoComentario { id: string }`.
  - `Ticket.conversacionAbiertaEn?: string`.
  - `MAX_TEXTO_COMENTARIO = 4000`; `type ResultadoTexto = { ok: true; texto: string } | { ok: false; error: string }`; `validarTextoComentario(texto: string): ResultadoTexto`.
  - `debeAbrirConversacion(current: Pick<Ticket, "estatus" | "conversacionAbiertaEn">, nuevoEstatus: Estatus): boolean`.
  - `hiloVisible(t: Pick<Ticket, "estatus" | "conversacionAbiertaEn">): boolean`; `hiloEscribible(t: Pick<Ticket, "estatus" | "conversacionAbiertaEn">): boolean`.
  - `esParticipante(sesion: { uid: string | null; role: Role; abogadoId: string | null }, ticket: Pick<Ticket, "solicitanteId" | "abogadoAsignadoId">): boolean`.
  - `puedeEditarComentario(uid: string | null, comentario: Pick<NuevoComentario, "autorUid" | "eliminado" | "tipo">): boolean`.
  - `calcularPatchAsignacion` agrega `patch.conversacionAbiertaEn = ahora.toISOString()` cuando `debeAbrirConversacion(current, input.estatus)`.

- [ ] **Step 1: Escribir las pruebas que fallan** — crear `src/domain/tickets/conversacion-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  debeAbrirConversacion,
  esParticipante,
  hiloEscribible,
  hiloVisible,
  MAX_TEXTO_COMENTARIO,
  puedeEditarComentario,
  validarTextoComentario,
} from "./conversacion-rules";

describe("validarTextoComentario", () => {
  it("recorta espacios y acepta texto normal", () => {
    expect(validarTextoComentario("  Falta el anexo  ")).toEqual({ ok: true, texto: "Falta el anexo" });
  });

  it("rechaza texto vacio o solo espacios", () => {
    expect(validarTextoComentario("   ").ok).toBe(false);
    expect(validarTextoComentario("").ok).toBe(false);
  });

  it("acepta exactamente 4000 caracteres y rechaza 4001", () => {
    expect(MAX_TEXTO_COMENTARIO).toBe(4000);
    expect(validarTextoComentario("a".repeat(4000)).ok).toBe(true);
    expect(validarTextoComentario("a".repeat(4001))).toEqual({ ok: false, error: "El comentario no puede pasar de 4000 caracteres." });
  });
});

describe("hilo de la conversacion", () => {
  it("se habilita en Pre-Cierre aunque no tenga conversacionAbiertaEn (tickets previos al despliegue)", () => {
    expect(hiloVisible({ estatus: "Pre-Cierre" })).toBe(true);
    expect(hiloEscribible({ estatus: "Pre-Cierre" })).toBe(true);
  });

  it("si regresa a una etapa anterior se sigue escribiendo", () => {
    const t = { estatus: "Proceso en tramite" as const, conversacionAbiertaEn: "2026-10-01T00:00:00.000Z" };
    expect(hiloVisible(t)).toBe(true);
    expect(hiloEscribible(t)).toBe(true);
  });

  it("en Cierre es de solo lectura", () => {
    const t = { estatus: "Cierre" as const, conversacionAbiertaEn: "2026-10-01T00:00:00.000Z" };
    expect(hiloVisible(t)).toBe(true);
    expect(hiloEscribible(t)).toBe(false);
  });

  it("un ticket que nunca llego a Pre-Cierre no tiene hilo", () => {
    expect(hiloVisible({ estatus: "Proceso en tramite" })).toBe(false);
    expect(hiloVisible({ estatus: "Cierre" })).toBe(false);
  });
});

describe("debeAbrirConversacion", () => {
  it("al entrar por primera vez a Pre-Cierre", () => {
    expect(debeAbrirConversacion({ estatus: "Proceso en tramite" }, "Pre-Cierre")).toBe(true);
  });

  it("no si ya estaba abierta", () => {
    expect(debeAbrirConversacion({ estatus: "Proceso en tramite", conversacionAbiertaEn: "x" }, "Pre-Cierre")).toBe(false);
  });

  it("un ticket que ya estaba en Pre-Cierre al desplegar la abre al salir", () => {
    expect(debeAbrirConversacion({ estatus: "Pre-Cierre" }, "Cierre")).toBe(true);
  });

  it("no en etapas previas", () => {
    expect(debeAbrirConversacion({ estatus: "Recepcion de solicitud" }, "Proceso en tramite")).toBe(false);
  });
});

describe("esParticipante", () => {
  const ticket = { solicitanteId: "sol", abogadoAsignadoId: "AB1" };

  it("dueno, abogado asignado, gerente juridico, admin y jefe de zona", () => {
    expect(esParticipante({ uid: "sol", role: "solicitante", abogadoId: null }, ticket)).toBe(true);
    expect(esParticipante({ uid: "a", role: "abogado", abogadoId: "AB1" }, ticket)).toBe(true);
    expect(esParticipante({ uid: "g", role: "gerente_juridico", abogadoId: null }, ticket)).toBe(true);
    expect(esParticipante({ uid: "ad", role: "admin", abogadoId: null }, ticket)).toBe(true);
    expect(esParticipante({ uid: "j", role: "jefe_zona", abogadoId: null }, ticket)).toBe(true);
  });

  it("no participan mesa de control, otros abogados ni otros solicitantes", () => {
    expect(esParticipante({ uid: "m", role: "mesa_control", abogadoId: null }, ticket)).toBe(false);
    expect(esParticipante({ uid: "a2", role: "abogado", abogadoId: "AB2" }, ticket)).toBe(false);
    expect(esParticipante({ uid: "otro", role: "solicitante", abogadoId: null }, ticket)).toBe(false);
    expect(esParticipante({ uid: null, role: "admin", abogadoId: null }, ticket)).toBe(false);
  });

  it("el rol sitios (solo resumen) no participa", () => {
    expect(esParticipante({ uid: "s", role: "sitios", abogadoId: null }, ticket)).toBe(false);
  });
});

describe("puedeEditarComentario", () => {
  const propio = { autorUid: "u1", eliminado: false, tipo: "comentario" as const };

  it("solo el autor, sobre un comentario vivo de tipo comentario", () => {
    expect(puedeEditarComentario("u1", propio)).toBe(true);
    expect(puedeEditarComentario("u2", propio)).toBe(false);
    expect(puedeEditarComentario(null, propio)).toBe(false);
    expect(puedeEditarComentario("u1", { ...propio, eliminado: true })).toBe(false);
    expect(puedeEditarComentario("u1", { ...propio, tipo: "cambios_solicitados" })).toBe(false);
  });
});
```

y agregar al final de `src/domain/tickets/asignacion-rules.test.ts`:

```ts
describe("conversacionAbiertaEn", () => {
  const ahora = new Date("2026-10-09T15:00:00.000Z");
  const a = (estatus: Estatus) => ({ estatus, abogadoAsignadoId: null, notasCierre: null });

  it("se fija al entrar por primera vez a Pre-Cierre", () => {
    const { patch } = calcularPatchAsignacion(buildTicket(), a("Pre-Cierre"), "u1", ahora);
    expect(patch.conversacionAbiertaEn).toBe(ahora.toISOString());
  });

  it("no se reescribe si ya existe", () => {
    const current = buildTicket({ conversacionAbiertaEn: "2026-10-01T00:00:00.000Z" });
    const { patch } = calcularPatchAsignacion(current, a("Pre-Cierre"), "u1", ahora);
    expect("conversacionAbiertaEn" in patch).toBe(false);
  });

  it("un ticket que ya estaba en Pre-Cierre la abre al salir", () => {
    const { patch } = calcularPatchAsignacion(buildTicket({ estatus: "Pre-Cierre" }), a("Proceso en tramite"), "u1", ahora);
    expect(patch.conversacionAbiertaEn).toBe(ahora.toISOString());
  });

  it("en etapas previas no se abre", () => {
    const { patch } = calcularPatchAsignacion(buildTicket(), a("Proceso en tramite"), "u1", ahora);
    expect("conversacionAbiertaEn" in patch).toBe(false);
  });
});
```

(agregar `import type { Estatus } from "@/types/ticket";` al inicio de `asignacion-rules.test.ts`).

- [ ] **Step 2: Verificar que fallan** — `pnpm test src/domain/tickets/conversacion-rules.test.ts src/domain/tickets/asignacion-rules.test.ts`. Esperado: FAIL (módulo inexistente; `conversacionAbiertaEn` no existe en `Ticket`).

- [ ] **Step 3: Implementar**

Crear `src/types/comentario.ts`:

```ts
import type { Role } from "./user";

export type TipoComentario = "comentario" | "cambios_solicitados";

// Documento tickets/{ticketId}/comentarios/{comentarioId}. "cambios_solicitados" solo lo crea el servidor.
export interface NuevoComentario {
  autorUid: string;
  autorNombre: string;
  autorRol: Role;
  texto: string | null; // null cuando esta eliminado (borrado logico)
  tipo: TipoComentario;
  creadoEn: string; // ISO
  editadoEn?: string; // ISO
  eliminado: boolean;
  // Solo lo escribe el servidor (Admin SDK) al mandar los avisos: evita avisos repetidos.
  avisoEnviado?: boolean;
}

export interface Comentario extends NuevoComentario {
  id: string;
}
```

En `src/types/ticket.ts`, después de `excluidoDelPipeline?: boolean;` (línea 103):

```ts

  // Se fija la primera vez que el ticket entra a Pre-Cierre: habilita la conversacion (ver conversacion-rules.ts).
  conversacionAbiertaEn?: string; // ISO
```

Crear `src/domain/tickets/conversacion-rules.ts`:

```ts
import type { Estatus, Ticket } from "@/types/ticket";
import { isAdminRole, type Role } from "@/types/user";
import type { NuevoComentario } from "@/types/comentario";

// Sincronizar con textoComentarioValido() en firestore.rules.
export const MAX_TEXTO_COMENTARIO = 4000;

export type ResultadoTexto = { ok: true; texto: string } | { ok: false; error: string };

export function validarTextoComentario(texto: string): ResultadoTexto {
  const limpio = texto.trim();
  if (!limpio) return { ok: false, error: "Escribe un comentario." };
  if (limpio.length > MAX_TEXTO_COMENTARIO) {
    return { ok: false, error: `El comentario no puede pasar de ${MAX_TEXTO_COMENTARIO} caracteres.` };
  }
  return { ok: true, texto: limpio };
}

type EstadoHilo = Pick<Ticket, "estatus" | "conversacionAbiertaEn">;

// Primera entrada a Pre-Cierre; los tickets que ya estaban ahi al desplegar la abren al salir.
export function debeAbrirConversacion(current: EstadoHilo, nuevoEstatus: Estatus): boolean {
  return !current.conversacionAbiertaEn && (nuevoEstatus === "Pre-Cierre" || current.estatus === "Pre-Cierre");
}

export function hiloVisible(ticket: EstadoHilo): boolean {
  return !!ticket.conversacionAbiertaEn || ticket.estatus === "Pre-Cierre";
}

// Sincronizar con hiloEscribible() en firestore.rules.
export function hiloEscribible(ticket: EstadoHilo): boolean {
  return ticket.estatus !== "Cierre" && hiloVisible(ticket);
}

// Sincronizar con esParticipante() en firestore.rules. El jefe de zona, ademas, solo si existe el resumen
// del ticket (ya entro a Pre-Cierre), en cualquier etapa; eso lo exigen las reglas y en pantalla solo
// llega por /pre-cierre.
export function esParticipante(
  sesion: { uid: string | null; role: Role; abogadoId: string | null },
  ticket: Pick<Ticket, "solicitanteId" | "abogadoAsignadoId">
): boolean {
  if (!sesion.uid) return false;
  if (isAdminRole(sesion.role) || sesion.role === "jefe_zona") return true;
  if (ticket.solicitanteId === sesion.uid) return true;
  return !!sesion.abogadoId && sesion.abogadoId === ticket.abogadoAsignadoId;
}

// Solo el autor, y solo comentarios normales vivos ("cambios_solicitados" no se edita: lo creo el servidor).
export function puedeEditarComentario(
  uid: string | null,
  comentario: Pick<NuevoComentario, "autorUid" | "eliminado" | "tipo">
): boolean {
  return !!uid && comentario.autorUid === uid && !comentario.eliminado && comentario.tipo === "comentario";
}
```

En `src/domain/tickets/asignacion-rules.ts` agregar el import después de la línea 2:

```ts
import { debeAbrirConversacion } from "./conversacion-rules";
```

e inmediatamente antes de `return {` (línea 65):

```ts
  if (debeAbrirConversacion(current, input.estatus)) {
    patch.conversacionAbiertaEn = ahora.toISOString();
  }

```

- [ ] **Step 4: Verificar que pasan** — `pnpm test src/domain/tickets/conversacion-rules.test.ts src/domain/tickets/asignacion-rules.test.ts`. Esperado: PASS.

- [ ] **Step 5: Verificación completa y commit** — `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (código 0).

```bash
git add src/types/comentario.ts src/types/ticket.ts src/domain/tickets/conversacion-rules.ts src/domain/tickets/conversacion-rules.test.ts src/domain/tickets/asignacion-rules.ts src/domain/tickets/asignacion-rules.test.ts
git commit -m "feat: modelo y reglas puras de la conversacion de Pre-Cierre"
```

---

### Task 2: Bloqueo de la solicitud en Pre-Cierre (tabla de campos, servicio y pantalla)

**Files:**
- Create: `src/domain/tickets/etapa-permisos-rules.ts`
- Test: `src/domain/tickets/etapa-permisos-rules.test.ts`
- Modify: `src/domain/tickets/ticket-service.ts` (`updateTicketSolicitud`, `updateTicketSitio` en la versión del Plan C Task 4)
- Modify: `src/domain/tickets/ticket-service.test.ts` (dos pruebas existentes + una nueva)
- Modify: `src/components/tickets/ticket-detail.tsx` (`puedeEditarSolicitud` línea ~140, `puedeEditarDocumentos` ~144, `puedeCambiarSitio` ~154, aviso en la sección "Solicitud")

**Interfaces:**
- Consumes: `calcularPatchAsignacion` (incluye `conversacionAbiertaEn` desde el Task 1); `LEGAL_STAFF_ROLES`, `isAdminRole`, `isSolicitanteRole` (`src/types/user.ts`).
- Produces:
  - `CAMPOS_PROCESO_PRE_CIERRE` (14 campos, `as const`), `CAMPOS_SOLICITUD_DUENO` (8 campos), `CAMPOS_SATISFACCION`.
  - `type CamposPermitidos = { tipo: "todos"; excepto: readonly string[] } | { tipo: "solo"; campos: readonly string[] }`.
  - `camposPermitidosPorEtapa(estatus: Estatus, rol: Role): CamposPermitidos` (para `solicitante`/`gerente_area` supone que es el dueño).
  - `puedeModificarCampos(estatus: Estatus, rol: Role, campos: string[]): boolean`.
  - `solicitudEditable(estatus: Estatus): boolean` (no en Pre-Cierre ni Cierre); `bloqueadoPorPreCierre(estatus: Estatus): boolean`.
  - `MENSAJE_BLOQUEO_PRE_CIERRE: string`; `updateTicketSolicitud` y `updateTicketSitio` lanzan `new Error(MENSAJE_BLOQUEO_PRE_CIERRE)` si el ticket está en Pre-Cierre (sin escribir).

Contexto: hoy la regla del dueño permite editar mientras `estatus != "Cierre"` (`firestore.rules:77-82`) y Legal/admin editan todo (`:72-73`). En la pantalla, `puedeEditarSolicitud` (`ticket-detail.tsx:140`) y `puedeEditarDocumentos` (`:144`) solo excluyen Cierre y `puedeCambiarSitio` (`:154`) no mira la etapa. El sitio sí se puede seguir cambiando en Cierre (Mesa/admin), como hoy.

- [ ] **Step 1: Escribir la prueba que falla** — crear `src/domain/tickets/etapa-permisos-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  bloqueadoPorPreCierre,
  CAMPOS_PROCESO_PRE_CIERRE,
  camposPermitidosPorEtapa,
  puedeModificarCampos,
  solicitudEditable,
} from "./etapa-permisos-rules";
import { calcularPatchAsignacion } from "./asignacion-rules";
import { buildTicket } from "@/test/ticket-fixture";
import type { Ticket } from "@/types/ticket";

// Campos que de verdad cambian (lo que Firestore ve en diff().affectedKeys()).
function camposAfectados(antes: Ticket, patch: Partial<Ticket>): string[] {
  return (Object.keys(patch) as (keyof Ticket)[]).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(antes[k]));
}

describe("camposPermitidosPorEtapa", () => {
  it("en Pre-Cierre admin y gerente juridico solo tocan campos de proceso (incluida la reasignacion)", () => {
    expect(camposPermitidosPorEtapa("Pre-Cierre", "admin")).toEqual({ tipo: "solo", campos: CAMPOS_PROCESO_PRE_CIERRE });
    expect(camposPermitidosPorEtapa("Pre-Cierre", "gerente_juridico")).toEqual({ tipo: "solo", campos: CAMPOS_PROCESO_PRE_CIERRE });
    expect(puedeModificarCampos("Pre-Cierre", "admin", ["abogadoAsignadoId", "fechaAsignacion", "fechaCompromiso"])).toBe(true);
  });

  it("en Pre-Cierre nadie cambia descripcion, servicio, area, sitio, documentos ni datos del contrato", () => {
    for (const rol of ["admin", "gerente_juridico", "mesa_control", "abogado", "solicitante", "gerente_area"] as const) {
      for (const campo of ["descripcion", "servicioId", "areaEmpresa", "sitioArrendamiento", "documentacion", "contratoArrendamiento"]) {
        expect(puedeModificarCampos("Pre-Cierre", rol, [campo])).toBe(false);
      }
    }
  });

  it("Legal no admin nunca reasigna abogado", () => {
    expect(puedeModificarCampos("Proceso en tramite", "mesa_control", ["abogadoAsignadoId"])).toBe(false);
    expect(puedeModificarCampos("Pre-Cierre", "abogado", ["abogadoAsignadoId"])).toBe(false);
    expect(puedeModificarCampos("Proceso en tramite", "abogado", ["descripcion", "estatus"])).toBe(true);
  });

  it("el dueno edita su solicitud antes de Pre-Cierre, nada en Pre-Cierre y solo la calificacion en Cierre", () => {
    expect(puedeModificarCampos("Proceso en tramite", "solicitante", ["descripcion", "documentacion"])).toBe(true);
    expect(puedeModificarCampos("Pre-Cierre", "solicitante", ["descripcion"])).toBe(false);
    expect(puedeModificarCampos("Cierre", "solicitante", ["satisfaccion", "comentarioSatisfaccion"])).toBe(true);
    expect(puedeModificarCampos("Cierre", "solicitante", ["descripcion"])).toBe(false);
  });

  it("el jefe de zona y el rol sitios no editan tickets", () => {
    expect(camposPermitidosPorEtapa("Pre-Cierre", "jefe_zona")).toEqual({ tipo: "solo", campos: [] });
    expect(camposPermitidosPorEtapa("Proceso en tramite", "sitios")).toEqual({ tipo: "solo", campos: [] });
  });

  it("lo que escribe updateTicketAsignacion al salir de Pre-Cierre esta permitido", () => {
    const antes = buildTicket({
      estatus: "Pre-Cierre", abogadoAsignadoId: "AB1", fechaAsignacion: "2026-10-01T15:00:00.000Z",
      historialEstatus: [{ estatus: "Pre-Cierre", fecha: "2026-10-05T15:00:00.000Z", uid: "x" }],
    });
    for (const estatus of ["Cierre", "Proceso en tramite"] as const) {
      const { patch } = calcularPatchAsignacion(antes, { estatus, abogadoAsignadoId: "AB1", notasCierre: "listo" }, "u1", new Date("2026-10-09T15:00:00.000Z"));
      expect(puedeModificarCampos("Pre-Cierre", "admin", Object.keys(patch))).toBe(true);
      expect(puedeModificarCampos("Pre-Cierre", "abogado", camposAfectados(antes, patch))).toBe(true);
    }
  });

  it("la exclusion del pipeline es un campo de proceso", () => {
    expect(puedeModificarCampos("Pre-Cierre", "admin", ["excluidoDelPipeline"])).toBe(true);
  });
});

describe("solicitudEditable y bloqueadoPorPreCierre", () => {
  it("la solicitud se edita solo antes de Pre-Cierre", () => {
    expect(solicitudEditable("Proceso en tramite")).toBe(true);
    expect(solicitudEditable("Pre-Cierre")).toBe(false);
    expect(solicitudEditable("Cierre")).toBe(false);
  });

  it("el bloqueo de Pre-Cierre no aplica a Cierre (el sitio se sigue corrigiendo)", () => {
    expect(bloqueadoPorPreCierre("Pre-Cierre")).toBe(true);
    expect(bloqueadoPorPreCierre("Cierre")).toBe(false);
  });
});
```

En `src/domain/tickets/ticket-service.test.ts` (versión del Plan C Task 4):
- Agregar `import { MENSAJE_BLOQUEO_PRE_CIERRE } from "./etapa-permisos-rules";` después de `import { createTicketService } from "./ticket-service";`.
- Reemplazar:

```ts
  it("editar la documentacion en Pre-Cierre refresca contratoUrl y conserva el visto bueno", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"));
```

por:

```ts
  it("editar la documentacion en Cierre refresca contratoUrl y conserva el visto bueno", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Cierre"));
```

- Reemplazar `    const ticket = buildTicket({ id: "t1", estatus: "Pre-Cierre" });` (dentro de "si el resumen falla, la edicion guardada no se pierde") por `    const ticket = buildTicket({ id: "t1", estatus: "Cierre" });`.
- Agregar al final del archivo:

```ts
describe("bloqueo de la solicitud en Pre-Cierre", () => {
  it("rechaza editar la solicitud y el sitio sin escribir nada", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1", estatus: "Pre-Cierre" }));
    await expect(service.updateTicketSolicitud("t1", actor, solicitud)).rejects.toThrow(MENSAJE_BLOQUEO_PRE_CIERRE);
    await expect(service.updateTicketSitio("t1", actorMesa, { clave: "K1", alias: "S" })).rejects.toThrow(MENSAJE_BLOQUEO_PRE_CIERRE);
    expect(lotes).toEqual([]);
  });

  it("en Pre-Cierre si se permiten los cambios de proceso", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1", estatus: "Pre-Cierre" }));
    await service.updateTicketExclusion("t1", actor, true);
    await service.updateTicketAsignacion("t1", actor, input("Cierre"));
    expect(lotes).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Verificar que fallan** — `pnpm test src/domain/tickets/etapa-permisos-rules.test.ts src/domain/tickets/ticket-service.test.ts`. Esperado: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar** — crear `src/domain/tickets/etapa-permisos-rules.ts`:

```ts
import type { Estatus } from "@/types/ticket";
import { isAdminRole, isSolicitanteRole, LEGAL_STAFF_ROLES, type Role } from "@/types/user";

// Sincronizar a mano con camposProcesoPreCierre() en firestore.rules.
export const CAMPOS_PROCESO_PRE_CIERRE = [
  "estatus",
  "historialEstatus",
  "abogadoAsignadoId",
  "fechaAsignacion",
  "fechaCompromiso",
  "notasCierre",
  "fechaCierre",
  "diasPipeline",
  "diasHabilesTranscurridos",
  "nivelServicio",
  "tokenCalificacion",
  "conversacionAbiertaEn",
  "excluidoDelPipeline",
  "resumenContrato",
] as const;

// Sincronizar con la regla del solicitante dueno en firestore.rules (tickets, allow update).
export const CAMPOS_SOLICITUD_DUENO = [
  "areaEmpresa",
  "servicioId",
  "descripcion",
  "documentacion",
  "categoria",
  "puestoResponsableSugerido",
  "slaInterno",
  "fechaCompromiso",
] as const;

export const CAMPOS_SATISFACCION = ["satisfaccion", "comentarioSatisfaccion"] as const;

export type CamposPermitidos = { tipo: "todos"; excepto: readonly string[] } | { tipo: "solo"; campos: readonly string[] };

export const MENSAJE_BLOQUEO_PRE_CIERRE =
  "En Pre-Cierre la solicitud, los documentos y el sitio estan bloqueados; las correcciones se piden en la conversacion.";

// Espejo de "allow update" de tickets en firestore.rules. Para solicitante/gerente_area supone que es
// el dueno del ticket (si no lo es, las reglas no le dejan nada).
export function camposPermitidosPorEtapa(estatus: Estatus, rol: Role): CamposPermitidos {
  if (isAdminRole(rol)) {
    return estatus === "Pre-Cierre" ? { tipo: "solo", campos: CAMPOS_PROCESO_PRE_CIERRE } : { tipo: "todos", excepto: [] };
  }
  if (LEGAL_STAFF_ROLES.includes(rol)) {
    // Reasignar abogado es exclusivo de admin/gerente juridico.
    return estatus === "Pre-Cierre"
      ? { tipo: "solo", campos: CAMPOS_PROCESO_PRE_CIERRE.filter((c) => c !== "abogadoAsignadoId") }
      : { tipo: "todos", excepto: ["abogadoAsignadoId"] };
  }
  if (isSolicitanteRole(rol)) {
    if (estatus === "Cierre") return { tipo: "solo", campos: CAMPOS_SATISFACCION };
    if (estatus === "Pre-Cierre") return { tipo: "solo", campos: [] };
    return { tipo: "solo", campos: CAMPOS_SOLICITUD_DUENO };
  }
  return { tipo: "solo", campos: [] };
}

export function puedeModificarCampos(estatus: Estatus, rol: Role, campos: string[]): boolean {
  const permitidos = camposPermitidosPorEtapa(estatus, rol);
  if (permitidos.tipo === "todos") return campos.every((c) => !permitidos.excepto.includes(c));
  return campos.every((c) => permitidos.campos.includes(c));
}

// Area/servicio/descripcion/documentos en pantalla: solo antes de Pre-Cierre.
export function solicitudEditable(estatus: Estatus): boolean {
  return estatus !== "Pre-Cierre" && estatus !== "Cierre";
}

export function bloqueadoPorPreCierre(estatus: Estatus): boolean {
  return estatus === "Pre-Cierre";
}
```

En `src/domain/tickets/ticket-service.ts` agregar el import:

```ts
import { bloqueadoPorPreCierre, MENSAJE_BLOQUEO_PRE_CIERRE } from "./etapa-permisos-rules";
```

En `updateTicketSolicitud` y en `updateTicketSitio`, inmediatamente después de `if (!current) throw new Error("Ticket no encontrado.");`, agregar:

```ts
    if (bloqueadoPorPreCierre(current.estatus)) throw new Error(MENSAJE_BLOQUEO_PRE_CIERRE);
```

- [ ] **Step 4: Verificar que pasan** — `pnpm test src/domain/tickets/etapa-permisos-rules.test.ts src/domain/tickets/ticket-service.test.ts`. Esperado: PASS.

- [ ] **Step 5: Pantalla** — en `src/components/tickets/ticket-detail.tsx`:
- Import: `import { bloqueadoPorPreCierre, solicitudEditable } from "@/domain/tickets/etapa-permisos-rules";`
- Reemplazar el comentario y la línea de `puedeEditarSolicitud`:

```ts
  // Area/servicio/descripcion: solo el dueno o admin, antes de Pre-Cierre (ver etapa-permisos-rules.ts).
  const puedeEditarSolicitud = (esDueno || isAdminRole(role)) && solicitudEditable(ticket.estatus);
```

- Reemplazar la línea de `puedeEditarDocumentos`:

```ts
  const puedeEditarDocumentos = (puedeEditarSolicitud || esAbogadoAsignado) && solicitudEditable(ticket.estatus);
```

- Reemplazar la línea de `puedeCambiarSitio`:

```ts
  const puedeCambiarSitio = puedeActualizarSitio(role, ticket) && !bloqueadoPorPreCierre(ticket.estatus);
```

- Dentro de la sección "Solicitud", inmediatamente después del `</div>` que cierra el encabezado `<div className="flex items-center justify-between">` (el que contiene `<h2 className="eyebrow">Solicitud</h2>` y el botón Editar):

```tsx
        {bloqueadoPorPreCierre(ticket.estatus) && (
          <p className="text-xs text-muted">
            En Pre-Cierre la solicitud, los documentos y el sitio estan bloqueados. Las correcciones se piden en la conversacion.
          </p>
        )}
```

- [ ] **Step 6: Verificación completa** — `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (código 0).

- [ ] **Step 7: Verificación manual (NO EJECUTADA)** — `pnpm dev` con un ticket de prueba en Pre-Cierre: (1) como dueño y como admin no aparece "Editar" en "Solicitud" y se ve el aviso; (2) como mesa de control no aparece "Cambiar sitio"; (3) como admin sí se puede cambiar estatus, notas y reasignar abogado; (4) en Cierre, mesa de control sigue viendo "Cambiar sitio". Anotar resultados.

- [ ] **Step 8: Commit**:

```bash
git add src/domain/tickets/etapa-permisos-rules.ts src/domain/tickets/etapa-permisos-rules.test.ts src/domain/tickets/ticket-service.ts src/domain/tickets/ticket-service.test.ts src/components/tickets/ticket-detail.tsx
git commit -m "feat: bloquea solicitud, documentos y sitio en Pre-Cierre"
```

---

### Task 3: Reglas de Firestore: bloqueo en Pre-Cierre, comentarios, historial de comentarios y lectura del jefe de zona (solo disco, verificación manual)

**Files:**
- Modify (en disco, **sin commit**): `firestore.rules`

**Interfaces:**
- Consumes (Plan C Task 3): `esDuenoTicket(ticketId)`, `esAbogadoAsignado(ticketId)`, `entradaHistorialValida()`, `vistoBuenoEnEsteLote(ticketId)`, bloque `match /tickets/{ticketId}/historial/{entradaId}`.
- Produces: funciones `jefeZonaVeTicket(ticketId)`, `esParticipante(ticketId)`, `hiloEscribible(ticketId)`, `textoComentarioValido(texto)`, `comentarioPropioEnEsteLote(ticketId)`, `camposProcesoPreCierre()`, `soloCamposDeProcesoEnPreCierre()`; bloque `match /tickets/{ticketId}/comentarios/{comentarioId}`; nueva `allow update` de `tickets`; `allow read` de `resumenesContrato` para `isJefeZona()` sin filtro de etapa (lo consume el Task 9 y la pantalla de detalle tras "Pedir cambios").

**Escrituras sobre un ticket en Pre-Cierre después de este plan (todas deben seguir funcionando):**

| Quién / dónde | Campos que cambian | ¿Permitido? |
|---|---|---|
| Legal/admin "Guardar" o kanban → Cierre (`calcularPatchAsignacion`, `asignacion-rules.ts:25-63`) | `estatus`, `historialEstatus`, `notasCierre`, `fechaCierre`, `diasPipeline`, `diasHabilesTranscurridos`, `nivelServicio`, `tokenCalificacion`, `conversacionAbiertaEn` (si faltaba); `abogadoAsignadoId` va en el patch pero sin cambio | Sí (todos en la lista) |
| Legal/admin → etapa anterior | `estatus`, `historialEstatus`, `notasCierre`, `conversacionAbiertaEn` (si faltaba) | Sí |
| Admin reasigna en Pre-Cierre | `abogadoAsignadoId`, `fechaAsignacion`, `fechaCompromiso` | Sí (solo `isAdmin()`) |
| Admin excluye del pipeline (`updateTicketExclusion`) | `excluidoDelPipeline` | Sí |
| Ruta de Gemini (`api/contratos/resumir`) y "Pedir cambios" | Admin SDK: no pasa por reglas | n/a |
| `updateTicketSolicitud` / `updateTicketSitio` | campos de solicitud/sitio | **No** (el servicio y la pantalla ya lo impiden; la regla es la autoridad) |
| Calificación del dueño (`submitSatisfaccion`) | `satisfaccion`, `comentarioSatisfaccion` | Solo en Cierre, sin cambio respecto a hoy |
| `backfillSlaHistorico` | solo tickets en Cierre | n/a |

- [ ] **Step 1: Agregar funciones** — en `firestore.rules`, después de `vistoBuenoEnEsteLote(ticketId)` (agregada por Plan C) y antes de `match /users/{uid}`, insertar:

```
    // ---- Conversacion de Pre-Cierre (Plan D) ----
    // Sincronizar con src/domain/tickets/conversacion-rules.ts. El jefe de zona participa en todo ticket
    // que ya entro a Pre-Cierre (existe su resumen), en cualquier etapa (decision confirmada por el usuario).
    // El resumen solo lo crea Legal/admin al entrar a Pre-Cierre/Cierre (ver accionResumen).
    function jefeZonaVeTicket(ticketId) {
      return isJefeZona()
             && exists(/databases/$(database)/documents/resumenesContrato/$(ticketId));
    }

    function esParticipante(ticketId) {
      return isSignedIn()
             && (isAdmin() || esDuenoTicket(ticketId) || esAbogadoAsignado(ticketId) || jefeZonaVeTicket(ticketId));
    }

    function hiloEscribible(ticketId) {
      let ticket = get(/databases/$(database)/documents/tickets/$(ticketId)).data;
      return ticket.estatus != "Cierre"
             && (ticket.get("conversacionAbiertaEn", null) != null || ticket.estatus == "Pre-Cierre");
    }

    // Sincronizar con MAX_TEXTO_COMENTARIO.
    function textoComentarioValido(texto) {
      return texto is string && texto.size() > 0 && texto.size() <= 4000;
    }

    // Entrada de historial de una edicion/borrado de comentario: quien la escribe es el autor del
    // comentario que se modifica en este mismo lote.
    function comentarioPropioEnEsteLote(ticketId) {
      return request.resource.data.tipo in ["comentario_editado", "comentario_eliminado"]
             && request.resource.data.comentarioId is string
             && esParticipante(ticketId)
             && getAfter(/databases/$(database)/documents/tickets/$(ticketId)/comentarios/$(request.resource.data.comentarioId)).data.autorUid == request.auth.uid;
    }

    // Sincronizar a mano con CAMPOS_PROCESO_PRE_CIERRE en src/domain/tickets/etapa-permisos-rules.ts.
    function camposProcesoPreCierre() {
      return ["estatus", "historialEstatus", "abogadoAsignadoId", "fechaAsignacion", "fechaCompromiso",
              "notasCierre", "fechaCierre", "diasPipeline", "diasHabilesTranscurridos", "nivelServicio",
              "tokenCalificacion", "conversacionAbiertaEn", "excluidoDelPipeline", "resumenContrato"];
    }

    function soloCamposDeProcesoEnPreCierre() {
      return resource.data.estatus != "Pre-Cierre"
             || request.resource.data.diff(resource.data).affectedKeys().hasOnly(camposProcesoPreCierre());
    }
```

- [ ] **Step 2: Reemplazar `allow update` de `match /tickets/{folio}`** — sustituir el comentario y la regla actuales (líneas 68-82 del archivo original: desde `// Legal/admin editan todo, ...` hasta el `));` que cierra la regla del dueño) por:

```
      // Legal/admin editan todo, salvo: reasignar abogado (abogadoAsignadoId) es exclusivo de
      // Admin/Gerente Juridico; y en Pre-Cierre solo campos de proceso (camposProcesoPreCierre).
      // El solicitante dueno solo: satisfaccion (ya en Cierre) o su propia solicitud (antes de Pre-Cierre).
      allow update: if (isAdmin() && soloCamposDeProcesoEnPreCierre())
                    || (isLegalStaff()
                        && request.resource.data.abogadoAsignadoId == resource.data.abogadoAsignadoId
                        && soloCamposDeProcesoEnPreCierre())
                    || (isSignedIn() && resource.data.solicitanteId == request.auth.uid
                        && resource.data.estatus == "Cierre"
                        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["satisfaccion", "comentarioSatisfaccion"]))
                    || (isSignedIn() && resource.data.solicitanteId == request.auth.uid
                        && !(resource.data.estatus in ["Pre-Cierre", "Cierre"])
                        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(
                             ["areaEmpresa", "servicioId", "descripcion", "documentacion",
                              "categoria", "puestoResponsableSugerido", "slaInterno", "fechaCompromiso"]
                           ));
```

Lecturas: solo `users/{uid}` (myRole) = **1**.

Además, en `match /resumenesContrato/{ticketId}`, reemplazar el comentario del bloque y la regla `allow read` (hoy `isLegalStaff() || isAdmin() || (isJefeZona() && resource.data.estatus in ["Pre-Cierre", "Cierre"])`) por:

```
    // Resumen derivado del ticket para el jefe de zona. Lo escribe Legal/admin al mover el ticket a
    // Pre-Cierre/Cierre (ver ticket-service sincronizarResumen) y despues solo actualiza su estatus.
    // El jefe de zona lee todos los resumenes existentes, en cualquier etapa (los que regresaron a una
    // etapa anterior aparecen "en correccion"), y unicamente puede fijar su visto bueno, y solo en Pre-Cierre.
```

```
      allow read: if isLegalStaff() || isAdmin() || isJefeZona()
                  || (<clausula del rol sitios tal como la dejo su implementacion, con resource.data.estatus in ["Pre-Cierre", "Cierre"]>);
```

**Rol Sitios:** conservar **sin cambios** la cláusula de lectura que agregó la implementación del rol `sitios` (filtro estricto `resource.data.estatus in ["Pre-Cierre", "Cierre"]`); copiarla tal cual del archivo en disco en lugar del marcador `<...>` de arriba (si el rol aún no existe, la regla queda `isLegalStaff() || isAdmin() || isJefeZona()`). Solo el jefe de zona recibe la lectura sin filtro. `sitios` no aparece en `esParticipante`, ni en las reglas de `comentarios` ni de `historial`, así que no lee ni escribe ninguno de los dos. Agregar al checklist del Step 5: `list` de `resumenesContrato` como `sitios` sin filtro → denegado; con `where("estatus","in",["Pre-Cierre","Cierre"])` → permitido; `list` de `tickets/{T}/comentarios` y de `historial` como `sitios` → denegado.

`create, delete` y `update` de `resumenesContrato` no cambian (el visto bueno sigue exigiendo `resource.data.estatus == "Pre-Cierre"`). Lecturas: `users/{uid}` = **1**. Sin la condición sobre `resource.data.estatus` para el jefe de zona, su consulta ya no necesita `where("estatus", "in", ...)`: el Task 9 le da un método aparte sin filtro (`subscribeTodos`); la consulta filtrada existente sigue siendo válida y es la única que puede usar el rol Sitios.

- [ ] **Step 3: Ampliar `create` del historial** — en `match /tickets/{ticketId}/historial/{entradaId}` (Plan C), reemplazar la regla `allow create` por:

```
      allow create: if isSignedIn() && entradaHistorialValida()
                    && (isLegalStaff() || isAdmin()
                        || (esDuenoTicket(ticketId) && request.resource.data.tipo in ["solicitud", "documentos"])
                        || (isJefeZona() && request.resource.data.tipo == "visto_bueno" && vistoBuenoEnEsteLote(ticketId))
                        || comentarioPropioEnEsteLote(ticketId));
```

Lecturas: `users/{uid}`, `tickets/{ticketId}`, `resumenesContrato/{ticketId}` (`get`/`exists` y `getAfter`), `getAfter` del comentario = **máx. 5** accesos a documentos (`exists()` cuenta igual que `get()`).

- [ ] **Step 4: Agregar el bloque de comentarios** — inmediatamente después del bloque de `historial`:

```
    // Conversacion: borrado logico (update), nunca delete. "cambios_solicitados" solo lo crea el
    // servidor (Admin SDK). avisoEnviado solo lo escribe el servidor.
    match /tickets/{ticketId}/comentarios/{comentarioId} {
      allow read: if esParticipante(ticketId);

      allow create: if esParticipante(ticketId) && hiloEscribible(ticketId)
                    && request.resource.data.keys().hasOnly(["autorUid", "autorNombre", "autorRol", "texto", "tipo", "creadoEn", "eliminado"])
                    && request.resource.data.keys().hasAll(["autorUid", "autorNombre", "autorRol", "texto", "tipo", "creadoEn", "eliminado"])
                    && request.resource.data.autorUid == request.auth.uid
                    && request.resource.data.autorRol == myRole()
                    && request.resource.data.autorNombre is string
                    && request.resource.data.creadoEn is string
                    && request.resource.data.tipo == "comentario"
                    && request.resource.data.eliminado == false
                    && textoComentarioValido(request.resource.data.texto);

      // Solo el autor; no se edita ni se "revive" un comentario eliminado; no se editan los de cambios_solicitados.
      allow update: if esParticipante(ticketId) && hiloEscribible(ticketId)
                    && resource.data.autorUid == request.auth.uid
                    && resource.data.tipo == "comentario"
                    && resource.data.eliminado == false
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["texto", "editadoEn", "eliminado"])
                    && ((request.resource.data.eliminado == false
                         && textoComentarioValido(request.resource.data.texto)
                         && request.resource.data.editadoEn is string)
                        || (request.resource.data.eliminado == true && request.resource.data.texto == null));

      allow delete: if false;
    }
```

Lecturas por regla: `users/{uid}` (isAdmin/isJefeZona/myRole/esAbogadoAsignado), `tickets/{ticketId}` (dueño, abogado, hilo), `exists` de `resumenesContrato/{ticketId}` (jefe de zona) = **máx. 3**. Lote "editar/borrar comentario + entrada de historial": `users`, `tickets`, `resumenesContrato` (`exists`) y `getAfter` del comentario = **máx. 4** documentos distintos (límite 20).

Nota (decisión del usuario): el jefe de zona escribe con la regla general del hilo (`hiloEscribible`), también si el ticket ya regresó a una etapa anterior; en Cierre, solo lectura.

- [ ] **Step 5: Verificación MANUAL (NO EJECUTADA por el plan; Rules Playground de la consola, base `epl-tickets`, y luego la app con las reglas publicadas)**:
  1. `update` de `tickets/{T}` en Pre-Cierre como admin cambiando solo `estatus` y `historialEstatus` → permitido; cambiando `descripcion` → denegado; cambiando `abogadoAsignadoId`, `fechaAsignacion`, `fechaCompromiso` → permitido.
  2. Mismo ticket como `abogado` cambiando `estatus` → permitido; cambiando `abogadoAsignadoId` → denegado; cambiando `documentacion` → denegado.
  3. Como dueño en Pre-Cierre cambiando `descripcion` → denegado; en "Proceso en tramite" → permitido; en Cierre `satisfaccion` → permitido.
  4. Admin en "Proceso en tramite" cambiando `descripcion` → permitido (sin cambio respecto a hoy).
  5. `create` en `tickets/{T}/comentarios/{C}` (T en Pre-Cierre, sin `conversacionAbiertaEn`) como dueño con `{autorUid: <uid>, autorNombre: "x", autorRol: "solicitante", texto: "hola", tipo: "comentario", creadoEn: "2026-10-09T00:00:00Z", eliminado: false}` → permitido; con `tipo: "cambios_solicitados"` → denegado; con `texto` de 4001 caracteres → denegado; con `autorRol: "admin"` → denegado; con `avisoEnviado: true` → denegado.
  6. Mismo `create` como `mesa_control` (sin `abogadoId` del asignado) → denegado; como otro abogado → denegado; como `jefe_zona` con `resumenesContrato/{T}` existente en "Pre-Cierre" → permitido; con el resumen y el ticket en "Proceso en tramite" y `conversacionAbiertaEn` fijado → permitido; con un ticket que no tiene resumen → denegado; `get`/`list` de comentarios como `jefe_zona` con el resumen en "Proceso en tramite" → permitido.
  6b. `list` de `resumenesContrato` como `jefe_zona` **sin** filtro de estatus → permitido; `get` de un resumen en "Proceso en tramite" → permitido; `update` de `vistoBueno` sobre ese resumen → denegado (solo en Pre-Cierre); como `solicitante` → lectura denegada.
  7. `create` con T en Cierre → denegado; T en "Proceso en tramite" con `conversacionAbiertaEn` → permitido.
  8. `update` del comentario como su autor cambiando `texto` y `editadoEn` → permitido; cambiando `autorNombre` → denegado; como otro usuario → denegado; poner `eliminado: true, texto: null` → permitido; luego volver `eliminado: false` → denegado.
  9. `delete` del comentario → denegado.
  10. En la app (Task 8), editar un comentario propio como solicitante y como jefe de zona: el lote (comentario + historial `comentario_editado`) se acepta. Desde la consola del navegador, crear una entrada `comentario_editado` suelta como solicitante → `permission-denied`.
  11. Flujo existente: Legal mueve un ticket Pre-Cierre → Cierre y Pre-Cierre → "Proceso en tramite" desde el detalle y el kanban; el admin excluye del pipeline un ticket en Pre-Cierre; el dueño califica un ticket en Cierre. Todo debe funcionar.
  Anotar el resultado de cada punto. Publicar las reglas a mano cuando todo pase.

- [ ] **Step 6: Sin commit** — `firestore.rules` está ignorado por git; confirmar con `git status`.

---

### Task 4: Tipos de aviso `comentario_ticket` y `cambios_solicitados`

**Files:**
- Modify: `src/domain/notificaciones/notificacion.ts:3-6`
- Modify: `src/domain/notificaciones/email-template.ts:33-80`
- Modify: `src/domain/notificaciones/preferencias-rules.ts:7-30`
- Modify: `src/lib/notificaciones-email.ts:8-18`
- Modify: `src/components/layout/notification-bell.tsx:5,12-46,50-73`
- Modify: `src/app/api/notificaciones/email/route.ts:13`
- Create: `src/domain/notificaciones/conversacion-avisos.ts`, `src/domain/notificaciones/ruta-notificacion.ts`
- Test: `src/domain/notificaciones/preferencias-rules.test.ts`, `email-template.test.ts` (mod); `conversacion-avisos.test.ts`, `ruta-notificacion.test.ts` (nuevos)

**Interfaces:**
- Produces:
  - `TipoNotificacion` incluye `"comentario_ticket" | "cambios_solicitados"`.
  - `type TipoAvisoConversacion = Extract<TipoNotificacion, "comentario_ticket" | "cambios_solicitados">`; `TIPOS_AVISO_CONVERSACION: readonly TipoAvisoConversacion[]`; `esTipoSoloServidor(tipo: unknown): boolean` (en `conversacion-avisos.ts`).
  - `rutaNotificacion(role: Role | null | undefined, ticketId: string): string` (`/pre-cierre/{id}` para `jefe_zona`, `/tickets/{id}` para los demás).
  - Todos los `Record<TipoNotificacion, …>` cubren los dos tipos (lista completa obtenida con `grep -rn "Record<TipoNotificacion" src`): `email-template.ts` `ACENTO_POR_TIPO`, `ETIQUETA_POR_TIPO`, `CAMPOS_POR_TIPO`; `preferencias-rules.ts` `ETIQUETA_CORREO`; `notificaciones-email.ts` `TIPO_LABEL`; `notification-bell.tsx` `TIPO_LABEL`, `TIPO_ICON`, `TIPO_TONE`. Además `CORREOS_POR_ROL` (`Record<Role, …>`) para cada rol participante.

- [ ] **Step 1: Escribir las pruebas que fallan**

`src/domain/notificaciones/preferencias-rules.test.ts`: reemplazar los dos primeros `it` del `describe("tiposCorreoEditables")` por:

```ts
  it("el jefe de zona puede apagar el aviso de Pre-Cierre y los comentarios", () => {
    expect(tiposCorreoEditables("jefe_zona")).toEqual(["pre_cierre", "comentario_ticket"]);
  });

  it("ofrece a cada rol solo los correos que recibe hoy", () => {
    expect(tiposCorreoEditables("admin")).toEqual(["nuevo_ticket", "cambio_estatus", "cierre", "comentario_ticket"]);
    expect(tiposCorreoEditables("abogado")).toEqual(["asignacion", "reasignacion", "comentario_ticket", "cambios_solicitados"]);
    expect(tiposCorreoEditables("mesa_control")).toEqual(["asignacion", "reasignacion", "comentario_ticket", "cambios_solicitados"]);
  });

  it("el rol sitios solo recibe el aviso de Pre-Cierre (no participa en la conversacion)", () => {
    expect(tiposCorreoEditables("sitios")).toEqual(["pre_cierre"]);
  });

  it("los participantes de la conversacion pueden apagar sus avisos", () => {
    for (const rol of ["solicitante", "gerente_area", "gerente_juridico"] as const) {
      expect(tiposCorreoEditables(rol)).toContain("comentario_ticket");
      expect(tiposCorreoEditables(rol)).toContain("cambios_solicitados");
    }
  });
```

`src/domain/notificaciones/email-template.test.ts`: agregar `"comentario_ticket",` y `"cambios_solicitados",` al final del arreglo `TIPOS` y, dentro de `describe("renderEmailNotificacion")`:

```ts
  it("los avisos de la conversacion solo muestran datos minimos del ticket", () => {
    const ticket = { solicitante: "Juana Perez", sitio: "QRO-001", abogado: "Karina Valenzuela", servicio: "Arrendamiento", estatus: "Proceso en tramite" };
    const comentario = renderEmailNotificacion(datos({ tipo: "comentario_ticket", ticket }));
    expect(comentario).toContain("QRO-001");
    expect(comentario).toContain("Juana Perez");
    expect(comentario).not.toContain("Karina Valenzuela");
    expect(comentario).not.toContain("Arrendamiento");
    const cambios = renderEmailNotificacion(datos({ tipo: "cambios_solicitados", ticket }));
    expect(cambios).toContain("Karina Valenzuela");
    expect(cambios).toContain("Proceso en tramite");
    expect(cambios).not.toContain("Arrendamiento");
  });
```

Crear `src/domain/notificaciones/conversacion-avisos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { esTipoSoloServidor } from "./conversacion-avisos";

describe("esTipoSoloServidor", () => {
  it("los avisos de la conversacion no se pueden pedir desde el cliente", () => {
    expect(esTipoSoloServidor("comentario_ticket")).toBe(true);
    expect(esTipoSoloServidor("cambios_solicitados")).toBe(true);
    expect(esTipoSoloServidor("cierre")).toBe(false);
    expect(esTipoSoloServidor(undefined)).toBe(false);
  });
});
```

Crear `src/domain/notificaciones/ruta-notificacion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rutaNotificacion } from "./ruta-notificacion";

describe("rutaNotificacion", () => {
  it("el jefe de zona va a /pre-cierre; los demas a /tickets", () => {
    expect(rutaNotificacion("jefe_zona", "t1")).toBe("/pre-cierre/t1");
    expect(rutaNotificacion("solicitante", "t1")).toBe("/tickets/t1");
    expect(rutaNotificacion("admin", "t1")).toBe("/tickets/t1");
    expect(rutaNotificacion(null, "t1")).toBe("/tickets/t1");
  });
});
```

- [ ] **Step 2: Verificar que fallan** — `pnpm test src/domain/notificaciones`. Esperado: FAIL (tipos/módulos inexistentes; expectativas de preferencias distintas).

- [ ] **Step 3: Implementar**

`src/domain/notificaciones/notificacion.ts` (líneas 3-6):

```ts
export type TipoNotificacion =
  | "nuevo_ticket" | "asignacion" | "cambio_estatus" | "cierre"
  | "creacion_solicitante" | "asignacion_solicitante"
  | "reasignacion" | "reasignacion_solicitante" | "pre_cierre"
  | "comentario_ticket" | "cambios_solicitados";
```

`src/domain/notificaciones/email-template.ts`: en `ACENTO_POR_TIPO` agregar `comentario_ticket: AZUL,` y `cambios_solicitados: AMBAR,`; en `ETIQUETA_POR_TIPO` agregar `comentario_ticket: "Nuevo comentario",` y `cambios_solicitados: "Cambios solicitados",`; en `CAMPOS_POR_TIPO` agregar:

```ts
  // El jefe de zona tambien recibe comentario_ticket: mismos datos minimos que pre_cierre.
  comentario_ticket: ["sitio", "solicitante"],
  cambios_solicitados: ["estatus", "sitio", "abogado"],
```

`src/domain/notificaciones/preferencias-rules.ts` (líneas 7-30):

```ts
const SOLICITANTE: TipoNotificacion[] = [
  "creacion_solicitante", "asignacion_solicitante", "reasignacion_solicitante", "cambio_estatus",
  "comentario_ticket", "cambios_solicitados",
];

// Avisos de la conversacion de Pre-Cierre: el abogado asignado se identifica por abogadoId (puede tener
// rol abogado, mesa_control o gerente_juridico), por eso esos roles ofrecen ambos tipos.
const CORREOS_POR_ROL: Record<Role, TipoNotificacion[]> = {
  admin: ["nuevo_ticket", "cambio_estatus", "cierre", "comentario_ticket"],
  gerente_juridico: ["nuevo_ticket", "cambio_estatus", "cierre", "comentario_ticket", "cambios_solicitados"],
  abogado: ["asignacion", "reasignacion", "comentario_ticket", "cambios_solicitados"],
  mesa_control: ["asignacion", "reasignacion", "comentario_ticket", "cambios_solicitados"],
  solicitante: SOLICITANTE,
  // Como solicitante + el cierre de los tickets que supervisa.
  gerente_area: [...SOLICITANTE, "cierre"],
  jefe_zona: ["pre_cierre", "comentario_ticket"],
  // Rol Sitios: solo el aviso de Pre-Cierre; no participa en la conversacion (conservar la entrada que agrego su implementacion).
  sitios: ["pre_cierre"],
};
```

y en `ETIQUETA_CORREO` agregar:

```ts
  comentario_ticket: "Comentario en la conversacion de un ticket",
  cambios_solicitados: "Cambios solicitados por el jefe de zona",
```

`src/lib/notificaciones-email.ts`, en `TIPO_LABEL` agregar:

```ts
  comentario_ticket: "Nuevo comentario",
  cambios_solicitados: "Cambios solicitados",
```

Crear `src/domain/notificaciones/conversacion-avisos.ts`:

```ts
import type { TipoNotificacion } from "./notificacion";

export type TipoAvisoConversacion = Extract<TipoNotificacion, "comentario_ticket" | "cambios_solicitados">;

// Solo los dispara el servidor (sus destinatarios dependen del autor y del ticket);
// /api/notificaciones/email los rechaza.
export const TIPOS_AVISO_CONVERSACION: readonly TipoAvisoConversacion[] = ["comentario_ticket", "cambios_solicitados"];

export function esTipoSoloServidor(tipo: unknown): boolean {
  return typeof tipo === "string" && (TIPOS_AVISO_CONVERSACION as readonly string[]).includes(tipo);
}
```

Crear `src/domain/notificaciones/ruta-notificacion.ts`:

```ts
import { esJefeZona, type Role } from "@/types/user";

// El jefe de zona no abre /tickets (no lee esa coleccion): sus avisos llevan a /pre-cierre.
export function rutaNotificacion(role: Role | null | undefined, ticketId: string): string {
  return esJefeZona(role) ? `/pre-cierre/${ticketId}` : `/tickets/${ticketId}`;
}
```

`src/app/api/notificaciones/email/route.ts`: agregar `import { esTipoSoloServidor } from "@/domain/notificaciones/conversacion-avisos";` y, inmediatamente después de `const tipo = body.tipo as TipoNotificacion;`:

```ts
    if (esTipoSoloServidor(tipo)) {
      return NextResponse.json({ error: "Tipo de aviso no permitido." }, { status: 400 });
    }
```

`src/components/layout/notification-bell.tsx`:
- Línea 5: agregar `MessageSquare, RotateCcw` al import de `lucide-react`.
- Agregar `import { rutaNotificacion } from "@/domain/notificaciones/ruta-notificacion";`.
- `TIPO_LABEL`: agregar `comentario_ticket: "Comentario",` y `cambios_solicitados: "Cambios solicitados",`.
- `TIPO_ICON`: agregar `comentario_ticket: MessageSquare,` y `cambios_solicitados: RotateCcw,`.
- `TIPO_TONE`: agregar

```ts
  comentario_ticket: "text-blue-600 bg-blue-50 border-blue-100 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/20",
  cambios_solicitados: "text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20",
```

- Después de `const uid = useAuthStore((s) => s.uid);` (línea 51): `const role = useAuthStore((s) => s.role);`
- En `handleClickNotif` (línea 72): `router.push(`/tickets/${n.ticketId}`);` → `router.push(rutaNotificacion(role, n.ticketId));`

- [ ] **Step 4: Verificar que pasan** — `pnpm test src/domain/notificaciones`. Esperado: PASS.

- [ ] **Step 5: Verificación completa** — `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (código 0). `tsc` confirma que no quedó ningún `Record<TipoNotificacion, …>` incompleto.

- [ ] **Step 6: Verificación manual (NO EJECUTADA)** — en Configuración > Usuarios, editar un abogado, un solicitante y un jefe de zona: aparecen los interruptores nuevos con sus etiquetas; guardar uno apagado persiste en `users/{uid}.correosDesactivados`.

- [ ] **Step 7: Commit**:

```bash
git add src/domain/notificaciones src/lib/notificaciones-email.ts src/components/layout/notification-bell.tsx src/app/api/notificaciones/email/route.ts
git commit -m "feat: tipos de aviso para la conversacion de Pre-Cierre"
```

---

### Task 5: Avisos de la conversación desde el servidor

**Files:**
- Modify: `src/domain/notificaciones/conversacion-avisos.ts` (agregar)
- Test: `src/domain/notificaciones/conversacion-avisos.test.ts` (agregar)
- Modify: `src/lib/notificaciones-email.ts` (agregar `enviarNotificacionEmailA` al final)
- Create: `src/lib/avisos-conversacion.ts`
- Create: `src/app/api/tickets/[id]/comentarios/avisar/route.ts`

**Interfaces:**
- Consumes: `filtrarDestinatarios` (`preferencias-rules.ts:51`), `NuevoComentario` (Task 1), `APP_URL`, `EnviarNotificacionEmailInput` y los privados `cargarDatosTicket`, `buildHtml`, `enviarAlerta`, `DESTINATARIOS_PRUEBA` de `src/lib/notificaciones-email.ts`; `verifyCallerToken`, `ApiAuthError` (`src/lib/api-auth.ts`); `getAdminDb` (`src/lib/firebase-admin.ts`).
- Produces:
  - `interface UsuarioAviso { uid: string; role: Role; activo?: boolean; email?: string; abogadoId?: string; correosDesactivados?: TipoNotificacion[] }`; `type EnlaceAviso = "tickets" | "pre-cierre"`; `interface DestinatarioAviso { usuario: UsuarioAviso; enlace: EnlaceAviso }`.
  - `destinatariosAviso(tipo: TipoAvisoConversacion, ticket: Pick<Ticket, "solicitanteId" | "abogadoAsignadoId" | "estatus">, usuarios: UsuarioAviso[], autorUid: string): DestinatarioAviso[]`.
  - `correosPorEnlace(destinatarios: DestinatarioAviso[], tipo: TipoAvisoConversacion): Record<EnlaceAviso, string[]>` (aplica preferencias).
  - `mensajeAviso(tipo: TipoAvisoConversacion, folio: string, autorNombre: string): string` (sin el texto del comentario).
  - `type DecisionAvisoComentario = "avisar" | "ya_avisado" | "prohibido"`; `decidirAvisoComentario(comentario: Pick<NuevoComentario, "autorUid" | "tipo" | "eliminado" | "avisoEnviado"> | null, uid: string): DecisionAvisoComentario`.
  - `enviarNotificacionEmailA(input: EnviarNotificacionEmailInput, emails: string[], verTicketUrl: string): Promise<number>`.
  - `interface AvisoConversacionInput { tipo: TipoAvisoConversacion; ticketId: string; autorUid: string; autorNombre: string }`; `avisarConversacion(input: AvisoConversacionInput): Promise<void>` (servidor: campana por Admin SDK en un lote + correos por enlace).
  - Ruta `POST /api/tickets/{id}/comentarios/avisar` con cuerpo `{ comentarioId: string }` → `200 { ok: true }`, `400`, `401`, `403`, `500` (mensajes genéricos).

Por qué en el servidor: `crearNotificacion` necesita el `uid` de cada destinatario, pero un solicitante o un jefe de zona no pueden consultar `users` (reglas `users`: solo propio, Legal o admin) y el jefe de zona tampoco lee `tickets` (no conoce dueño ni abogado). El cliente solo informa "creé el comentario X"; el servidor verifica que el que llama es su autor.

- [ ] **Step 1: Escribir la prueba que falla** — en `src/domain/notificaciones/conversacion-avisos.test.ts` cambiar el import por:

```ts
import {
  correosPorEnlace,
  decidirAvisoComentario,
  destinatariosAviso,
  esTipoSoloServidor,
  mensajeAviso,
  type DestinatarioAviso,
  type UsuarioAviso,
} from "./conversacion-avisos";
```

y agregar al final:

```ts
const usuarios: UsuarioAviso[] = [
  { uid: "sol", role: "solicitante", email: "sol@x.com" }, // sin "activo": el dueno cuenta como activo
  { uid: "abo", role: "abogado", activo: true, email: "abo@x.com", abogadoId: "AB1" },
  { uid: "abo2", role: "abogado", activo: true, email: "abo2@x.com", abogadoId: "AB2" },
  { uid: "gj", role: "gerente_juridico", activo: true, email: "gj@x.com" },
  { uid: "adm", role: "admin", activo: true, email: "adm@x.com" },
  { uid: "adm-off", role: "admin", activo: false, email: "off@x.com" },
  { uid: "jz", role: "jefe_zona", activo: true, email: "jz@x.com" },
  { uid: "mc", role: "mesa_control", activo: true, email: "mc@x.com" },
  { uid: "sit", role: "sitios", activo: true, email: "sit@x.com" }, // Rol Sitios: nunca recibe avisos de la conversacion
];
const ticket = { solicitanteId: "sol", abogadoAsignadoId: "AB1", estatus: "Pre-Cierre" as const };
const uids = (d: DestinatarioAviso[]) => d.map((x) => x.usuario.uid);

describe("destinatariosAviso", () => {
  it("un comentario avisa a dueno, abogado asignado, GJ/admin activos y jefes de zona, menos al autor", () => {
    expect(uids(destinatariosAviso("comentario_ticket", ticket, usuarios, "gj"))).toEqual(["sol", "abo", "adm", "jz"]);
  });

  it("los jefes de zona reciben el enlace a /pre-cierre; los demas a /tickets", () => {
    const d = destinatariosAviso("comentario_ticket", ticket, usuarios, "gj");
    expect(d.find((x) => x.usuario.uid === "jz")?.enlace).toBe("pre-cierre");
    expect(d.filter((x) => x.usuario.uid !== "jz").every((x) => x.enlace === "tickets")).toBe(true);
  });

  it("si el ticket regreso a una etapa anterior, los jefes de zona se siguen avisando (conservan el acceso)", () => {
    const d = destinatariosAviso("comentario_ticket", { ...ticket, estatus: "Proceso en tramite" }, usuarios, "sol");
    expect(uids(d)).toEqual(["abo", "gj", "adm", "jz"]);
    expect(d.find((x) => x.usuario.uid === "jz")?.enlace).toBe("pre-cierre");
  });

  it("cambios solicitados solo avisa al abogado asignado y al solicitante", () => {
    expect(uids(destinatariosAviso("cambios_solicitados", ticket, usuarios, "jz"))).toEqual(["sol", "abo"]);
  });

  it("sin abogado asignado no se avisa a ningun abogado y no se repiten usuarios", () => {
    const d = destinatariosAviso("comentario_ticket", { ...ticket, abogadoAsignadoId: null }, [...usuarios, usuarios[3]], "jz");
    expect(uids(d)).toEqual(["sol", "gj", "adm"]);
  });
});

describe("correosPorEnlace", () => {
  it("separa por enlace y respeta los correos apagados", () => {
    const conPreferencia = usuarios.map((u) => (u.uid === "adm" ? { ...u, correosDesactivados: ["comentario_ticket" as const] } : u));
    const d = destinatariosAviso("comentario_ticket", ticket, conPreferencia, "gj");
    expect(correosPorEnlace(d, "comentario_ticket")).toEqual({ tickets: ["sol@x.com", "abo@x.com"], "pre-cierre": ["jz@x.com"] });
  });
});

describe("mensajeAviso", () => {
  it("lleva folio y autor, nunca el texto", () => {
    expect(mensajeAviso("comentario_ticket", "JUR-0042", "Ana")).toBe("Ana comento en el ticket JUR-0042.");
    expect(mensajeAviso("cambios_solicitados", "JUR-0042", "Jefe Uno")).toBe(
      "Jefe Uno pidio cambios en el ticket JUR-0042. Regreso a Proceso en tramite."
    );
  });
});

describe("decidirAvisoComentario", () => {
  const base = { autorUid: "u1", tipo: "comentario" as const, eliminado: false };

  it("solo el autor de un comentario normal dispara el aviso, una sola vez", () => {
    expect(decidirAvisoComentario(base, "u1")).toBe("avisar");
    expect(decidirAvisoComentario({ ...base, avisoEnviado: true }, "u1")).toBe("ya_avisado");
    expect(decidirAvisoComentario({ ...base, eliminado: true }, "u1")).toBe("ya_avisado");
  });

  it("otro usuario, un comentario inexistente o uno de cambios solicitados: prohibido", () => {
    expect(decidirAvisoComentario(base, "u2")).toBe("prohibido");
    expect(decidirAvisoComentario(null, "u1")).toBe("prohibido");
    expect(decidirAvisoComentario({ ...base, tipo: "cambios_solicitados" }, "u1")).toBe("prohibido");
  });
});
```

(`esTipoSoloServidor` sigue probado por el `describe` del Task 4.)

- [ ] **Step 2: Verificar que falla** — `pnpm test src/domain/notificaciones/conversacion-avisos.test.ts`. Esperado: FAIL.

- [ ] **Step 3: Implementar las funciones puras** — reemplazar `src/domain/notificaciones/conversacion-avisos.ts` completo por:

```ts
import type { Role } from "@/types/user";
import type { Ticket } from "@/types/ticket";
import type { NuevoComentario } from "@/types/comentario";
import type { TipoNotificacion } from "./notificacion";
import { filtrarDestinatarios } from "./preferencias-rules";

export type TipoAvisoConversacion = Extract<TipoNotificacion, "comentario_ticket" | "cambios_solicitados">;

// Solo los dispara el servidor (sus destinatarios dependen del autor y del ticket);
// /api/notificaciones/email los rechaza.
export const TIPOS_AVISO_CONVERSACION: readonly TipoAvisoConversacion[] = ["comentario_ticket", "cambios_solicitados"];

export function esTipoSoloServidor(tipo: unknown): boolean {
  return typeof tipo === "string" && (TIPOS_AVISO_CONVERSACION as readonly string[]).includes(tipo);
}

export interface UsuarioAviso {
  uid: string;
  role: Role;
  activo?: boolean;
  email?: string;
  abogadoId?: string;
  correosDesactivados?: TipoNotificacion[];
}

export type EnlaceAviso = "tickets" | "pre-cierre";

export interface DestinatarioAviso {
  usuario: UsuarioAviso;
  enlace: EnlaceAviso;
}

// Comentario: dueno, abogado asignado, gerente juridico y admin activos, y jefes de zona activos, menos
// el autor. Solo hay comentarios en tickets que ya entraron a Pre-Cierre, y en esos el jefe de zona conserva
// el acceso en cualquier etapa (decision del usuario), asi que /pre-cierre/{id} siempre abre.
// Cambios solicitados: abogado asignado y dueno.
export function destinatariosAviso(
  tipo: TipoAvisoConversacion,
  ticket: Pick<Ticket, "solicitanteId" | "abogadoAsignadoId" | "estatus">,
  usuarios: UsuarioAviso[],
  autorUid: string
): DestinatarioAviso[] {
  const porUid = new Map<string, DestinatarioAviso>();
  const agregar = (usuario: UsuarioAviso, enlace: EnlaceAviso) => {
    if (usuario.uid === autorUid || porUid.has(usuario.uid)) return;
    porUid.set(usuario.uid, { usuario, enlace });
  };

  // El solicitante se trata como activo, igual que solicitanteDestino en notificaciones-email.ts.
  const dueno = usuarios.find((u) => u.uid === ticket.solicitanteId);
  if (dueno) agregar({ ...dueno, activo: true }, "tickets");

  const abogado = ticket.abogadoAsignadoId
    ? usuarios.find((u) => u.activo && u.abogadoId === ticket.abogadoAsignadoId)
    : undefined;
  if (abogado) agregar(abogado, "tickets");

  if (tipo === "comentario_ticket") {
    for (const u of usuarios) {
      if (u.activo && (u.role === "gerente_juridico" || u.role === "admin")) agregar(u, "tickets");
    }
    for (const u of usuarios) {
      if (u.activo && u.role === "jefe_zona") agregar(u, "pre-cierre");
    }
  }

  return Array.from(porUid.values());
}

// La campana llega a todos los destinatarios; el correo, solo a quien no lo apago.
export function correosPorEnlace(destinatarios: DestinatarioAviso[], tipo: TipoAvisoConversacion): Record<EnlaceAviso, string[]> {
  const de = (enlace: EnlaceAviso) =>
    filtrarDestinatarios(destinatarios.filter((d) => d.enlace === enlace).map((d) => d.usuario), tipo).emails;
  return { tickets: de("tickets"), "pre-cierre": de("pre-cierre") };
}

// Nunca incluye el texto del comentario.
export function mensajeAviso(tipo: TipoAvisoConversacion, folio: string, autorNombre: string): string {
  return tipo === "cambios_solicitados"
    ? `${autorNombre} pidio cambios en el ticket ${folio}. Regreso a Proceso en tramite.`
    : `${autorNombre} comento en el ticket ${folio}.`;
}

export type DecisionAvisoComentario = "avisar" | "ya_avisado" | "prohibido";

export function decidirAvisoComentario(
  comentario: Pick<NuevoComentario, "autorUid" | "tipo" | "eliminado" | "avisoEnviado"> | null,
  uid: string
): DecisionAvisoComentario {
  if (!comentario || comentario.autorUid !== uid || comentario.tipo !== "comentario") return "prohibido";
  if (comentario.avisoEnviado || comentario.eliminado) return "ya_avisado";
  return "avisar";
}
```

- [ ] **Step 4: Verificar que pasa** — `pnpm test src/domain/notificaciones/conversacion-avisos.test.ts`. Esperado: PASS.

- [ ] **Step 5: Envío en el servidor** — agregar al final de `src/lib/notificaciones-email.ts`:

```ts
// Avisos de la conversacion (ver lib/avisos-conversacion.ts): destinatarios ya resueltos y enlace segun
// el rol. Respeta la escotilla NOTIFICACIONES_DESTINATARIOS_PRUEBA.
export async function enviarNotificacionEmailA(
  input: EnviarNotificacionEmailInput,
  emails: string[],
  verTicketUrl: string
): Promise<number> {
  const destino = DESTINATARIOS_PRUEBA.length ? DESTINATARIOS_PRUEBA : emails;
  if (destino.length === 0) return 0;
  try {
    const datosTicket = await cargarDatosTicket(input.ticketId);
    await enviarEmail({
      to: destino.join(", "),
      subject: `${TIPO_LABEL[input.tipo] ?? input.tipo} — ${input.ticketFolio}`,
      html: buildHtml(input, datosTicket, verTicketUrl, null),
    });
    return destino.length;
  } catch (err) {
    await enviarAlerta(
      `Fallo al enviar correo de "${TIPO_LABEL[input.tipo] ?? input.tipo}"`,
      `Ticket ${input.ticketFolio} (${input.ticketId}). Error: ${err instanceof Error ? err.message : String(err)}`
    );
    throw err;
  }
}
```

Crear `src/lib/avisos-conversacion.ts`:

```ts
import { getAdminDb } from "./firebase-admin";
import { APP_URL, enviarNotificacionEmailA } from "./notificaciones-email";
import {
  correosPorEnlace,
  destinatariosAviso,
  mensajeAviso,
  type EnlaceAviso,
  type TipoAvisoConversacion,
  type UsuarioAviso,
} from "@/domain/notificaciones/conversacion-avisos";
import type { Ticket } from "@/types/ticket";

// Solo servidor (Admin SDK).
export interface AvisoConversacionInput {
  tipo: TipoAvisoConversacion;
  ticketId: string;
  autorUid: string;
  autorNombre: string;
}

type DocUsuario = Omit<UsuarioAviso, "uid">;

async function cargarUsuarios(ticket: Ticket): Promise<UsuarioAviso[]> {
  const users = getAdminDb().collection("users");
  const [porRol, dueno, abogado] = await Promise.all([
    users.where("role", "in", ["gerente_juridico", "admin", "jefe_zona"]).get(),
    users.doc(ticket.solicitanteId).get(),
    ticket.abogadoAsignadoId ? users.where("abogadoId", "==", ticket.abogadoAsignadoId).get() : Promise.resolve(null),
  ]);
  const lista: UsuarioAviso[] = porRol.docs.map((d) => ({ ...(d.data() as DocUsuario), uid: d.id }));
  if (dueno.exists) lista.push({ ...(dueno.data() as DocUsuario), uid: dueno.id });
  for (const d of abogado?.docs ?? []) lista.push({ ...(d.data() as DocUsuario), uid: d.id });
  return lista;
}

// Campana (un lote de notificaciones dirigidas por uid) + correo por enlace. Sin el texto del comentario.
export async function avisarConversacion(input: AvisoConversacionInput): Promise<void> {
  const db = getAdminDb();
  const snap = await db.collection("tickets").doc(input.ticketId).get();
  if (!snap.exists) return;
  const ticket = { ...snap.data(), id: snap.id } as Ticket;

  const destinatarios = destinatariosAviso(input.tipo, ticket, await cargarUsuarios(ticket), input.autorUid);
  if (destinatarios.length === 0) return;

  const mensaje = mensajeAviso(input.tipo, ticket.folio, input.autorNombre);
  const fecha = new Date().toISOString();
  const lote = db.batch();
  for (const { usuario } of destinatarios) {
    lote.set(db.collection("notificaciones").doc(), {
      ticketId: ticket.id,
      ticketFolio: ticket.folio,
      tipo: input.tipo,
      mensaje,
      fecha,
      paraUid: usuario.uid,
      paraRoles: null,
      leidoPor: [],
    });
  }
  await lote.commit();

  const correos = correosPorEnlace(destinatarios, input.tipo);
  const enlaces: Record<EnlaceAviso, string> = {
    tickets: `${APP_URL}/tickets/${ticket.id}`,
    "pre-cierre": `${APP_URL}/pre-cierre/${ticket.id}`,
  };
  for (const enlace of ["tickets", "pre-cierre"] as const) {
    if (correos[enlace].length === 0) continue;
    await enviarNotificacionEmailA(
      { tipo: input.tipo, mensaje, ticketId: ticket.id, ticketFolio: ticket.folio },
      correos[enlace],
      enlaces[enlace]
    );
  }
}
```

Crear `src/app/api/tickets/[id]/comentarios/avisar/route.ts`:

```ts
import { NextResponse } from "next/server";
import { verifyCallerToken, ApiAuthError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { avisarConversacion } from "@/lib/avisos-conversacion";
import { decidirAvisoComentario } from "@/domain/notificaciones/conversacion-avisos";
import type { NuevoComentario } from "@/types/comentario";

export const runtime = "nodejs";

interface Params {
  params: { id: string };
}

// El cliente avisa "cree el comentario X"; aqui se valida que quien llama es su autor y que no se aviso antes.
export async function POST(request: Request, { params }: Params) {
  try {
    const uid = await verifyCallerToken(request);
    const body = await request.json().catch(() => null);
    const comentarioId = typeof body?.comentarioId === "string" ? body.comentarioId : "";
    if (!comentarioId) return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 });

    const db = getAdminDb();
    const ref = db.collection("tickets").doc(params.id).collection("comentarios").doc(comentarioId);
    // Transaccion: dos llamadas simultaneas no mandan el aviso dos veces.
    const { decision, autorNombre } = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const comentario = snap.exists ? (snap.data() as NuevoComentario) : null;
      const d = decidirAvisoComentario(comentario, uid);
      if (d === "avisar") tx.update(ref, { avisoEnviado: true });
      return { decision: d, autorNombre: comentario?.autorNombre ?? "" };
    });

    if (decision === "prohibido") {
      return NextResponse.json({ error: "No puedes avisar sobre este comentario." }, { status: 403 });
    }
    if (decision === "avisar") {
      try {
        await avisarConversacion({ tipo: "comentario_ticket", ticketId: params.id, autorUid: uid, autorNombre });
      } catch (err) {
        // Sin el texto del comentario ni datos del ticket.
        console.error("Aviso de comentario fallo:", err instanceof Error ? err.message : "error desconocido");
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("POST /api/tickets/[id]/comentarios/avisar fallo.");
    return NextResponse.json({ error: "No se pudo enviar el aviso." }, { status: 500 });
  }
}
```

- [ ] **Step 6: Verificación completa** — `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (código 0).

- [ ] **Step 7: Verificación manual (NO EJECUTADA; se completa tras el Task 6)** — con `NOTIFICACIONES_DESTINATARIOS_PRUEBA` apuntando a un correo propio: (1) un solicitante comenta en su ticket en Pre-Cierre → llegan dos correos (enlace `/tickets/{id}` y `/pre-cierre/{id}`), ninguno con el texto; en Firestore hay una `notificaciones` por destinatario con `paraUid` y el comentario queda con `avisoEnviado: true`; (2) repetir el `POST` a mano con el mismo `comentarioId` (consola del navegador, token del autor) → `200` sin notificaciones nuevas; (3) con el token de otro usuario → `403`; (4) la terminal del servidor no muestra el texto del comentario. Anotar resultados.

- [ ] **Step 8: Commit**:

```bash
git add src/domain/notificaciones/conversacion-avisos.ts src/domain/notificaciones/conversacion-avisos.test.ts src/lib/notificaciones-email.ts src/lib/avisos-conversacion.ts "src/app/api/tickets/[id]/comentarios/avisar/route.ts"
git commit -m "feat: avisos de la conversacion calculados en el servidor"
```

---

### Task 6: Comentarios: repositorio, servicio, fachada y hook

**Files:**
- Create: `src/domain/tickets/comentario-repository.ts`
- Create: `src/infrastructure/firestore/comentario-repository.ts`
- Create: `src/domain/tickets/conversacion-service.ts`
- Test: `src/domain/tickets/conversacion-service.test.ts`
- Create: `src/lib/conversacion.ts`, `src/hooks/use-comentarios.ts`

**Interfaces:**
- Consumes: `validarTextoComentario`, `puedeEditarComentario` (Task 1); `entradaComentarioEditado`, `entradaComentarioEliminado` (Plan C Task 2); `nuevaEntradaHistorialRef` (Plan C Task 4/6); `RepositoryError`, `Unsubscribe` (`ticket-repository.ts`); ruta `/api/tickets/{id}/comentarios/avisar` (Task 5).
- Produces:
  - `type CambioComentario = Partial<Pick<Comentario, "texto" | "editadoEn" | "eliminado">>`.
  - `interface ComentarioRepository { crear(ticketId: string, comentario: NuevoComentario): Promise<string>; actualizarConHistorial(ticketId: string, comentarioId: string, cambio: CambioComentario, entrada: EntradaHistorial): Promise<void>; subscribe(ticketId: string, callback: (comentarios: Comentario[]) => void, onError?: (e: RepositoryError) => void): Unsubscribe }`.
  - `interface AvisosConversacion { comentarioCreado(ticketId: string, comentarioId: string): Promise<void> }`.
  - `class ComentarioInvalidoError extends Error`.
  - `createConversacionService(repo: ComentarioRepository, avisos: AvisosConversacion, ahora?: () => Date)` → `{ comentar(ticketId: string, autor: ActorHistorial, texto: string): Promise<void>; editar(ticketId: string, actor: ActorHistorial, comentario: Comentario, texto: string): Promise<void>; eliminar(ticketId: string, actor: ActorHistorial, comentario: Comentario): Promise<void>; subscribeComentarios: ComentarioRepository["subscribe"] }`.
  - `src/lib/conversacion.ts`: `comentar`, `editarComentario`, `eliminarComentario`, `subscribeComentarios`.
  - `useComentarios(ticketId: string): { comentarios: Comentario[]; loading: boolean; error: boolean }`.

- [ ] **Step 1: Escribir la prueba que falla** — crear `src/domain/tickets/conversacion-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ComentarioInvalidoError, createConversacionService } from "./conversacion-service";
import type { AvisosConversacion, CambioComentario, ComentarioRepository } from "./comentario-repository";
import type { Comentario, NuevoComentario } from "@/types/comentario";
import type { ActorHistorial, EntradaHistorial } from "@/types/historial";

const AHORA = new Date("2026-10-09T15:00:00.000Z");
const autor: ActorHistorial = { uid: "u1", nombre: "Sol", rol: "solicitante" };

interface Lote {
  comentarioId: string;
  cambio: CambioComentario;
  entrada: EntradaHistorial;
}

function montar(opts: { avisoRoto?: boolean } = {}) {
  const creados: NuevoComentario[] = [];
  const lotes: Lote[] = [];
  const avisos: string[] = [];
  const repo: Pick<ComentarioRepository, "crear" | "actualizarConHistorial"> = {
    crear: async (_ticketId, comentario) => {
      creados.push(comentario);
      return `c${creados.length}`;
    },
    actualizarConHistorial: async (_ticketId, comentarioId, cambio, entrada) => {
      lotes.push({ comentarioId, cambio, entrada });
    },
  };
  const notificador: AvisosConversacion = {
    comentarioCreado: async (_ticketId, comentarioId) => {
      if (opts.avisoRoto) throw new Error("red");
      avisos.push(comentarioId);
    },
  };
  const service = createConversacionService(repo as unknown as ComentarioRepository, notificador, () => AHORA);
  return { service, creados, lotes, avisos };
}

const comentario = (over: Partial<Comentario> = {}): Comentario => ({
  id: "c1", autorUid: "u1", autorNombre: "Sol", autorRol: "solicitante", texto: "texto original",
  tipo: "comentario", creadoEn: "2026-10-09T10:00:00.000Z", eliminado: false, ...over,
});

describe("comentar", () => {
  it("guarda el texto recortado como comentario vivo y avisa con su id", async () => {
    const { service, creados, avisos } = montar();
    await service.comentar("t1", autor, "  Falta el anexo  ");
    expect(creados).toEqual([{
      autorUid: "u1", autorNombre: "Sol", autorRol: "solicitante", texto: "Falta el anexo",
      tipo: "comentario", creadoEn: AHORA.toISOString(), eliminado: false,
    }]);
    expect(avisos).toEqual(["c1"]);
  });

  it("rechaza texto vacio o de mas de 4000 caracteres sin guardar", async () => {
    const { service, creados } = montar();
    await expect(service.comentar("t1", autor, "   ")).rejects.toBeInstanceOf(ComentarioInvalidoError);
    await expect(service.comentar("t1", autor, "a".repeat(4001))).rejects.toBeInstanceOf(ComentarioInvalidoError);
    expect(creados).toEqual([]);
  });

  it("si el aviso falla, el comentario ya guardado se conserva", async () => {
    const { service, creados } = montar({ avisoRoto: true });
    await expect(service.comentar("t1", autor, "hola")).resolves.toBeUndefined();
    expect(creados).toHaveLength(1);
  });
});

describe("editar y eliminar", () => {
  it("editar escribe comentario y entrada de historial con el texto anterior en un solo lote", async () => {
    const { service, lotes } = montar();
    await service.editar("t1", autor, comentario(), "texto nuevo");
    expect(lotes).toHaveLength(1);
    expect(lotes[0].comentarioId).toBe("c1");
    expect(lotes[0].cambio).toEqual({ texto: "texto nuevo", editadoEn: AHORA.toISOString() });
    expect(lotes[0].entrada).toMatchObject({
      tipo: "comentario_editado", comentarioId: "c1", actorUid: "u1",
      cambios: [{ campo: "texto", etiqueta: "Comentario", antes: "texto original", despues: "texto nuevo" }],
    });
  });

  it("editar sin cambios no escribe nada", async () => {
    const { service, lotes } = montar();
    await service.editar("t1", autor, comentario(), "  texto original ");
    expect(lotes).toEqual([]);
  });

  it("eliminar es logico: texto null, eliminado true, y el historial guarda el texto anterior", async () => {
    const { service, lotes } = montar();
    await service.eliminar("t1", autor, comentario());
    expect(lotes[0].cambio).toEqual({ texto: null, eliminado: true });
    expect(lotes[0].entrada).toMatchObject({
      tipo: "comentario_eliminado", comentarioId: "c1",
      cambios: [{ campo: "texto", etiqueta: "Comentario", antes: "texto original", despues: null }],
    });
  });

  it("nadie edita ni borra comentarios ajenos, eliminados o de cambios solicitados", async () => {
    const { service, lotes } = montar();
    await expect(service.editar("t1", autor, comentario({ autorUid: "otro" }), "x")).rejects.toBeInstanceOf(ComentarioInvalidoError);
    await expect(service.eliminar("t1", autor, comentario({ eliminado: true, texto: null }))).rejects.toBeInstanceOf(ComentarioInvalidoError);
    await expect(service.editar("t1", autor, comentario({ tipo: "cambios_solicitados" }), "x")).rejects.toBeInstanceOf(ComentarioInvalidoError);
    expect(lotes).toEqual([]);
  });
});
```

- [ ] **Step 2: Verificar que falla** — `pnpm test src/domain/tickets/conversacion-service.test.ts`. Esperado: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar el puerto y el servicio**

Crear `src/domain/tickets/comentario-repository.ts`:

```ts
import type { Comentario, NuevoComentario } from "@/types/comentario";
import type { EntradaHistorial } from "@/types/historial";
import type { RepositoryError, Unsubscribe } from "./ticket-repository";

export type CambioComentario = Partial<Pick<Comentario, "texto" | "editadoEn" | "eliminado">>;

export interface ComentarioRepository {
  // Devuelve el id del comentario creado.
  crear(ticketId: string, comentario: NuevoComentario): Promise<string>;
  // Comentario y su entrada de historial en un solo lote (las reglas exigen ambos juntos).
  actualizarConHistorial(ticketId: string, comentarioId: string, cambio: CambioComentario, entrada: EntradaHistorial): Promise<void>;
  // Orden cronologico ascendente (un solo orderBy: no requiere indice compuesto).
  subscribe(ticketId: string, callback: (comentarios: Comentario[]) => void, onError?: (e: RepositoryError) => void): Unsubscribe;
}

// Best-effort: el servidor calcula destinatarios y evita avisos repetidos.
export interface AvisosConversacion {
  comentarioCreado(ticketId: string, comentarioId: string): Promise<void>;
}
```

Crear `src/domain/tickets/conversacion-service.ts`:

```ts
import type { Comentario } from "@/types/comentario";
import type { ActorHistorial } from "@/types/historial";
import type { AvisosConversacion, ComentarioRepository } from "./comentario-repository";
import { puedeEditarComentario, validarTextoComentario } from "./conversacion-rules";
import { entradaComentarioEditado, entradaComentarioEliminado } from "./historial-rules";

export class ComentarioInvalidoError extends Error {}

// Si el hilo esta habilitado lo deciden las reglas de Firestore (el jefe de zona no lee el ticket).
export function createConversacionService(
  repo: ComentarioRepository,
  avisos: AvisosConversacion,
  ahora: () => Date = () => new Date()
) {
  async function comentar(ticketId: string, autor: ActorHistorial, texto: string): Promise<void> {
    const validado = validarTextoComentario(texto);
    if (!validado.ok) throw new ComentarioInvalidoError(validado.error);

    const id = await repo.crear(ticketId, {
      autorUid: autor.uid,
      autorNombre: autor.nombre,
      autorRol: autor.rol,
      texto: validado.texto,
      tipo: "comentario",
      creadoEn: ahora().toISOString(),
      eliminado: false,
    });
    await avisos.comentarioCreado(ticketId, id).catch(() => {});
  }

  async function editar(ticketId: string, actor: ActorHistorial, comentario: Comentario, texto: string): Promise<void> {
    if (!puedeEditarComentario(actor.uid, comentario)) throw new ComentarioInvalidoError("Solo puedes editar tus comentarios.");
    const validado = validarTextoComentario(texto);
    if (!validado.ok) throw new ComentarioInvalidoError(validado.error);
    if (validado.texto === comentario.texto) return;

    const momento = ahora();
    await repo.actualizarConHistorial(
      ticketId,
      comentario.id,
      { texto: validado.texto, editadoEn: momento.toISOString() },
      entradaComentarioEditado(actor, momento, comentario.id, comentario.texto, validado.texto)
    );
  }

  async function eliminar(ticketId: string, actor: ActorHistorial, comentario: Comentario): Promise<void> {
    if (!puedeEditarComentario(actor.uid, comentario)) throw new ComentarioInvalidoError("Solo puedes eliminar tus comentarios.");

    const momento = ahora();
    await repo.actualizarConHistorial(
      ticketId,
      comentario.id,
      { texto: null, eliminado: true },
      entradaComentarioEliminado(actor, momento, comentario.id, comentario.texto)
    );
  }

  const subscribeComentarios: ComentarioRepository["subscribe"] = (ticketId, callback, onError) =>
    repo.subscribe(ticketId, callback, onError);

  return { comentar, editar, eliminar, subscribeComentarios };
}
```

- [ ] **Step 4: Verificar que pasa** — `pnpm test src/domain/tickets/conversacion-service.test.ts`. Esperado: PASS.

- [ ] **Step 5: Infraestructura, fachada y hook**

Crear `src/infrastructure/firestore/comentario-repository.ts`:

```ts
import { collection, doc, onSnapshot, orderBy, query, setDoc, writeBatch, type FirestoreError } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NuevoComentario } from "@/types/comentario";
import type { RepositoryError } from "@/domain/tickets/ticket-repository";
import type { ComentarioRepository } from "@/domain/tickets/comentario-repository";
import { nuevaEntradaHistorialRef } from "./historial-repository";

function toRepositoryError(err: FirestoreError): RepositoryError {
  return { code: err.code };
}

const comentariosDe = (ticketId: string) => collection(db, "tickets", ticketId, "comentarios");

export const firestoreComentarioRepository: ComentarioRepository = {
  async crear(ticketId, comentario) {
    const ref = doc(comentariosDe(ticketId));
    await setDoc(ref, comentario);
    return ref.id;
  },

  async actualizarConHistorial(ticketId, comentarioId, cambio, entrada) {
    const batch = writeBatch(db);
    batch.update(doc(comentariosDe(ticketId), comentarioId), cambio);
    batch.set(nuevaEntradaHistorialRef(ticketId), entrada);
    await batch.commit();
  },

  // Un solo orderBy sobre un campo: indice automatico.
  subscribe(ticketId, callback, onError) {
    return onSnapshot(
      query(comentariosDe(ticketId), orderBy("creadoEn", "asc")),
      (snap) => callback(snap.docs.map((d) => ({ ...(d.data() as NuevoComentario), id: d.id }))),
      onError ? (err) => onError(toRepositoryError(err)) : undefined
    );
  },
};
```

Crear `src/lib/conversacion.ts`:

```ts
import { auth } from "./firebase";
import { firestoreComentarioRepository } from "@/infrastructure/firestore/comentario-repository";
import { createConversacionService } from "@/domain/tickets/conversacion-service";

export type { Comentario } from "@/types/comentario";

async function postConToken(ruta: string, body: unknown): Promise<Response> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Tu sesion expiro, recarga la pagina.");
  return fetch(ruta, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Best-effort: el servidor calcula los destinatarios y evita avisos repetidos.
async function avisarComentarioCreado(ticketId: string, comentarioId: string): Promise<void> {
  await postConToken(`/api/tickets/${encodeURIComponent(ticketId)}/comentarios/avisar`, { comentarioId });
}

const conversacionService = createConversacionService(firestoreComentarioRepository, { comentarioCreado: avisarComentarioCreado });

export const comentar = conversacionService.comentar;
export const editarComentario = conversacionService.editar;
export const eliminarComentario = conversacionService.eliminar;
export const subscribeComentarios = conversacionService.subscribeComentarios;
```

Crear `src/hooks/use-comentarios.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { subscribeComentarios } from "@/lib/conversacion";
import type { Comentario } from "@/types/comentario";

export function useComentarios(ticketId: string) {
  const status = useAuthStore((s) => s.status);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status !== "signed-in") return;
    setLoading(true);
    setError(false);
    return subscribeComentarios(
      ticketId,
      (data) => {
        setComentarios(data);
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      }
    );
  }, [ticketId, status]);

  return { comentarios, loading, error };
}
```

- [ ] **Step 6: Verificación completa** — `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (código 0).

- [ ] **Step 7: Commit**:

```bash
git add src/domain/tickets/comentario-repository.ts src/infrastructure/firestore/comentario-repository.ts src/domain/tickets/conversacion-service.ts src/domain/tickets/conversacion-service.test.ts src/lib/conversacion.ts src/hooks/use-comentarios.ts
git commit -m "feat: comentarios del ticket con edicion y borrado registrados en el historial"
```

---

### Task 7: "Pedir cambios" (servicio de dominio y ruta del servidor)

**Files:**
- Create: `src/domain/tickets/pedir-cambios-service.ts`
- Test: `src/domain/tickets/pedir-cambios-service.test.ts`
- Create: `src/app/api/tickets/[id]/pedir-cambios/route.ts`
- Modify: `src/lib/conversacion.ts` (agregar `solicitarCambios`)

**Interfaces:**
- Consumes: `calcularPatchAsignacion` (con `conversacionAbiertaEn`, Task 1), `validarTextoComentario` (Task 1), `entradaCambiosSolicitados` (Plan C Task 2), `avisarConversacion` (Task 5), `sinUndefined` (`src/lib/storage-ruta.ts:25`), `verifyCallerToken`/`ApiAuthError`.
- Produces:
  - `ESTATUS_TRAS_PEDIR_CAMBIOS = "Proceso en tramite"`.
  - `class PedirCambiosError extends Error { status: 400 | 403 | 404 | 409 }`.
  - `interface OperacionPedirCambios { ticketId: string; patchTicket: Partial<Ticket>; patchResumen: Pick<ResumenContrato, "estatus" | "vistoBueno" | "actualizadoEn"> | null; comentarioId: string; comentario: NuevoComentario; entrada: EntradaHistorial }`.
  - `interface DepsPedirCambios { cargarUsuario(uid: string): Promise<{ nombre: string; role: Role; activo: boolean } | null>; cargarTicket(id: string): Promise<Ticket | null>; cargarResumen(id: string): Promise<ResumenContrato | null>; nuevoIdComentario(ticketId: string): string; guardar(op: OperacionPedirCambios): Promise<void>; avisar(info: { ticketId: string; autorUid: string; autorNombre: string }): Promise<void>; ahora(): Date }`.
  - `pedirCambios(deps: DepsPedirCambios, uid: string, ticketId: string, texto: unknown): Promise<OperacionPedirCambios>`.
  - Ruta `POST /api/tickets/{id}/pedir-cambios` con `{ texto: string }` → `200 { ok: true }` | `400/403/404/409 { error }` | `401` | `500 { error: "No se pudieron pedir los cambios." }`.
  - `solicitarCambios(ticketId: string, texto: string): Promise<void>` en `src/lib/conversacion.ts` (lanza `Error` con el mensaje del servidor o uno genérico).

Coherencia con `sincronizarResumen` (`ticket-service.ts:55-65`): al salir de Pre-Cierre hacia una etapa no visible la acción es `"actualizar-estatus"` (`estatus` + `actualizadoEn`); aquí se hace lo mismo y además `vistoBueno: null` (la semántica de `construirResumenContrato` cuando no hay visto bueno previo). El SLA se reanuda solo: `diasHabilesEnPausa` (`sla-pausa-rules.ts:14-43`) cierra la pausa con la fecha de la nueva entrada de `historialEstatus`.

- [ ] **Step 1: Escribir la prueba que falla** — crear `src/domain/tickets/pedir-cambios-service.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { pedirCambios, PedirCambiosError, type DepsPedirCambios, type OperacionPedirCambios } from "./pedir-cambios-service";
import { diasHabilesEnPausa } from "./sla-pausa-rules";
import { businessDaysBetween } from "@/lib/business-days";
import { buildTicket } from "@/test/ticket-fixture";
import type { Ticket } from "@/types/ticket";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { Role } from "@/types/user";

const AHORA = new Date("2026-10-07T15:00:00.000Z");
const INICIO_PAUSA = "2026-10-05T15:00:00.000Z";
const FECHA_ASIGNACION = "2026-10-01T15:00:00.000Z";
const VISTO = { uid: "j1", nombre: "Jefe Uno", fecha: INICIO_PAUSA };

function ticketEnPreCierre(over: Partial<Ticket> = {}): Ticket {
  return buildTicket({
    id: "t1", folio: "JUR-0042", estatus: "Pre-Cierre", abogadoAsignadoId: "AB1", fechaAsignacion: FECHA_ASIGNACION,
    historialEstatus: [{ estatus: "Pre-Cierre", fecha: INICIO_PAUSA, uid: "legal" }],
    ...over,
  });
}

interface Opciones {
  role?: Role;
  activo?: boolean;
  ticket?: Ticket | null;
  resumen?: ResumenContrato | null;
  avisoRoto?: boolean;
}

function montar(opts: Opciones = {}) {
  const guardados: OperacionPedirCambios[] = [];
  const avisos: string[] = [];
  const deps: DepsPedirCambios = {
    cargarUsuario: async () => ({ nombre: "Jefe Uno", role: opts.role ?? "jefe_zona", activo: opts.activo ?? true }),
    cargarTicket: async () => (opts.ticket === undefined ? ticketEnPreCierre() : opts.ticket),
    cargarResumen: async () =>
      opts.resumen === undefined ? ({ ticketId: "t1", estatus: "Pre-Cierre", vistoBueno: VISTO } as unknown as ResumenContrato) : opts.resumen,
    nuevoIdComentario: () => "c1",
    guardar: async (op) => { guardados.push(op); },
    avisar: async (info) => {
      if (opts.avisoRoto) throw new Error("smtp");
      avisos.push(info.ticketId);
    },
    ahora: () => AHORA,
  };
  return { deps, guardados, avisos };
}

async function estado(promesa: Promise<unknown>): Promise<number | null> {
  try {
    await promesa;
    return null;
  } catch (err) {
    return err instanceof PedirCambiosError ? err.status : -1;
  }
}

describe("pedirCambios: validaciones", () => {
  it("solo un jefe de zona activo", async () => {
    const abogado = montar({ role: "abogado" });
    expect(await estado(pedirCambios(abogado.deps, "u1", "t1", "Corrige"))).toBe(403);
    const inactivo = montar({ activo: false });
    expect(await estado(pedirCambios(inactivo.deps, "j1", "t1", "Corrige"))).toBe(403);
    expect(abogado.guardados).toEqual([]);
  });

  it("exige un texto valido", async () => {
    const { deps, guardados } = montar();
    expect(await estado(pedirCambios(deps, "j1", "t1", "   "))).toBe(400);
    expect(await estado(pedirCambios(deps, "j1", "t1", 42))).toBe(400);
    expect(await estado(pedirCambios(deps, "j1", "t1", "a".repeat(4001)))).toBe(400);
    expect(guardados).toEqual([]);
  });

  it("el ticket debe existir y estar en Pre-Cierre", async () => {
    expect(await estado(pedirCambios(montar({ ticket: null }).deps, "j1", "t1", "Corrige"))).toBe(404);
    const enCierre = montar({ ticket: ticketEnPreCierre({ estatus: "Cierre" }) });
    expect(await estado(pedirCambios(enCierre.deps, "j1", "t1", "Corrige"))).toBe(409);
    expect(enCierre.guardados).toEqual([]);
  });
});

describe("pedirCambios: resultado", () => {
  it("regresa a Proceso en tramite, borra el visto bueno, crea comentario y entrada en una sola operacion y avisa", async () => {
    const { deps, guardados, avisos } = montar();
    await pedirCambios(deps, "j1", "t1", "  Falta el anexo B  ");
    expect(guardados).toHaveLength(1);
    const op = guardados[0];
    const historial = op.patchTicket.historialEstatus ?? [];
    expect(op.patchTicket.estatus).toBe("Proceso en tramite");
    expect(historial[historial.length - 1]).toEqual({ estatus: "Proceso en tramite", fecha: AHORA.toISOString(), uid: "j1" });
    expect(op.patchResumen).toEqual({ estatus: "Proceso en tramite", vistoBueno: null, actualizadoEn: AHORA.toISOString() });
    expect(op.comentarioId).toBe("c1");
    expect(op.comentario).toEqual({
      autorUid: "j1", autorNombre: "Jefe Uno", autorRol: "jefe_zona", texto: "Falta el anexo B",
      tipo: "cambios_solicitados", creadoEn: AHORA.toISOString(), eliminado: false, avisoEnviado: true,
    });
    expect(op.entrada).toMatchObject({ tipo: "cambios_solicitados", comentarioId: "c1", actorUid: "j1", actorRol: "jefe_zona" });
    expect(op.entrada.cambios.map((c) => c.campo)).toEqual(["estatus", "vistoBueno"]);
    expect(avisos).toEqual(["t1"]);
  });

  it("el SLA del abogado se reanuda: la pausa termina en la fecha del regreso", async () => {
    const { deps, guardados } = montar();
    await pedirCambios(deps, "j1", "t1", "Corrige");
    const historialEstatus = guardados[0].patchTicket.historialEstatus ?? [];
    const pausa = diasHabilesEnPausa({ fechaAsignacion: FECHA_ASIGNACION, historialEstatus }, new Date("2026-10-30T15:00:00.000Z"));
    expect(pausa).toBe(businessDaysBetween(new Date(INICIO_PAUSA), AHORA));
  });

  it("abre la conversacion si el ticket no la tenia", async () => {
    const { deps, guardados } = montar();
    await pedirCambios(deps, "j1", "t1", "Corrige");
    expect(guardados[0].patchTicket.conversacionAbiertaEn).toBe(AHORA.toISOString());
  });

  it("sin resumen no toca resumenesContrato y la entrada solo registra el estatus", async () => {
    const { deps, guardados } = montar({ resumen: null });
    await pedirCambios(deps, "j1", "t1", "Corrige");
    expect(guardados[0].patchResumen).toBeNull();
    expect(guardados[0].entrada.cambios.map((c) => c.campo)).toEqual(["estatus"]);
  });

  it("si el aviso falla, el cambio ya guardado se conserva", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, guardados } = montar({ avisoRoto: true });
    await expect(pedirCambios(deps, "j1", "t1", "Corrige")).resolves.toBeDefined();
    expect(guardados).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Verificar que falla** — `pnpm test src/domain/tickets/pedir-cambios-service.test.ts`. Esperado: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar el servicio** — crear `src/domain/tickets/pedir-cambios-service.ts`:

```ts
import type { Ticket } from "@/types/ticket";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { Role } from "@/types/user";
import type { ActorHistorial, EntradaHistorial } from "@/types/historial";
import type { NuevoComentario } from "@/types/comentario";
import { calcularPatchAsignacion } from "./asignacion-rules";
import { validarTextoComentario } from "./conversacion-rules";
import { entradaCambiosSolicitados } from "./historial-rules";

export const ESTATUS_TRAS_PEDIR_CAMBIOS = "Proceso en tramite" as const;

export class PedirCambiosError extends Error {
  constructor(public status: 400 | 403 | 404 | 409, message: string) {
    super(message);
  }
}

export interface OperacionPedirCambios {
  ticketId: string;
  patchTicket: Partial<Ticket>;
  patchResumen: Pick<ResumenContrato, "estatus" | "vistoBueno" | "actualizadoEn"> | null;
  comentarioId: string;
  comentario: NuevoComentario;
  entrada: EntradaHistorial;
}

export interface DepsPedirCambios {
  cargarUsuario(uid: string): Promise<{ nombre: string; role: Role; activo: boolean } | null>;
  cargarTicket(id: string): Promise<Ticket | null>;
  cargarResumen(id: string): Promise<ResumenContrato | null>;
  nuevoIdComentario(ticketId: string): string;
  // Una sola operacion atomica (transaccion del Admin SDK en la ruta).
  guardar(op: OperacionPedirCambios): Promise<void>;
  avisar(info: { ticketId: string; autorUid: string; autorNombre: string }): Promise<void>;
  ahora(): Date;
}

export async function pedirCambios(
  deps: DepsPedirCambios,
  uid: string,
  ticketId: string,
  texto: unknown
): Promise<OperacionPedirCambios> {
  const usuario = await deps.cargarUsuario(uid);
  if (!usuario || usuario.role !== "jefe_zona" || !usuario.activo) {
    throw new PedirCambiosError(403, "No puedes pedir cambios en este ticket.");
  }

  const validado = validarTextoComentario(typeof texto === "string" ? texto : "");
  if (!validado.ok) throw new PedirCambiosError(400, validado.error);

  const ticket = await deps.cargarTicket(ticketId);
  if (!ticket) throw new PedirCambiosError(404, "Ticket no encontrado.");
  if (ticket.estatus !== "Pre-Cierre") throw new PedirCambiosError(409, "El ticket ya no esta en Pre-Cierre.");

  const ahora = deps.ahora();
  const actor: ActorHistorial = { uid, nombre: usuario.nombre, rol: usuario.role };
  // Mismo calculo que un cambio de estatus de Legal: agrega la entrada a historialEstatus (el SLA se reanuda).
  const { patch } = calcularPatchAsignacion(
    ticket,
    { estatus: ESTATUS_TRAS_PEDIR_CAMBIOS, abogadoAsignadoId: ticket.abogadoAsignadoId, notasCierre: ticket.notasCierre },
    uid,
    ahora
  );
  const resumen = await deps.cargarResumen(ticketId);
  const comentarioId = deps.nuevoIdComentario(ticketId);

  const op: OperacionPedirCambios = {
    ticketId,
    patchTicket: patch,
    patchResumen: resumen
      ? { estatus: ESTATUS_TRAS_PEDIR_CAMBIOS, vistoBueno: null, actualizadoEn: ahora.toISOString() }
      : null,
    comentarioId,
    comentario: {
      autorUid: uid,
      autorNombre: usuario.nombre,
      autorRol: "jefe_zona",
      texto: validado.texto,
      tipo: "cambios_solicitados",
      creadoEn: ahora.toISOString(),
      eliminado: false,
      avisoEnviado: true, // el aviso lo manda esta misma operacion
    },
    entrada: entradaCambiosSolicitados(actor, ahora, {
      estatusAntes: ticket.estatus,
      estatusDespues: ESTATUS_TRAS_PEDIR_CAMBIOS,
      vistoBuenoAntes: resumen?.vistoBueno ?? null,
      comentarioId,
    }),
  };

  await deps.guardar(op);
  await deps.avisar({ ticketId, autorUid: uid, autorNombre: usuario.nombre }).catch((err) => {
    console.error("Aviso de cambios solicitados fallo:", err instanceof Error ? err.message : "error desconocido");
  });
  return op;
}
```

- [ ] **Step 4: Verificar que pasa** — `pnpm test src/domain/tickets/pedir-cambios-service.test.ts`. Esperado: PASS.

- [ ] **Step 5: Ruta del servidor** — crear `src/app/api/tickets/[id]/pedir-cambios/route.ts`:

```ts
import { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { verifyCallerToken, ApiAuthError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { sinUndefined } from "@/lib/storage-ruta";
import { avisarConversacion } from "@/lib/avisos-conversacion";
import {
  pedirCambios,
  PedirCambiosError,
  type DepsPedirCambios,
  type OperacionPedirCambios,
} from "@/domain/tickets/pedir-cambios-service";
import type { Ticket } from "@/types/ticket";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { Role } from "@/types/user";

export const runtime = "nodejs";

interface Params {
  params: { id: string };
}

// Ticket, resumen, comentario e historial en una transaccion. Se vuelve a comprobar que el ticket siga en
// Pre-Cierre: Legal pudo moverlo entre la lectura y la escritura.
async function guardar(db: Firestore, op: OperacionPedirCambios): Promise<void> {
  const ticketRef = db.collection("tickets").doc(op.ticketId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ticketRef);
    if (snap.data()?.estatus !== "Pre-Cierre") throw new PedirCambiosError(409, "El ticket ya no esta en Pre-Cierre.");
    tx.update(ticketRef, sinUndefined(op.patchTicket));
    if (op.patchResumen) tx.update(db.collection("resumenesContrato").doc(op.ticketId), sinUndefined(op.patchResumen));
    tx.set(ticketRef.collection("comentarios").doc(op.comentarioId), sinUndefined(op.comentario));
    tx.set(ticketRef.collection("historial").doc(), sinUndefined(op.entrada));
  });
}

export async function POST(request: Request, { params }: Params) {
  try {
    const uid = await verifyCallerToken(request);
    const body = await request.json().catch(() => null);
    const db = getAdminDb();

    const deps: DepsPedirCambios = {
      cargarUsuario: async (u) => {
        const data = (await db.collection("users").doc(u).get()).data();
        return data ? { nombre: String(data.nombre ?? ""), role: data.role as Role, activo: data.activo !== false } : null;
      },
      cargarTicket: async (id) => {
        const snap = await db.collection("tickets").doc(id).get();
        return snap.exists ? ({ ...snap.data(), id: snap.id } as Ticket) : null;
      },
      cargarResumen: async (id) => {
        const snap = await db.collection("resumenesContrato").doc(id).get();
        return snap.exists ? (snap.data() as ResumenContrato) : null;
      },
      nuevoIdComentario: (id) => db.collection("tickets").doc(id).collection("comentarios").doc().id,
      guardar: (op) => guardar(db, op),
      avisar: (info) => avisarConversacion({ tipo: "cambios_solicitados", ...info }),
      ahora: () => new Date(),
    };

    await pedirCambios(deps, uid, params.id, body?.texto);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PedirCambiosError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof ApiAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    // Solo el mensaje: nunca el texto del comentario ni el cuerpo de la solicitud.
    console.error("POST /api/tickets/[id]/pedir-cambios fallo:", err instanceof Error ? err.message : "error desconocido");
    return NextResponse.json({ error: "No se pudieron pedir los cambios." }, { status: 500 });
  }
}
```

Agregar al final de `src/lib/conversacion.ts`:

```ts
// Ruta de servidor (Admin SDK): el jefe de zona no puede escribir el ticket desde el cliente.
export async function solicitarCambios(ticketId: string, texto: string): Promise<void> {
  const res = await postConToken(`/api/tickets/${encodeURIComponent(ticketId)}/pedir-cambios`, { texto });
  if (res.ok) return;
  const data: unknown = await res.json().catch(() => null);
  const mensaje =
    typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : null;
  throw new Error(mensaje ?? "No se pudieron pedir los cambios. Intenta de nuevo.");
}
```

- [ ] **Step 6: Verificación completa** — `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (código 0).

- [ ] **Step 7: Verificación manual (NO EJECUTADA; se completa con el Task 8)** — con un ticket de prueba en Pre-Cierre con visto bueno: (1) como jefe de zona, pedir cambios con un texto → en Firestore el ticket queda en "Proceso en tramite" con una entrada nueva en `historialEstatus`, `resumenesContrato/{id}` con `estatus: "Proceso en tramite"` y `vistoBueno: null`, un comentario `cambios_solicitados` y una entrada de historial `cambios_solicitados`; (2) el abogado asignado y el solicitante reciben campana y correo sin el texto; (3) `POST` con texto vacío → 400; con token de un abogado → 403; sobre un ticket en Cierre → 409; (4) en el detalle del ticket (como admin) el nivel de servicio ya no muestra "(SLA en pausa)"; (5) la terminal del servidor no muestra el texto. Anotar resultados.

- [ ] **Step 8: Commit**:

```bash
git add src/domain/tickets/pedir-cambios-service.ts src/domain/tickets/pedir-cambios-service.test.ts "src/app/api/tickets/[id]/pedir-cambios/route.ts" src/lib/conversacion.ts
git commit -m "feat: el jefe de zona puede pedir cambios desde Pre-Cierre"
```

---

### Task 8: Pantallas: panel "Conversacion", detalle del ticket y `/pre-cierre/[id]`

**Files:**
- Create: `src/components/tickets/conversacion-panel.tsx`
- Modify: `src/components/tickets/ticket-detail.tsx` (imports; cálculo junto a `verHistorial`; render antes de `HistorialPanel`)
- Modify: `src/components/pre-cierre/pre-cierre-detalle.tsx` (imports, estado, botón "Pedir cambios", panel en la columna izquierda)

**Interfaces:**
- Consumes: `useComentarios`, `comentar`, `editarComentario`, `eliminarComentario`, `solicitarCambios` (Tasks 6-7); `actorDesdeSesion` (Plan C); `MAX_TEXTO_COMENTARIO`, `validarTextoComentario`, `puedeEditarComentario`, `hiloVisible`, `hiloEscribible`, `esParticipante` (Task 1); `Badge`, `Button`, `formatFecha`, `cn`.
- Produces: `ConversacionPanel({ ticketId, escribible }: { ticketId: string; escribible: boolean })`.

- [ ] **Step 1: Crear el panel** — `src/components/tickets/conversacion-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useComentarios } from "@/hooks/use-comentarios";
import { comentar, editarComentario, eliminarComentario } from "@/lib/conversacion";
import { actorDesdeSesion } from "@/domain/tickets/historial-rules";
import { MAX_TEXTO_COMENTARIO, puedeEditarComentario, validarTextoComentario } from "@/domain/tickets/conversacion-rules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFecha } from "@/lib/format-fecha";
import { cn } from "@/lib/utils";
import type { Comentario } from "@/types/comentario";
import type { Role } from "@/types/user";

const ETIQUETA_ROL: Record<Role, string> = {
  solicitante: "Solicitante",
  gerente_area: "Solicitante",
  mesa_control: "Mesa de Control",
  abogado: "Abogado",
  gerente_juridico: "Gerente Juridico",
  admin: "Admin",
  jefe_zona: "Jefe de Zona",
  sitios: "Sitios", // nunca es autor (no participa); requerido por Record<Role, string>

};

// El texto de los comentarios se pinta siempre como texto de React (nunca como HTML).
export function ConversacionPanel({ ticketId, escribible }: { ticketId: string; escribible: boolean }) {
  const uid = useAuthStore((s) => s.uid);
  const nombre = useAuthStore((s) => s.nombre);
  const role = useAuthStore((s) => s.role);
  const actor = actorDesdeSesion({ uid, nombre, role });
  const { comentarios, loading, error } = useComentarios(ticketId);

  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicion, setTextoEdicion] = useState("");
  const [confirmandoBorrarId, setConfirmandoBorrarId] = useState<string | null>(null);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  async function enviar() {
    if (!actor) return;
    const validado = validarTextoComentario(texto);
    if (!validado.ok) {
      setErrorEnvio(validado.error);
      return;
    }
    setEnviando(true);
    setErrorEnvio(null);
    try {
      await comentar(ticketId, actor, validado.texto);
      setTexto("");
    } catch {
      setErrorEnvio("No se pudo enviar el comentario. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  function iniciarEdicion(c: Comentario) {
    setEditandoId(c.id);
    setTextoEdicion(c.texto ?? "");
    setConfirmandoBorrarId(null);
    setErrorAccion(null);
  }

  async function guardarEdicion(c: Comentario) {
    if (!actor) return;
    const validado = validarTextoComentario(textoEdicion);
    if (!validado.ok) {
      setErrorAccion(validado.error);
      return;
    }
    setOcupadoId(c.id);
    setErrorAccion(null);
    try {
      await editarComentario(ticketId, actor, c, validado.texto);
      setEditandoId(null);
    } catch {
      setErrorAccion("No se pudo guardar el comentario. Intenta de nuevo.");
    } finally {
      setOcupadoId(null);
    }
  }

  async function borrar(c: Comentario) {
    if (!actor) return;
    setOcupadoId(c.id);
    setErrorAccion(null);
    try {
      await eliminarComentario(ticketId, actor, c);
      setConfirmandoBorrarId(null);
    } catch {
      setErrorAccion("No se pudo eliminar el comentario. Intenta de nuevo.");
    } finally {
      setOcupadoId(null);
    }
  }

  return (
    <section className="section-card p-6 space-y-4">
      <h2 className="eyebrow">Conversacion</h2>

      {loading ? (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger">No se pudo cargar la conversacion.</p>
      ) : comentarios.length === 0 ? (
        <p className="text-sm text-muted">Aun no hay comentarios.</p>
      ) : (
        <ol className="space-y-3">
          {comentarios.map((c) => {
            const propio = escribible && puedeEditarComentario(uid, c);
            const editando = editandoId === c.id;
            const ocupado = ocupadoId === c.id;
            return (
              <li
                key={c.id}
                className={cn(
                  "rounded-md border p-3",
                  c.tipo === "cambios_solicitados"
                    ? "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                    : "border-border"
                )}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-medium text-foreground">{c.autorNombre || "Sin nombre"}</span>
                  <span>{ETIQUETA_ROL[c.autorRol] ?? c.autorRol}</span>
                  <span>{formatFecha(c.creadoEn, { conHora: true })}</span>
                  {c.editadoEn && !c.eliminado && <span>(editado)</span>}
                  {c.tipo === "cambios_solicitados" && <Badge tone="amber">Cambios solicitados</Badge>}
                </div>

                {c.eliminado ? (
                  <p className="mt-1 text-sm italic text-muted">Comentario eliminado</p>
                ) : editando ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={textoEdicion}
                      onChange={(e) => setTextoEdicion(e.target.value)}
                      rows={3}
                      maxLength={MAX_TEXTO_COMENTARIO}
                      aria-label="Editar comentario"
                      className="field w-full resize-y"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => guardarEdicion(c)} disabled={ocupado}>
                        Guardar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditandoId(null)} disabled={ocupado}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">{c.texto}</p>
                )}

                {propio && !editando && (
                  confirmandoBorrarId === c.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span>Eliminar este comentario?</span>
                      <Button size="sm" variant="danger" onClick={() => borrar(c)} disabled={ocupado}>
                        Si, eliminar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmandoBorrarId(null)} disabled={ocupado}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => iniciarEdicion(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmandoBorrarId(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </Button>
                    </div>
                  )
                )}
              </li>
            );
          })}
        </ol>
      )}

      {errorAccion && <p role="alert" className="text-sm text-danger">{errorAccion}</p>}

      {escribible ? (
        <div className="space-y-2">
          <label htmlFor={`comentario-${ticketId}`} className="field-label">Nuevo comentario</label>
          <textarea
            id={`comentario-${ticketId}`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            maxLength={MAX_TEXTO_COMENTARIO}
            placeholder="Observaciones sobre el ticket o el contrato..."
            className="field w-full resize-y"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted tabular-nums">{texto.length} / {MAX_TEXTO_COMENTARIO}</span>
            <Button onClick={enviar} disabled={enviando || !texto.trim()}>
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
              Comentar
            </Button>
          </div>
          {errorEnvio && <p role="alert" className="text-sm text-danger">{errorEnvio}</p>}
        </div>
      ) : (
        <p className="text-xs text-muted">La conversacion esta cerrada (solo lectura).</p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Detalle del ticket** — en `src/components/tickets/ticket-detail.tsx`:
- Imports:

```ts
import { ConversacionPanel } from "./conversacion-panel";
import { esParticipante, hiloEscribible, hiloVisible } from "@/domain/tickets/conversacion-rules";
```

- Junto a `const verHistorial = ...` (Plan C Task 7):

```ts
  // Participantes del hilo (sin Mesa de Control ni otros abogados), desde que el ticket llego a Pre-Cierre.
  const verConversacion = hiloVisible(ticket) && esParticipante({ uid, role, abogadoId }, ticket);
```

- En la columna izquierda, inmediatamente antes de `{verHistorial && <HistorialPanel ticket={ticket} />}`:

```tsx
      {verConversacion && <ConversacionPanel ticketId={ticket.id} escribible={hiloEscribible(ticket)} />}
```

- [ ] **Step 3: `/pre-cierre/[id]`** — en `src/components/pre-cierre/pre-cierre-detalle.tsx`:
- Imports:

```ts
import { ConversacionPanel } from "@/components/tickets/conversacion-panel";
import { solicitarCambios } from "@/lib/conversacion";
import { MAX_TEXTO_COMENTARIO, validarTextoComentario } from "@/domain/tickets/conversacion-rules";
```

- Estado, junto a los `useState` existentes (antes de los `return` tempranos de carga/permiso):

```ts
  const [pidiendoCambios, setPidiendoCambios] = useState(false);
  const [textoCambios, setTextoCambios] = useState("");
  const [enviandoCambios, setEnviandoCambios] = useState(false);
  const [errorCambios, setErrorCambios] = useState<string | null>(null);
  const [cambiosEnviados, setCambiosEnviados] = useState(false);
```

- Después de `const puedeDarVistoBueno = ...` (que sigue exigiendo Pre-Cierre y sin visto bueno, sin cambios):

```ts
  // Rol Sitios: tambien abre esta pantalla (solo lectura del resumen). No pide cambios ni ve la conversacion.
  const esJefe = esJefeZona(role);
  const enPreCierre = resumen.estatus === "Pre-Cierre";
  // El jefe de zona conserva el hilo de sus tickets en cualquier etapa (decision del usuario); en Cierre, solo lectura.
  // Las reglas (hiloEscribible) son la autoridad: ver "Spec issues found" sobre tickets previos sin conversacionAbiertaEn.
  const hiloAbiertoParaJefe = resumen.estatus !== "Cierre";

  // Tras pedir cambios el jefe de zona se queda en la pantalla: la suscripcion al resumen sigue viva
  // y la etapa cambia sola a "Proceso en tramite" (el boton desaparece porque ya no esta en Pre-Cierre).
  async function enviarCambios() {
    const validado = validarTextoComentario(textoCambios);
    if (!validado.ok) {
      setErrorCambios(validado.error);
      return;
    }
    setEnviandoCambios(true);
    setErrorCambios(null);
    try {
      await solicitarCambios(id, validado.texto);
      setPidiendoCambios(false);
      setTextoCambios("");
      setCambiosEnviados(true);
    } catch (err) {
      setErrorCambios(err instanceof Error ? err.message : "No se pudieron pedir los cambios. Intenta de nuevo.");
    } finally {
      setEnviandoCambios(false);
    }
  }
```

- Dentro de la sección "Visto bueno", después del bloque condicional existente (el que termina en `<p className="text-sm text-muted">Sin visto bueno registrado.</p>` y su `)}`), y antes de `</section>`:

```tsx
        {cambiosEnviados && !enPreCierre && (
          <p role="status" className="text-sm text-muted">
            Se pidieron los cambios. El ticket esta en correccion; puedes seguir la conversacion abajo.
          </p>
        )}
        {esJefe && enPreCierre && (
          <div className="border-t border-border pt-3 space-y-2">
            {!pidiendoCambios ? (
              <Button variant="outline" onClick={() => setPidiendoCambios(true)}>
                Pedir cambios
              </Button>
            ) : (
              <>
                <label htmlFor="texto-cambios" className="field-label">Que hay que corregir (obligatorio)</label>
                <textarea
                  id="texto-cambios"
                  value={textoCambios}
                  onChange={(e) => setTextoCambios(e.target.value)}
                  rows={4}
                  maxLength={MAX_TEXTO_COMENTARIO}
                  className="field w-full resize-y"
                />
                <p className="text-xs text-muted">
                  El ticket regresa a &quot;Proceso en tramite&quot;, se borra el visto bueno y se avisa al abogado y al solicitante.
                </p>
                {errorCambios && <p role="alert" className="text-sm text-danger">{errorCambios}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button variant="warning" onClick={enviarCambios} disabled={enviandoCambios || !textoCambios.trim()}>
                    {enviandoCambios && <Loader2 className="h-4 w-4 animate-spin" />}
                    Enviar y regresar el ticket
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setPidiendoCambios(false); setErrorCambios(null); }}
                    disabled={enviandoCambios}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
```

- En `izquierda`, inmediatamente después del `</section>` de "Visto bueno" (antes del `</div>` que cierra `izquierda`):

```tsx
      {esJefe && <ConversacionPanel ticketId={id} escribible={hiloAbiertoParaJefe} />}
```

  (`esJefeZona` se importa de `@/types/user`: agregar `import { esJefeZona } from "@/types/user";` si la implementación del rol Sitios no lo dejó importado. El botón "Dar visto bueno" conserva la condición que deje esa implementación, p. ej. `puedeDarVistoBueno(role)`.)

  El resumen del contrato ya está en `derecha` (`DosColumnas`), sin cambios. Los mensajes existentes se conservan: "Resumen no encontrado" cuando el documento no existe (ticket que nunca entró a Pre-Cierre o borrado) y "No tienes acceso a este resumen" solo si la lectura se rechaza (ya no ocurre al regresar de etapa).

- [ ] **Step 4: Verificación completa** — `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (código 0).

- [ ] **Step 5: Verificación manual (NO EJECUTADA; no hay pruebas de componentes; requiere reglas del Task 3 publicadas)** — `pnpm dev`:
  1. Legal mueve un ticket de prueba a Pre-Cierre: en el detalle aparece "Conversacion" en la columna izquierda para admin, gerente jurídico, el abogado asignado y el solicitante dueño; **no** para mesa de control ni otro abogado.
  2. El jefe de zona abre `/pre-cierre/{id}`: ve el panel debajo del visto bueno (izquierda) y el resumen a la derecha; en pantalla angosta todo se apila sin desbordar.
  3. Cada participante comenta: el comentario aparece en vivo en las otras sesiones; el contador llega a 4000 y no deja escribir más.
  4. Pegar `<b>hola</b><script>alert(1)</script>` como comentario: se ve como texto literal.
  5. Editar un comentario propio: aparece "(editado)"; en el Historial (como admin) hay una entrada "Comentario editado" con el texto anterior. Eliminar uno propio: se ve "Comentario eliminado" y el Historial guarda el texto anterior. No aparecen botones sobre comentarios ajenos.
  6. El jefe de zona usa "Pedir cambios" sin texto: el botón está deshabilitado; con texto: se queda en `/pre-cierre/{id}`, la etapa cambia en vivo a "Proceso en tramite", desaparecen "Dar visto bueno" y "Pedir cambios", aparece el aviso "Se pidieron los cambios..." y el comentario "Cambios solicitados" se ve destacado en ámbar en su propio hilo; en el detalle (como admin) se ve igual.
  7. Con el ticket en "Proceso en tramite", todos los participantes **incluido el jefe de zona** siguen leyendo y comentando; al pasar a Cierre los controles de escritura desaparecen para todos y queda "solo lectura".
  8. La campana: un aviso de comentario lleva al jefe de zona a `/pre-cierre/{id}` y a los demás a `/tickets/{id}`.
  9. Un ticket que nunca llegó a Pre-Cierre no muestra el panel.
  Anotar resultados.

- [ ] **Step 6: Commit**:

```bash
git add src/components/tickets/conversacion-panel.tsx src/components/tickets/ticket-detail.tsx src/components/pre-cierre/pre-cierre-detalle.tsx
git commit -m "feat: panel de conversacion y boton Pedir cambios"
```

---

### Task 9: Lista del jefe de zona con los tickets "en correccion"

**Files:**
- Modify: `src/domain/contratos/resumen-presentacion.ts` (agregar al final)
- Test: `src/domain/contratos/resumen-presentacion.test.ts` (agregar)
- Modify: `src/domain/contratos/resumen-contrato-repository.ts:9-10` (método nuevo `subscribeTodos` en el puerto)
- Modify: `src/infrastructure/firestore/resumen-contrato-repository.ts` (implementar `subscribeTodos`; `subscribeMany` **queda igual**, filtrado)
- Modify: `src/lib/resumenes-contrato.ts` (exportar `subscribeResumenesTodos`)
- Modify: `src/domain/contratos/contrato-rules.ts:5` (comentario de `ETAPAS_VISIBLES_JEFE_ZONA`)
- Modify: `src/hooks/use-resumenes-contrato.ts:8-30` (`useResumenes` elige la consulta según el rol)
- Modify: `src/components/pre-cierre/pre-cierre-lista.tsx` (estado vacío y columna "Etapa")

**Interfaces:**
- Consumes: `ETAPAS_VISIBLES_JEFE_ZONA` (`contrato-rules.ts:5`, sin cambio de valor); la regla `allow read` de `resumenesContrato` con `isJefeZona()` sin filtro (Task 3, **debe estar publicada antes**: sin ella la consulta sin `where` se rechaza y la lista muestra "No se pudo cargar la lista").
- Produces:
  - `enCorreccion(estatus: Estatus): boolean` — el ticket ya pasó por Pre-Cierre y hoy está en una etapa anterior.
  - `ordenarResumenesJefeZona(resumenes: ResumenContrato[]): ResumenContrato[]` — Pre-Cierre, luego en corrección, luego Cierre; dentro de cada grupo, `actualizadoEn` descendente.
  - `ResumenContratoRepository.subscribeTodos(callback: (resumenes: ResumenContrato[]) => void, onError?: (e: RepositoryError) => void): () => void` — **todos** los resúmenes, sin `where`; solo para el jefe de zona (Legal/admin también podrían leerla, pero hoy no la usan).
  - `subscribeResumenesTodos` en `src/lib/resumenes-contrato.ts`.
  - `useResumenes()` usa `subscribeResumenesTodos` si `esJefeZona(role)` y `subscribeResumenes` (filtrada) para cualquier otro rol, en particular el rol **Sitios**.

Qué depende del filtro viejo y cómo queda:
- `where("estatus", "in", [...ETAPAS_VISIBLES_JEFE_ZONA])` en `subscribeMany` (`resumen-contrato-repository.ts:31`): **se conserva** para el rol Sitios (su regla exige el filtro estricto); el jefe de zona usa el método nuevo `subscribeTodos`.
- Regla `allow read` de `resumenesContrato`: cambiada en el Task 3.
- `ETAPAS_VISIBLES_JEFE_ZONA` sigue gobernando **quién crea/refresca** el resumen (`accionResumen`, `contrato-rules.ts:45-49`; `refrescarResumenSiVisible`, `ticket-service.ts:68-69`); no cambia. Sus pruebas (`contrato-rules.test.ts`) no cambian.
- `pre-cierre-detalle.tsx`: "Dar visto bueno" sigue exigiendo `resumen.estatus === "Pre-Cierre" && !resumen.vistoBueno` (`puedeDarVistoBueno`, línea 58) y "Pedir cambios" `enPreCierre` (Task 8); los mensajes "No tienes acceso"/"Resumen no encontrado" se conservan (Task 8).
- `use-resumenes-contrato.ts`: el orden pasa a `ordenarResumenesJefeZona` (para Sitios el resultado es el mismo agrupado Pre-Cierre/Cierre, porque nunca recibe tickets en corrección).
- Rol Sitios: si su implementación ya cambió `pre-cierre-lista.tsx`, `use-resumenes-contrato.ts` o la condición del visto bueno (`puedeDarVistoBueno(role)`), aplicar estos cambios sobre esa versión, sin quitar lo suyo.

- [ ] **Step 1: Escribir la prueba que falla** — en `src/domain/contratos/resumen-presentacion.test.ts` cambiar el import por:

```ts
import { enCorreccion, formaPagoLabel, formatMonto, NO_DISPONIBLE, ordenarResumenesJefeZona, textoDiscrepancia, textoODisponible } from "./resumen-presentacion";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { Estatus } from "@/types/ticket";
```

y agregar al final:

```ts
describe("lista del jefe de zona", () => {
  it("en correccion: ya paso por Pre-Cierre y regreso a una etapa anterior", () => {
    expect(enCorreccion("Proceso en tramite")).toBe(true);
    expect(enCorreccion("Pre-Cierre")).toBe(false);
    expect(enCorreccion("Cierre")).toBe(false);
  });

  it("ordena Pre-Cierre, luego en correccion, luego Cierre; lo mas reciente arriba en cada grupo", () => {
    const r = (ticketId: string, estatus: Estatus, actualizadoEn: string) =>
      ({ ticketId, estatus, actualizadoEn }) as unknown as ResumenContrato;
    const lista = [
      r("c", "Cierre", "2026-10-09T00:00:00.000Z"),
      r("p1", "Pre-Cierre", "2026-10-01T00:00:00.000Z"),
      r("e", "Proceso en tramite", "2026-10-08T00:00:00.000Z"),
      r("p2", "Pre-Cierre", "2026-10-05T00:00:00.000Z"),
    ];
    expect(ordenarResumenesJefeZona(lista).map((x) => x.ticketId)).toEqual(["p2", "p1", "e", "c"]);
    expect(lista[0].ticketId).toBe("c"); // no muta la entrada
  });
});
```

- [ ] **Step 2: Verificar que falla** — `pnpm test src/domain/contratos/resumen-presentacion.test.ts`. Esperado: FAIL (funciones inexistentes).

- [ ] **Step 3: Implementar** — en `src/domain/contratos/resumen-presentacion.ts` cambiar la línea 1 por:

```ts
import type { Discrepancia, FormaPago, ResumenContrato } from "@/types/resumen-contrato";
import type { Estatus } from "@/types/ticket";
import { ETAPAS_VISIBLES_JEFE_ZONA } from "./contrato-rules";
```

y agregar al final:

```ts
// El jefe de zona conserva sus tickets aunque regresen a una etapa anterior (p. ej. por "Pedir cambios").
export function enCorreccion(estatus: Estatus): boolean {
  return !ETAPAS_VISIBLES_JEFE_ZONA.includes(estatus);
}

const prioridad = (estatus: Estatus): number => (estatus === "Pre-Cierre" ? 0 : enCorreccion(estatus) ? 1 : 2);

// Primero lo pendiente de visto bueno, luego lo que esta en correccion y al final lo cerrado.
export function ordenarResumenesJefeZona(resumenes: ResumenContrato[]): ResumenContrato[] {
  return [...resumenes].sort(
    (a, b) => prioridad(a.estatus) - prioridad(b.estatus) || b.actualizadoEn.localeCompare(a.actualizadoEn)
  );
}
```

- [ ] **Step 4: Verificar que pasa** — `pnpm test src/domain/contratos/resumen-presentacion.test.ts`. Esperado: PASS.

- [ ] **Step 5: Consulta, hook y lista**

`src/domain/contratos/resumen-contrato-repository.ts`: después de `subscribeMany(...)` (línea 10) agregar:

```ts
  // Todos los resumenes existentes (tickets que ya entraron a Pre-Cierre), en cualquier etapa.
  // Solo jefe de zona (las reglas no se lo permiten al rol sitios, que usa subscribeMany).
  subscribeTodos(callback: (resumenes: ResumenContrato[]) => void, onError?: (e: RepositoryError) => void): () => void;
```

`src/infrastructure/firestore/resumen-contrato-repository.ts`: `subscribeMany` no cambia; después de él agregar:

```ts
  // Sin filtro de etapa: solo el jefe de zona (ver firestore.rules). Sin orderBy: se ordena en JS.
  subscribeTodos(callback, onError) {
    return onSnapshot(
      collection(db, COLECCION),
      (snap) => callback(snap.docs.map((d) => d.data() as ResumenContrato)),
      onError ? (err) => onError(toRepositoryError(err)) : undefined
    );
  },
```

`src/lib/resumenes-contrato.ts`: después de `export const subscribeResumenes = repo.subscribeMany;` agregar `export const subscribeResumenesTodos = repo.subscribeTodos;`.

`src/domain/contratos/contrato-rules.ts` línea 5, agregar encima de la constante:

```ts
// Etapas en que se crea o refresca el resumen (accionResumen). La LECTURA del jefe de zona no se limita
// a estas etapas: conserva los tickets que regresan a correccion (ver firestore.rules).
```

`src/hooks/use-resumenes-contrato.ts`: cambiar el import de la fachada por `import { subscribeResumenes, subscribeResumenesTodos, subscribeResumen } from "@/lib/resumenes-contrato";`, agregar

```ts
import { ordenarResumenesJefeZona } from "@/domain/contratos/resumen-presentacion";
import { esJefeZona } from "@/types/user";
```

y reemplazar `useResumenes` completo por:

```ts
export function useResumenes() {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.role);
  const [resumenes, setResumenes] = useState<ResumenContrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"permission-denied" | "unknown" | null>(null);

  useEffect(() => {
    if (status !== "signed-in") return;
    setError(null);
    // Jefe de zona: todos sus resumenes (incluidos los en correccion). Cualquier otro rol (p. ej. sitios):
    // la consulta filtrada por Pre-Cierre/Cierre que exigen sus reglas.
    const suscribir = esJefeZona(role) ? subscribeResumenesTodos : subscribeResumenes;
    const unsubscribe = suscribir(
      (data) => {
        setResumenes(ordenarResumenesJefeZona(data));
        setLoading(false);
      },
      (err) => {
        setError(err.code === "permission-denied" ? "permission-denied" : "unknown");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [status, role]);

  return { resumenes, loading, error };
}
```

`src/components/pre-cierre/pre-cierre-lista.tsx`:
- Agregar `import { enCorreccion } from "@/domain/contratos/resumen-presentacion";`.
- Estado vacío: `<p className="text-xs text-muted mt-1">Aqui apareceran los contratos pendientes de visto bueno</p>` → `<p className="text-xs text-muted mt-1">Aqui apareceran los contratos pendientes de visto bueno y los que regresaron a correccion</p>`.
- Celda "Etapa": reemplazar `<td className="px-4 py-3"><EstatusBadge estatus={r.estatus} /></td>` por:

```tsx
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <EstatusBadge estatus={r.estatus} />
                    {enCorreccion(r.estatus) && <Badge tone="orange">En correccion</Badge>}
                  </div>
                </td>
```

- [ ] **Step 6: Verificación completa** — `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (código 0).

- [ ] **Step 7: Verificación manual (NO EJECUTADA; requiere la regla del Task 3 publicada)** — `pnpm dev` como jefe de zona: (1) `/pre-cierre` lista los tickets en Pre-Cierre arriba, luego los "En correccion" (badge naranja junto a la etapa) y al final los de Cierre; (2) tras "Pedir cambios" el ticket queda en la lista como "En correccion" y su detalle abre con el hilo; (3) un ticket que nunca entró a Pre-Cierre no aparece; (4) cuando Legal lo regresa a Pre-Cierre, vuelve al grupo de arriba y el botón de visto bueno reaparece (el visto bueno anterior ya fue borrado por "Pedir cambios"); (5) como usuario del rol **Sitios**: la lista solo muestra Pre-Cierre y Cierre (nunca "En correccion"), el detalle no muestra la conversación ni los botones de visto bueno / "Pedir cambios", y abrir por URL un ticket en corrección da "No tienes acceso a este resumen". Anotar resultados.

- [ ] **Step 8: Commit**:

```bash
git add src/domain/contratos/resumen-presentacion.ts src/domain/contratos/resumen-presentacion.test.ts src/infrastructure/firestore/resumen-contrato-repository.ts src/domain/contratos/resumen-contrato-repository.ts src/lib/resumenes-contrato.ts src/domain/contratos/contrato-rules.ts src/hooks/use-resumenes-contrato.ts src/components/pre-cierre/pre-cierre-lista.tsx
git commit -m "feat: el jefe de zona conserva los tickets que regresan a correccion"
```

---

## Self-review against the spec

| Requisito (spec Parte 2) | Task |
|---|---|
| `conversacionAbiertaEn` al entrar por primera vez a Pre-Cierre, dentro de `updateTicketAsignacion` | 1 (`calcularPatchAsignacion`, que es lo que usa `updateTicketAsignacion`) |
| Escribible si `conversacionAbiertaEn` existe o estatus Pre-Cierre, y no Cierre | 1 (`hiloEscribible`), 3 (regla `hiloEscribible`) |
| Lectura: participantes; el jefe de zona lee hilo y resumen mientras exista el resumen, en cualquier etapa; escribe con hilo abierto y no Cierre (spec actualizado) | 3 (`esParticipante`, `jefeZonaVeTicket` con `exists`, `allow read` de `resumenesContrato`), 8 (panel del jefe escribible fuera de Cierre, se queda en la pantalla tras "Pedir cambios"), 9 (lista con "En correccion") |
| Riesgo: tickets regresados siguen visibles para jefes de zona | 3, 9 |
| Rol Sitios: solo resumen filtrado, fuera del hilo y de los avisos de comentarios, solo correo `pre_cierre` | 1, 2, 3, 4, 5, 8, 9 |
| Modelo `comentarios` (autor, texto/null, tipo, creadoEn, editadoEn, eliminado) | 1 |
| Máximo 4000 caracteres en reglas y en pantalla | 1, 3, 8 |
| Reglas: participante, create (`tipo == "comentario"`, `eliminado == false`, autor), update (solo autor, solo `texto/editadoEn/eliminado`, no revivir), delete denegado, conteo de lecturas | 3 |
| Edición/borrado escriben entrada de historial en el mismo lote con el texto anterior | 6 (servicio + `actualizarConHistorial`), 3 (regla de historial) |
| "Pedir cambios": ruta, verificación de token/rol/estatus/texto, una sola operación (ticket + `historialEstatus` + resumen + comentario + historial), avisos, errores genéricos | 7 |
| Bloqueo del solicitante (`not in ["Pre-Cierre","Cierre"]`) y allowlist de Legal/admin en Pre-Cierre | 3 |
| La interfaz oculta edición de solicitud, documentos y sitio en Pre-Cierre | 2 |
| `camposPermitidosPorEtapa(estatus, rol)` probada | 2 |
| Tipos `comentario_ticket` y `cambios_solicitados` | 4 |
| Destinatarios (dueño, abogado, GJ/admin activos, jefes de zona activos, menos el autor) con `filtrarDestinatarios` | 5 |
| `CORREOS_POR_ROL` de los roles participantes | 4 |
| Correo con folio, autor y enlace por rol, sin el texto | 4 (plantilla), 5 (envío) |
| Campana con el mismo formato de `crearNotificacion` | 5 (Admin SDK, mismos campos) |
| Panel "Conversacion" en el detalle y en `/pre-cierre/[id]` (columna izquierda), `cambios_solicitados` destacado, solo lectura en Cierre, botón "Pedir cambios" con texto obligatorio | 8 |
| Pruebas: destinatarios, `camposPermitidosPorEtapa`, validación de texto, quién edita/borra, "Pedir cambios" con dependencias inyectadas | 1, 2, 5, 6, 7 |
| Reglas y pantallas: listas manuales | 3, 8, 9 (y 2, 4, 5, 7) |
| Abogado asignado por `abogadoId` sin importar el rol (decisión del spec) | 1 (`esParticipante`), 3 (`esAbogadoAsignado` de Plan C), 4 (`CORREOS_POR_ROL` de `mesa_control`/`gerente_juridico`), 5 |

Ambigüedades resueltas en este plan:
- **Tickets que ya estaban en Pre-Cierre al desplegar:** `conversacionAbiertaEn` se fija también cuando salen de Pre-Cierre, para que el hilo siga visible y escribible si regresan a una etapa anterior.
- **Jefe de zona en lectura y escritura:** participa si existe el resumen del ticket (`exists()` en las reglas); escribe con la regla general del hilo. No comenta tickets que nunca llegaron a Pre-Cierre porque no tienen resumen.
- **Avisos a jefes de zona:** se les avisa de todo comentario (menos al autor); como solo hay comentarios en tickets que ya tienen resumen, el enlace `/pre-cierre/{id}` siempre abre.
- **Comentarios `cambios_solicitados`:** no se editan ni se borran (los creó el servidor y están ligados a un cambio de estatus).
- **Tickets sin resumen** al pedir cambios: no se escribe `resumenesContrato` (el jefe de zona no llegaría a la pantalla sin él, pero el servicio no falla).
- **Admin en Pre-Cierre:** puede reasignar (en la allowlist y solo `isAdmin()`); Legal no admin sigue sin poder reasignar.
- **Correo del abogado/gerente:** `gerente_juridico` y `mesa_control` ofrecen ambos interruptores porque el abogado asignado se identifica por `abogadoId` y puede tener esos roles.

## Spec issues found

### Confirmed by user (spec actualizado)
- **Acceso del jefe de zona tras regresar de Pre-Cierre:** el jefe de zona conserva el resumen y el hilo de los tickets que ya entraron a Pre-Cierre, en cualquier etapa; escribe cuando el hilo está abierto y el estatus no es Cierre; su lista muestra los tickets "en correccion". Esto **amplía** su visibilidad más allá de "Pre-Cierre/Cierre" (spec original y Plan A) para esos tickets. Implementado en los Tasks 3, 5, 8 y 9. Resuelve los antiguos puntos "avisos a jefes de zona que no pueden abrir el ticket" y "el jefe de zona deja de ver el hilo tras Pedir cambios".
- **Rol Sitios (implementación paralela, fuera de este plan):** lee `resumenesContrato` solo en Pre-Cierre/Cierre con la consulta filtrada (no recibe la lectura ampliada del jefe de zona); no participa en la conversación (sin historial, comentarios, visto bueno ni "Pedir cambios"); recibe solo el correo `pre_cierre` y queda fuera de los destinatarios de comentarios. Reflejado en Global Constraints y en los Tasks 1, 2, 3, 4, 5, 8 y 9 (entradas de `Record<Role, …>`, pruebas que lo excluyen, método `subscribeTodos` solo para el jefe de zona, panel y botón "Pedir cambios" solo para `jefe_zona` en `/pre-cierre/[id]`).
- **Abogado asignado por `users.abogadoId` sin importar el rol:** si el ticket está asignado a la persona de Mesa de Control del catálogo, ella es la responsable: ve el historial y participa; Mesa de Control en general queda fuera. Sin cambios de plan (regla literal).

### Pendientes / resueltos en el plan
1. **La campana no se puede crear desde el cliente como dice el spec ("mediante `crearNotificacion`, igual que los avisos actuales").** Para dirigir una notificación hay que conocer el `uid` de cada destinatario; un solicitante o un jefe de zona no pueden consultar `users` (las reglas solo dejan leer el propio documento, a Legal y a admin) y el jefe de zona tampoco puede leer `tickets` (no conoce al dueño ni al abogado). Resuelto: el cliente llama `POST /api/tickets/[id]/comentarios/avisar` y el servidor crea las notificaciones con Admin SDK (mismo formato que `crearNotificacion`) y envía los correos (Task 5). Se agrega el campo `avisoEnviado` (solo servidor) al comentario para no avisar dos veces.
2. **El historial de edición/borrado de comentarios no se puede escribir con la regla de historial del spec.** Esa regla solo deja crear entradas a Legal/admin (y al dueño para `solicitud`/`documentos`), pero el autor del comentario puede ser el solicitante o el jefe de zona, y el lote completo se rechazaría. Resuelto: rama `comentarioPropioEnEsteLote` validada con `getAfter` sobre el comentario y la clave `comentarioId` en la entrada (Task 3; `comentarioId` ya existe desde Plan C).
3. **Cambio en un flujo existente:** hoy se puede editar la documentación en Pre-Cierre y el resumen se refresca (prueba "editar la documentacion en Pre-Cierre refresca contratoUrl..." en `ticket-service.test.ts`). Con el bloqueo eso ya no es posible; `refrescarResumenSiVisible` queda útil solo en Cierre (sitio por Mesa/admin, solicitud por admin). La prueba se ajusta a Cierre (Task 2). La regeneración del resumen con Gemini en Pre-Cierre sigue funcionando (Admin SDK, y `resumenContrato` está en la allowlist).
4. **Registro de errores:** el spec dice "el detalle va al log del servidor"; para no registrar datos sensibles, las rutas solo registran `err.message` (nunca el texto del comentario ni el cuerpo de la solicitud).
5. **Nuevo (por la decisión del jefe de zona): tickets que salieron de Pre-Cierre entre el despliegue de Plan A y el de Plan D.** Tienen resumen pero no `conversacionAbiertaEn` (se fija solo desde Plan D). El jefe de zona los ve "en correccion" y su pantalla muestra la caja de comentario (solo sabe la etapa del resumen), pero las reglas rechazan la escritura porque el hilo no está abierto; el panel muestra "No se pudo enviar el comentario". Para los demás participantes el panel no aparece (`hiloVisible` es falso). Se corrige solo cuando el ticket vuelve a Pre-Cierre. Se acepta como caso de borde; si molesta, un backfill que fije `conversacionAbiertaEn` en los tickets con resumen en etapa anterior lo resuelve.
6. **Nuevo: datos del resumen congelados durante la corrección.** Mientras el ticket está "en correccion" el resumen solo actualiza `estatus` (`accionResumen` → `"actualizar-estatus"`; `refrescarResumenSiVisible` no corre fuera de Pre-Cierre/Cierre), así que el jefe de zona ve los datos del contrato de cuando estuvo en Pre-Cierre aunque el solicitante ya los esté corrigiendo. Al volver a Pre-Cierre el `upsert` los recalcula. Se acepta (anotado en "Riesgos" del spec); no se cambia `accionResumen`.
