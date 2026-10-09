# Historial de cambios del ticket — Plan C

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar en `tickets/{ticketId}/historial` cada cambio del ticket (con valor anterior y nuevo, quién y cuándo), escrito en el mismo `writeBatch` que el cambio, y mostrarlo solo a Admin, Gerente Jurídico y el abogado asignado.

**Architecture:** Funciones puras en `src/domain/tickets/historial-rules.ts` calculan los cambios (`calcularCambios`) y arman las entradas por tipo. El puerto `TicketRepository` gana `updateConHistorial(id, patch, entradas)`, que la implementación de Firestore resuelve con un único `writeBatch` (ticket + entradas). `ticket-service.ts` deja de usar `repo.update` en los métodos que editan el ticket y pasa a recibir el actor (`ActorHistorial`) en vez de solo el uid. El visto bueno del jefe de zona escribe su entrada en el mismo lote que el `vistoBueno` del resumen. La lectura usa el puerto `HistorialRepository` (suscripción `onSnapshot`) siguiendo el patrón de `ResumenContratoRepository`; la pantalla es una sección "Historial" en la columna izquierda del detalle del ticket.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Firebase (Firestore client SDK), vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-09-historial-y-conversacion-design.md` (Parte 1). Antecedente: `docs/superpowers/specs/2026-10-08-jefe-zona-pre-cierre-gemini-design.md` y los planes A/B del 2026-10-08.

## Global Constraints

- Tipos de entrada (texto exacto): `"estatus" | "asignacion" | "solicitud" | "documentos" | "sitio" | "exclusion" | "notas_cierre" | "visto_bueno" | "cambios_solicitados" | "comentario_editado" | "comentario_eliminado"`.
- Cada cambio: `{ campo: string, etiqueta: string, antes: string | null, despues: string | null }`. Documentos por **nombre de archivo** (nunca la URL), fechas en ISO, booleanos como `"sí"`/`"no"`.
- `ticket.historialEstatus` (lo usa `sla-pausa-rules.ts`) **no se toca ni se reemplaza**: se sigue llenando igual (`asignacion-rules.ts:41-43`). El historial nuevo es aparte y aditivo.
- Si no hay cambios efectivos no se crea entrada (el ticket sí se sigue guardando como hoy).
- Cambio de ticket y sus entradas: **un solo `writeBatch`**. `deleteTicket` no escribe entrada.
- Identificadores en español sin acentos; textos de UI siguen el estilo de los vecinos (sin acentos en `ticket-detail.tsx`).
- `pnpm lint` exige `no-explicit-any` y hoy está limpio: **nada de `any`** ni `eslint-disable` en código ni pruebas; los falsos se tipan con `Pick<Puerto, ...>` y `as unknown as Puerto`.
- El `target` de tsconfig no permite expandir un `Set` (`[...set]`): usar `Array.from(set)`.
- Toda prueba que importe `src/domain/tickets/ticket-service.ts` necesita `vi.mock("@/lib/storage", () => ({ deleteTicketDocuments: async () => {} }));` **antes** del import (Firebase Auth se inicializa al importar `@/lib/storage` y truena en vitest). Copiar el patrón de `ticket-service.test.ts:3`.
- Verificación con el código de salida real: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`. No filtrar con `grep` ni ignorar fallas. Commit **solo** si los tres terminan con código 0 (y solo si el usuario autorizó commits en la sesión).
- `firestore.rules` está en `.gitignore`: vive solo en disco. Se edita el archivo en disco, **no se hace commit** de él, **no hay emulador ni CLI** en este equipo y **nunca** se planea `firebase deploy`. Las tareas de reglas terminan con una lista de verificación MANUAL (Rules Playground de la consola) marcada como NO EJECUTADA; el usuario publica las reglas a mano. Contar los `get()`/`getAfter()` de cada regla (límite: 10 documentos distintos por solicitud simple, 20 por lote).
- **Orden de despliegue:** las reglas del Task 3 deben estar publicadas **antes** de probar en la app (la app usa la base real) o desplegar el código de los Tasks 4-5: sin la regla de `historial`, el lote completo (incluido el cambio del ticket) se rechaza con `permission-denied`. Las reglas del Task 3 solo agregan permisos: son compatibles con el código actual.
- No hay pruebas de componentes: los cambios de pantalla son pequeños, la lógica va a módulos puros probados y cada tarea de UI termina con lista de verificación manual marcada NO EJECUTADA.
- La subcolección se lee con un solo `orderBy("fecha", "desc")` (índice automático de un campo; no requiere índice compuesto).

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/types/historial.ts` (nuevo) | `TIPOS_HISTORIAL`, `TipoHistorial`, `CambioCampo`, `ActorHistorial`, `EntradaHistorial`, `EntradaHistorialGuardada` |
| `src/domain/tickets/historial-rules.ts` (nuevo) | `textoDeValor`, `textoDocumentos`, `calcularCambios`, campos vigilados, constructores de entradas por tipo, `actorDesdeSesion`, etiquetas, `lineaDeTiempo`, `puedeVerHistorial` |
| `src/domain/tickets/historial-repository.ts` (nuevo) | Puerto `HistorialRepository` (lectura) |
| `src/domain/tickets/ticket-repository.ts` (mod) | `updateConHistorial` en el puerto |
| `src/domain/tickets/ticket-service.ts` (mod) | Métodos de edición reciben `ActorHistorial` y escriben con `updateConHistorial` |
| `src/domain/contratos/visto-bueno-rules.ts` (nuevo) | `prepararVistoBueno` (visto bueno + su entrada) |
| `src/domain/contratos/resumen-contrato-repository.ts` (mod) | `registrarVistoBueno(ticketId, visto, entrada)` |
| `src/infrastructure/firestore/historial-repository.ts` (nuevo) | `nuevaEntradaHistorialRef`, `firestoreHistorialRepository` |
| `src/infrastructure/firestore/ticket-repository.ts` (mod) | `updateConHistorial` con `writeBatch` |
| `src/infrastructure/firestore/resumen-contrato-repository.ts` (mod) | Visto bueno + entrada en un lote |
| `src/lib/historial.ts` (nuevo), `src/hooks/use-historial.ts` (nuevo) | Fachada y hook de lectura |
| `src/lib/resumenes-contrato.ts` (mod) | `registrarVistoBueno(ticketId, actor)` |
| `src/components/tickets/historial-panel.tsx` (nuevo) | Línea de tiempo |
| `src/components/tickets/ticket-detail.tsx`, `tickets-kanban.tsx`, `src/components/configuracion/excluir-tickets-section.tsx`, `src/components/pre-cierre/pre-cierre-detalle.tsx` (mod) | Pasan el actor; detalle muestra "Historial" |
| `firestore.rules` (mod, solo disco) | Reglas de `tickets/{ticketId}/historial` |

---

### Task 1: Tipos del historial y `calcularCambios`

**Files:**
- Create: `src/types/historial.ts`
- Create: `src/domain/tickets/historial-rules.ts`
- Test: `src/domain/tickets/historial-rules.test.ts`

**Interfaces:**
- Consumes: `nombreDeUrl(url: string): string` de `src/domain/contratos/contrato-rules.ts:10` (quita la ruta y el prefijo `{timestamp}_`; con URL inválida devuelve `""`). `Ticket` de `src/types/ticket.ts`.
- Produces:
  - `src/types/historial.ts`: `TIPOS_HISTORIAL` (tupla `as const` con los 11 tipos), `type TipoHistorial`, `interface CambioCampo { campo: string; etiqueta: string; antes: string | null; despues: string | null }`, `interface ActorHistorial { uid: string; nombre: string; rol: Role }`, `interface EntradaHistorial { fecha: string; actorUid: string; actorNombre: string; actorRol: Role; tipo: TipoHistorial; cambios: CambioCampo[]; comentarioId?: string }`, `interface EntradaHistorialGuardada extends EntradaHistorial { id: string }`.
  - `src/domain/tickets/historial-rules.ts`: `interface CampoVigilado { campo: keyof Ticket; etiqueta: string; formato?: (valor: unknown) => string | null }`, `textoDeValor(valor: unknown): string | null`, `textoDocumentos(valor: unknown): string | null`, `calcularCambios(antes: Ticket, despues: Partial<Ticket>, campos: CampoVigilado[]): CambioCampo[]`.

- [ ] **Step 1: Escribir la prueba que falla** — crear `src/domain/tickets/historial-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calcularCambios, textoDeValor, textoDocumentos, type CampoVigilado } from "./historial-rules";
import { buildTicket } from "@/test/ticket-fixture";

const url = (nombre: string) =>
  `https://firebasestorage.googleapis.com/v0/b/tickets-epl-legal/o/tickets%2Ft1%2F${encodeURIComponent(nombre)}?alt=media&token=x`;

describe("textoDeValor", () => {
  it("convierte cada tipo de valor a texto legible", () => {
    expect(textoDeValor(null)).toBeNull();
    expect(textoDeValor(undefined)).toBeNull();
    expect(textoDeValor("")).toBeNull();
    expect(textoDeValor("hola")).toBe("hola");
    expect(textoDeValor(5)).toBe("5");
    expect(textoDeValor(true)).toBe("sí");
    expect(textoDeValor(false)).toBe("no");
    expect(textoDeValor(["a", "b"])).toBe("a, b");
    expect(textoDeValor([])).toBeNull();
    expect(textoDeValor({ clave: "K1", alias: "Sitio Uno" })).toBe("K1 — Sitio Uno");
  });
});

describe("textoDocumentos", () => {
  it("lista los documentos por nombre de archivo, no por URL", () => {
    expect(textoDocumentos([url("1700_contrato.docx"), url("1800_predial.pdf")])).toBe("contrato.docx, predial.pdf");
  });

  it("sin documentos devuelve null", () => {
    expect(textoDocumentos([])).toBeNull();
    expect(textoDocumentos(undefined)).toBeNull();
  });

  it("una URL invalida no se copia al historial", () => {
    expect(textoDocumentos(["no-es-url"])).toBe("archivo sin nombre");
  });
});

describe("calcularCambios", () => {
  const campos: CampoVigilado[] = [
    { campo: "descripcion", etiqueta: "Descripcion" },
    { campo: "slaInterno", etiqueta: "SLA interno" },
    { campo: "documentacion", etiqueta: "Documentacion", formato: textoDocumentos },
  ];

  it("solo registra los campos vigilados que cambian", () => {
    const antes = buildTicket({ descripcion: "vieja", slaInterno: 5 });
    expect(calcularCambios(antes, { descripcion: "nueva", slaInterno: 5, areaEmpresa: "Otra" }, campos)).toEqual([
      { campo: "descripcion", etiqueta: "Descripcion", antes: "vieja", despues: "nueva" },
    ]);
  });

  it("ignora los campos vigilados que no vienen en el cambio", () => {
    expect(calcularCambios(buildTicket(), {}, campos)).toEqual([]);
  });

  it("usa el formato propio del campo", () => {
    const antes = buildTicket({ documentacion: [url("1_a.pdf")] });
    expect(calcularCambios(antes, { documentacion: [url("1_a.pdf"), url("2_b.pdf")] }, campos)).toEqual([
      { campo: "documentacion", etiqueta: "Documentacion", antes: "a.pdf", despues: "a.pdf, b.pdf" },
    ]);
  });

  it("pasar de texto vacio a null no cuenta como cambio", () => {
    expect(calcularCambios(buildTicket({ notasCierre: "" }), { notasCierre: null }, [{ campo: "notasCierre", etiqueta: "Notas" }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Verificar que falla** — `pnpm test src/domain/tickets/historial-rules.test.ts`. Esperado: FAIL (no existe `./historial-rules`).

- [ ] **Step 3: Implementar**

Crear `src/types/historial.ts`:

```ts
import type { Role } from "./user";

export const TIPOS_HISTORIAL = [
  "estatus",
  "asignacion",
  "solicitud",
  "documentos",
  "sitio",
  "exclusion",
  "notas_cierre",
  "visto_bueno",
  "cambios_solicitados",
  "comentario_editado",
  "comentario_eliminado",
] as const;

export type TipoHistorial = (typeof TIPOS_HISTORIAL)[number];

// Valores ya convertidos a texto legible (ver historial-rules.ts textoDeValor).
export interface CambioCampo {
  campo: string;
  etiqueta: string;
  antes: string | null;
  despues: string | null;
}

export interface ActorHistorial {
  uid: string;
  nombre: string;
  rol: Role;
}

// Documento tickets/{ticketId}/historial/{entradaId}. Solo se agrega: las reglas niegan update/delete.
// Es aparte de ticket.historialEstatus, que sigue alimentando el SLA (sla-pausa-rules.ts).
export interface EntradaHistorial {
  fecha: string; // ISO
  actorUid: string;
  actorNombre: string;
  actorRol: Role;
  tipo: TipoHistorial;
  cambios: CambioCampo[];
  // Solo comentario_editado, comentario_eliminado y cambios_solicitados (Plan D). Se omite la clave si no aplica:
  // el SDK de cliente rechaza valores undefined.
  comentarioId?: string;
}

export interface EntradaHistorialGuardada extends EntradaHistorial {
  id: string;
}
```

Crear `src/domain/tickets/historial-rules.ts`:

```ts
import type { Ticket } from "@/types/ticket";
import type { CambioCampo } from "@/types/historial";
import { nombreDeUrl } from "@/domain/contratos/contrato-rules";

export interface CampoVigilado {
  campo: keyof Ticket;
  etiqueta: string;
  // Convierte el valor guardado en texto legible. Por defecto, textoDeValor.
  formato?: (valor: unknown) => string | null;
}

function esSitio(valor: unknown): valor is { clave: string; alias: string } {
  return typeof valor === "object" && valor !== null && "clave" in valor && "alias" in valor;
}

export function textoDeValor(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "boolean") return valor ? "sí" : "no";
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "string") return valor === "" ? null : valor;
  if (Array.isArray(valor)) {
    const partes = valor.map(textoDeValor).filter((p): p is string => p !== null);
    return partes.length ? partes.join(", ") : null;
  }
  if (esSitio(valor)) return [valor.clave, valor.alias].filter(Boolean).join(" — ");
  return JSON.stringify(valor);
}

// El historial guarda el nombre del archivo, nunca la URL de descarga (lleva token).
export function textoDocumentos(valor: unknown): string | null {
  if (!Array.isArray(valor)) return null;
  const nombres = valor
    .filter((u): u is string => typeof u === "string")
    .map((u) => nombreDeUrl(u) || "archivo sin nombre");
  return nombres.length ? nombres.join(", ") : null;
}

// Compara solo los campos vigilados que vienen en `despues`; omite los que no cambian.
export function calcularCambios(antes: Ticket, despues: Partial<Ticket>, campos: CampoVigilado[]): CambioCampo[] {
  const cambios: CambioCampo[] = [];
  for (const { campo, etiqueta, formato = textoDeValor } of campos) {
    if (!(campo in despues)) continue;
    const valorAntes = formato(antes[campo]);
    const valorDespues = formato(despues[campo]);
    if (valorAntes === valorDespues) continue;
    cambios.push({ campo, etiqueta, antes: valorAntes, despues: valorDespues });
  }
  return cambios;
}
```

- [ ] **Step 4: Verificar que pasa** — `pnpm test src/domain/tickets/historial-rules.test.ts`. Esperado: PASS (7 pruebas).

- [ ] **Step 5: Verificación completa y commit** — `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (los tres con código 0). Luego:

```bash
git add src/types/historial.ts src/domain/tickets/historial-rules.ts src/domain/tickets/historial-rules.test.ts
git commit -m "feat: tipos del historial y calculo de cambios"
```

---

### Task 2: Constructores de entradas por tipo

**Files:**
- Modify: `src/domain/tickets/historial-rules.ts` (agregar al final)
- Test: `src/domain/tickets/historial-rules.test.ts` (agregar al final)

**Interfaces:**
- Consumes: Task 1 (`calcularCambios`, `textoDocumentos`, `CampoVigilado`, tipos de `@/types/historial`); `findAbogado(id): Abogado | undefined` de `src/lib/data/abogados.ts:23` (módulo de datos puro); `VistoBueno` de `src/types/resumen-contrato.ts:38`; `Estatus` de `src/types/ticket.ts`; `Role` de `src/types/user.ts`.
- Produces (todas exportadas desde `src/domain/tickets/historial-rules.ts`; Plan D las usa con estos nombres exactos):
  - `CAMPOS_ESTATUS`, `CAMPOS_ASIGNACION`, `CAMPOS_NOTAS_CIERRE`, `CAMPOS_DOCUMENTOS`, `CAMPOS_SITIO`, `CAMPOS_EXCLUSION`: `CampoVigilado[]`; `camposSolicitud(nombreServicio: (id: string) => string | null): CampoVigilado[]`.
  - `construirEntrada(tipo: TipoHistorial, actor: ActorHistorial, ahora: Date, cambios: CambioCampo[], comentarioId?: string): EntradaHistorial | null` (null si `cambios` está vacío).
  - `entradasAsignacion(antes: Ticket, patch: Partial<Ticket>, actor: ActorHistorial, ahora: Date): EntradaHistorial[]` → tipos en orden `estatus`, `asignacion`, `notas_cierre` (solo los que cambian).
  - `entradasSolicitud(antes: Ticket, patch: Partial<Ticket>, actor: ActorHistorial, ahora: Date, nombreServicio: (id: string) => string | null): EntradaHistorial[]` → `solicitud`, `documentos`.
  - `entradaSitio(antes: Ticket, patch: Partial<Ticket>, actor: ActorHistorial, ahora: Date): EntradaHistorial | null`.
  - `entradaExclusion(antes: Ticket, excluido: boolean, actor: ActorHistorial, ahora: Date): EntradaHistorial | null`.
  - `textoVistoBueno(visto: VistoBueno): string` → `"{nombre} ({fecha ISO})"`.
  - `entradaVistoBueno(actor: ActorHistorial, ahora: Date, visto: VistoBueno): EntradaHistorial`.
  - `interface DatosCambiosSolicitados { estatusAntes: Estatus; estatusDespues: Estatus; vistoBuenoAntes: VistoBueno | null; comentarioId: string }` y `entradaCambiosSolicitados(actor: ActorHistorial, ahora: Date, datos: DatosCambiosSolicitados): EntradaHistorial`.
  - `entradaComentarioEditado(actor: ActorHistorial, ahora: Date, comentarioId: string, textoAnterior: string | null, textoNuevo: string): EntradaHistorial`.
  - `entradaComentarioEliminado(actor: ActorHistorial, ahora: Date, comentarioId: string, textoAnterior: string | null): EntradaHistorial`.
  - `actorDesdeSesion(sesion: { uid: string | null; nombre: string | null; role: Role }): ActorHistorial | null`.
  - `ETIQUETA_TIPO_HISTORIAL: Record<TipoHistorial, string>`.

- [ ] **Step 1: Escribir la prueba que falla** — en `src/domain/tickets/historial-rules.test.ts` reemplazar la línea de import de `./historial-rules` por:

```ts
import {
  actorDesdeSesion,
  calcularCambios,
  construirEntrada,
  entradaCambiosSolicitados,
  entradaComentarioEditado,
  entradaComentarioEliminado,
  entradaExclusion,
  entradaSitio,
  entradasAsignacion,
  entradasSolicitud,
  entradaVistoBueno,
  ETIQUETA_TIPO_HISTORIAL,
  textoDeValor,
  textoDocumentos,
  type CampoVigilado,
} from "./historial-rules";
import { TIPOS_HISTORIAL, type ActorHistorial } from "@/types/historial";
```

y agregar al final del archivo:

```ts
const actor: ActorHistorial = { uid: "u1", nombre: "Ana", rol: "admin" };
const AHORA = new Date("2026-10-09T15:00:00.000Z");
const ISO = AHORA.toISOString();

describe("construirEntrada", () => {
  it("sin cambios no crea entrada", () => {
    expect(construirEntrada("estatus", actor, AHORA, [])).toBeNull();
  });

  it("lleva fecha, actor y tipo; comentarioId solo si se da", () => {
    const cambios = [{ campo: "x", etiqueta: "X", antes: null, despues: "1" }];
    const entrada = construirEntrada("sitio", actor, AHORA, cambios);
    expect(entrada).toEqual({ fecha: ISO, actorUid: "u1", actorNombre: "Ana", actorRol: "admin", tipo: "sitio", cambios });
    expect(entrada !== null && "comentarioId" in entrada).toBe(false);
    expect(construirEntrada("comentario_editado", actor, AHORA, cambios, "c1")?.comentarioId).toBe("c1");
  });
});

describe("entradasAsignacion", () => {
  it("separa estatus, asignacion y notas de cierre", () => {
    const antes = buildTicket({ estatus: "Recepcion de solicitud" });
    const patch = {
      estatus: "Proceso en tramite" as const,
      abogadoAsignadoId: "Karina Valenzuela - Abogado Corporativo",
      notasCierre: "ok",
      fechaAsignacion: ISO,
    };
    const entradas = entradasAsignacion(antes, patch, actor, AHORA);
    expect(entradas.map((e) => e.tipo)).toEqual(["estatus", "asignacion", "notas_cierre"]);
    expect(entradas[1].cambios[0]).toEqual({ campo: "abogadoAsignadoId", etiqueta: "Abogado asignado", antes: null, despues: "Karina Valenzuela" });
  });

  it("sin cambios efectivos no devuelve entradas (historialEstatus no se vigila)", () => {
    const antes = buildTicket();
    const patch = { estatus: antes.estatus, abogadoAsignadoId: null, notasCierre: null, historialEstatus: antes.historialEstatus };
    expect(entradasAsignacion(antes, patch, actor, AHORA)).toEqual([]);
  });

  it("el cierre registra tambien la fecha de cierre dentro de la entrada de estatus", () => {
    const antes = buildTicket({ estatus: "Pre-Cierre" });
    const [estatus] = entradasAsignacion(antes, { estatus: "Cierre", fechaCierre: ISO }, actor, AHORA);
    expect(estatus.cambios.map((c) => c.campo)).toEqual(["estatus", "fechaCierre"]);
  });
});

describe("entradasSolicitud", () => {
  it("separa la edicion de los documentos e incluye derivados solo si cambian", () => {
    const antes = buildTicket({ servicioId: "S1", slaInterno: 5, documentacion: [] });
    const patch = { servicioId: "S2", slaInterno: 3, categoria: antes.categoria, documentacion: [url("1_contrato.docx")] };
    const entradas = entradasSolicitud(antes, patch, actor, AHORA, (id) => `Servicio ${id}`);
    expect(entradas.map((e) => e.tipo)).toEqual(["solicitud", "documentos"]);
    expect(entradas[0].cambios).toEqual([
      { campo: "servicioId", etiqueta: "Servicio", antes: "Servicio S1", despues: "Servicio S2" },
      { campo: "slaInterno", etiqueta: "SLA interno", antes: "5", despues: "3" },
    ]);
    expect(entradas[1].cambios).toEqual([{ campo: "documentacion", etiqueta: "Documentacion", antes: null, despues: "contrato.docx" }]);
  });
});

describe("entradaSitio y entradaExclusion", () => {
  it("el sitio se registra como clave — alias y no se repite si no cambia", () => {
    const patch = { sitioArrendamiento: { clave: "K1", alias: "Uno" } };
    expect(entradaSitio(buildTicket(), patch, actor, AHORA)?.cambios).toEqual([
      { campo: "sitioArrendamiento", etiqueta: "Sitio", antes: null, despues: "K1 — Uno" },
    ]);
    expect(entradaSitio(buildTicket(patch), patch, actor, AHORA)).toBeNull();
  });

  it("la exclusion se registra como si/no; un ticket sin el campo cuenta como no", () => {
    expect(entradaExclusion(buildTicket(), true, actor, AHORA)?.cambios).toEqual([
      { campo: "excluidoDelPipeline", etiqueta: "Excluido del pipeline", antes: "no", despues: "sí" },
    ]);
    expect(entradaExclusion(buildTicket(), false, actor, AHORA)).toBeNull();
  });
});

describe("entradas sin ticket: visto bueno, cambios solicitados y comentarios", () => {
  const visto = { uid: "j1", nombre: "Jefe Uno", fecha: "2026-10-08T10:00:00.000Z" };

  it("visto bueno", () => {
    expect(entradaVistoBueno(actor, AHORA, visto)).toEqual({
      fecha: ISO, actorUid: "u1", actorNombre: "Ana", actorRol: "admin", tipo: "visto_bueno",
      cambios: [{ campo: "vistoBueno", etiqueta: "Visto bueno", antes: null, despues: "Jefe Uno (2026-10-08T10:00:00.000Z)" }],
    });
  });

  it("cambios solicitados registra el regreso de estatus y el visto bueno borrado", () => {
    const entrada = entradaCambiosSolicitados(actor, AHORA, {
      estatusAntes: "Pre-Cierre", estatusDespues: "Proceso en tramite", vistoBuenoAntes: visto, comentarioId: "c9",
    });
    expect(entrada.tipo).toBe("cambios_solicitados");
    expect(entrada.comentarioId).toBe("c9");
    expect(entrada.cambios).toEqual([
      { campo: "estatus", etiqueta: "Estatus", antes: "Pre-Cierre", despues: "Proceso en tramite" },
      { campo: "vistoBueno", etiqueta: "Visto bueno", antes: "Jefe Uno (2026-10-08T10:00:00.000Z)", despues: null },
    ]);
  });

  it("cambios solicitados sin visto bueno previo solo registra el estatus", () => {
    const entrada = entradaCambiosSolicitados(actor, AHORA, {
      estatusAntes: "Pre-Cierre", estatusDespues: "Proceso en tramite", vistoBuenoAntes: null, comentarioId: "c9",
    });
    expect(entrada.cambios.map((c) => c.campo)).toEqual(["estatus"]);
  });

  it("editar y borrar un comentario guardan el texto anterior", () => {
    expect(entradaComentarioEditado(actor, AHORA, "c1", "antes", "despues")).toMatchObject({
      tipo: "comentario_editado", comentarioId: "c1",
      cambios: [{ campo: "texto", etiqueta: "Comentario", antes: "antes", despues: "despues" }],
    });
    expect(entradaComentarioEliminado(actor, AHORA, "c1", "antes")).toMatchObject({
      tipo: "comentario_eliminado", comentarioId: "c1",
      cambios: [{ campo: "texto", etiqueta: "Comentario", antes: "antes", despues: null }],
    });
  });
});

describe("actorDesdeSesion y etiquetas", () => {
  it("sin uid no hay actor; sin nombre usa cadena vacia", () => {
    expect(actorDesdeSesion({ uid: null, nombre: "X", role: "admin" })).toBeNull();
    expect(actorDesdeSesion({ uid: "u1", nombre: null, role: "abogado" })).toEqual({ uid: "u1", nombre: "", rol: "abogado" });
  });

  it("todos los tipos tienen etiqueta", () => {
    for (const tipo of TIPOS_HISTORIAL) expect(ETIQUETA_TIPO_HISTORIAL[tipo]).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verificar que falla** — `pnpm test src/domain/tickets/historial-rules.test.ts`. Esperado: FAIL (exportaciones inexistentes).

- [ ] **Step 3: Implementar** — en `src/domain/tickets/historial-rules.ts` cambiar los imports del inicio por:

```ts
import type { Estatus, Ticket } from "@/types/ticket";
import type { Role } from "@/types/user";
import type { VistoBueno } from "@/types/resumen-contrato";
import type { ActorHistorial, CambioCampo, EntradaHistorial, TipoHistorial } from "@/types/historial";
import { nombreDeUrl } from "@/domain/contratos/contrato-rules";
import { findAbogado } from "@/lib/data/abogados";
```

y agregar al final del archivo:

```ts
// abogadoAsignadoId es un id del catalogo ("Nombre - Puesto"); se muestra el nombre.
const textoAbogado = (valor: unknown): string | null =>
  typeof valor === "string" && valor ? findAbogado(valor)?.nombre ?? valor : null;
// Tickets previos no tienen el campo: ausente cuenta como "no".
const textoExclusion = (valor: unknown): string => (valor === true ? "sí" : "no");

export const CAMPOS_ESTATUS: CampoVigilado[] = [
  { campo: "estatus", etiqueta: "Estatus" },
  { campo: "fechaCierre", etiqueta: "Fecha de cierre" },
];

export const CAMPOS_ASIGNACION: CampoVigilado[] = [
  { campo: "abogadoAsignadoId", etiqueta: "Abogado asignado", formato: textoAbogado },
  { campo: "fechaAsignacion", etiqueta: "Fecha de asignacion" },
  { campo: "fechaCompromiso", etiqueta: "Fecha compromiso" },
];

export const CAMPOS_NOTAS_CIERRE: CampoVigilado[] = [{ campo: "notasCierre", etiqueta: "Notas de cierre" }];

// Incluye los derivados del servicio (categoria, puesto, SLA, fecha compromiso): solo aparecen si cambian.
export function camposSolicitud(nombreServicio: (id: string) => string | null): CampoVigilado[] {
  return [
    { campo: "areaEmpresa", etiqueta: "Area / Empresa" },
    {
      campo: "servicioId",
      etiqueta: "Servicio",
      formato: (valor) => (typeof valor === "string" && valor ? nombreServicio(valor) ?? valor : null),
    },
    { campo: "descripcion", etiqueta: "Descripcion" },
    { campo: "categoria", etiqueta: "Categoria" },
    { campo: "puestoResponsableSugerido", etiqueta: "Puesto responsable sugerido" },
    { campo: "slaInterno", etiqueta: "SLA interno" },
    { campo: "fechaCompromiso", etiqueta: "Fecha compromiso" },
  ];
}

export const CAMPOS_DOCUMENTOS: CampoVigilado[] = [{ campo: "documentacion", etiqueta: "Documentacion", formato: textoDocumentos }];

export const CAMPOS_SITIO: CampoVigilado[] = [{ campo: "sitioArrendamiento", etiqueta: "Sitio" }];

export const CAMPOS_EXCLUSION: CampoVigilado[] = [
  { campo: "excluidoDelPipeline", etiqueta: "Excluido del pipeline", formato: textoExclusion },
];

function nuevaEntrada(
  tipo: TipoHistorial,
  actor: ActorHistorial,
  ahora: Date,
  cambios: CambioCampo[],
  comentarioId?: string
): EntradaHistorial {
  return {
    fecha: ahora.toISOString(),
    actorUid: actor.uid,
    actorNombre: actor.nombre,
    actorRol: actor.rol,
    tipo,
    cambios,
    ...(comentarioId ? { comentarioId } : {}),
  };
}

export function construirEntrada(
  tipo: TipoHistorial,
  actor: ActorHistorial,
  ahora: Date,
  cambios: CambioCampo[],
  comentarioId?: string
): EntradaHistorial | null {
  return cambios.length ? nuevaEntrada(tipo, actor, ahora, cambios, comentarioId) : null;
}

function sinNulos(entradas: (EntradaHistorial | null)[]): EntradaHistorial[] {
  return entradas.filter((e): e is EntradaHistorial => e !== null);
}

export function entradasAsignacion(antes: Ticket, patch: Partial<Ticket>, actor: ActorHistorial, ahora: Date): EntradaHistorial[] {
  return sinNulos([
    construirEntrada("estatus", actor, ahora, calcularCambios(antes, patch, CAMPOS_ESTATUS)),
    construirEntrada("asignacion", actor, ahora, calcularCambios(antes, patch, CAMPOS_ASIGNACION)),
    construirEntrada("notas_cierre", actor, ahora, calcularCambios(antes, patch, CAMPOS_NOTAS_CIERRE)),
  ]);
}

export function entradasSolicitud(
  antes: Ticket,
  patch: Partial<Ticket>,
  actor: ActorHistorial,
  ahora: Date,
  nombreServicio: (id: string) => string | null
): EntradaHistorial[] {
  return sinNulos([
    construirEntrada("solicitud", actor, ahora, calcularCambios(antes, patch, camposSolicitud(nombreServicio))),
    construirEntrada("documentos", actor, ahora, calcularCambios(antes, patch, CAMPOS_DOCUMENTOS)),
  ]);
}

export function entradaSitio(antes: Ticket, patch: Partial<Ticket>, actor: ActorHistorial, ahora: Date): EntradaHistorial | null {
  return construirEntrada("sitio", actor, ahora, calcularCambios(antes, patch, CAMPOS_SITIO));
}

export function entradaExclusion(antes: Ticket, excluido: boolean, actor: ActorHistorial, ahora: Date): EntradaHistorial | null {
  return construirEntrada("exclusion", actor, ahora, calcularCambios(antes, { excluidoDelPipeline: excluido }, CAMPOS_EXCLUSION));
}

export function textoVistoBueno(visto: VistoBueno): string {
  return `${visto.nombre} (${visto.fecha})`;
}

export function entradaVistoBueno(actor: ActorHistorial, ahora: Date, visto: VistoBueno): EntradaHistorial {
  return nuevaEntrada("visto_bueno", actor, ahora, [
    { campo: "vistoBueno", etiqueta: "Visto bueno", antes: null, despues: textoVistoBueno(visto) },
  ]);
}

export interface DatosCambiosSolicitados {
  estatusAntes: Estatus;
  estatusDespues: Estatus;
  vistoBuenoAntes: VistoBueno | null;
  comentarioId: string;
}

export function entradaCambiosSolicitados(actor: ActorHistorial, ahora: Date, datos: DatosCambiosSolicitados): EntradaHistorial {
  const cambios: CambioCampo[] = [
    { campo: "estatus", etiqueta: "Estatus", antes: datos.estatusAntes, despues: datos.estatusDespues },
  ];
  if (datos.vistoBuenoAntes) {
    cambios.push({ campo: "vistoBueno", etiqueta: "Visto bueno", antes: textoVistoBueno(datos.vistoBuenoAntes), despues: null });
  }
  return nuevaEntrada("cambios_solicitados", actor, ahora, cambios, datos.comentarioId);
}

export function entradaComentarioEditado(
  actor: ActorHistorial,
  ahora: Date,
  comentarioId: string,
  textoAnterior: string | null,
  textoNuevo: string
): EntradaHistorial {
  return nuevaEntrada("comentario_editado", actor, ahora, [
    { campo: "texto", etiqueta: "Comentario", antes: textoAnterior, despues: textoNuevo },
  ], comentarioId);
}

export function entradaComentarioEliminado(
  actor: ActorHistorial,
  ahora: Date,
  comentarioId: string,
  textoAnterior: string | null
): EntradaHistorial {
  return nuevaEntrada("comentario_eliminado", actor, ahora, [
    { campo: "texto", etiqueta: "Comentario", antes: textoAnterior, despues: null },
  ], comentarioId);
}

export function actorDesdeSesion(sesion: { uid: string | null; nombre: string | null; role: Role }): ActorHistorial | null {
  if (!sesion.uid) return null;
  return { uid: sesion.uid, nombre: sesion.nombre ?? "", rol: sesion.role };
}

export const ETIQUETA_TIPO_HISTORIAL: Record<TipoHistorial, string> = {
  estatus: "Cambio de estatus",
  asignacion: "Asignacion",
  solicitud: "Edicion de la solicitud",
  documentos: "Documentos",
  sitio: "Sitio",
  exclusion: "Exclusion del pipeline",
  notas_cierre: "Notas de cierre",
  visto_bueno: "Visto bueno",
  cambios_solicitados: "Cambios solicitados",
  comentario_editado: "Comentario editado",
  comentario_eliminado: "Comentario eliminado",
};
```

- [ ] **Step 4: Verificar que pasa** — `pnpm test src/domain/tickets/historial-rules.test.ts`. Esperado: PASS.

- [ ] **Step 5: Verificación completa y commit** — `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (código 0).

```bash
git add src/domain/tickets/historial-rules.ts src/domain/tickets/historial-rules.test.ts
git commit -m "feat: entradas de historial por tipo de cambio"
```

---

### Task 3: Reglas de Firestore del historial (solo disco, verificación manual)

**Files:**
- Modify (en disco, **sin commit**: está en `.gitignore`): `firestore.rules`

**Interfaces:**
- Produces (funciones de reglas que Plan D reutiliza con estos nombres): `esAbogadoAsignado(ticketId)`, `esDuenoTicket(ticketId)`, `entradaHistorialValida()`, `vistoBuenoEnEsteLote(ticketId)`; bloque `match /tickets/{ticketId}/historial/{entradaId}`.

Contexto del archivo actual: funciones globales en las líneas 7-41 (`isSignedIn`, `myRole`, `isLegalStaff`, `isAdmin` —incluye `gerente_juridico`—, `isJefeZona`, `supervisaA`, `emailDominioPermitido`); `match /tickets/{folio}` en las líneas 61-85 (la variable se llama `folio` pero es el id del documento). Las subcolecciones no heredan reglas del documento padre, así que se declaran en un `match` propio.

- [ ] **Step 1: Agregar las funciones** — en `firestore.rules`, inmediatamente después del cierre de `emailDominioPermitido()` (línea 41) y antes de `match /users/{uid}`, insertar:

```
    // ---- Historial de cambios (Plan C) ----
    // abogadoAsignadoId es un id del catalogo (no un uid): se compara con users/{uid}.abogadoId.
    // Sincronizar con puedeVerHistorial en src/domain/tickets/historial-rules.ts.
    function esAbogadoAsignado(ticketId) {
      let abogadoId = get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get("abogadoId", null);
      return abogadoId != null
             && abogadoId == get(/databases/$(database)/documents/tickets/$(ticketId)).data.abogadoAsignadoId;
    }

    function esDuenoTicket(ticketId) {
      return get(/databases/$(database)/documents/tickets/$(ticketId)).data.solicitanteId == request.auth.uid;
    }

    // "cambios_solicitados" no esta en la lista: solo lo escribe el servidor (Admin SDK, Plan D).
    // Sincronizar con TIPOS_HISTORIAL en src/types/historial.ts.
    function entradaHistorialValida() {
      let e = request.resource.data;
      return e.keys().hasOnly(["fecha", "actorUid", "actorNombre", "actorRol", "tipo", "cambios", "comentarioId"])
             && e.keys().hasAll(["fecha", "actorUid", "actorNombre", "actorRol", "tipo", "cambios"])
             && e.actorUid == request.auth.uid
             && e.actorRol == myRole()
             && e.fecha is string
             && e.actorNombre is string
             && e.cambios is list
             && e.tipo in ["estatus", "asignacion", "solicitud", "documentos", "sitio", "exclusion",
                           "notas_cierre", "visto_bueno", "comentario_editado", "comentario_eliminado"];
    }

    // El jefe de zona solo agrega la entrada de SU visto bueno, en el mismo lote que lo fija
    // (antes del lote no habia visto bueno; despues, es el suyo).
    function vistoBuenoEnEsteLote(ticketId) {
      return get(/databases/$(database)/documents/resumenesContrato/$(ticketId)).data.get("vistoBueno", null) == null
             && getAfter(/databases/$(database)/documents/resumenesContrato/$(ticketId)).data.vistoBueno.uid == request.auth.uid;
    }
```

- [ ] **Step 2: Agregar el bloque de la subcolección** — inmediatamente después del cierre de `match /tickets/{folio} { ... }` (después de `allow delete: if isAdmin();` y su `}`), insertar:

```
    // Solo agregar: nadie edita ni borra entradas. Lectura: Admin/Gerente Juridico (isAdmin) y el
    // abogado asignado. Mesa de Control escribe (edita tickets) pero no lee.
    match /tickets/{ticketId}/historial/{entradaId} {
      allow read: if isSignedIn() && (isAdmin() || esAbogadoAsignado(ticketId));

      allow create: if isSignedIn() && entradaHistorialValida()
                    && (isLegalStaff() || isAdmin()
                        || (esDuenoTicket(ticketId) && request.resource.data.tipo in ["solicitud", "documentos"])
                        || (isJefeZona() && request.resource.data.tipo == "visto_bueno" && vistoBuenoEnEsteLote(ticketId)));

      allow update, delete: if false;
    }
```

Conteo de lecturas de documentos por regla (límite 10 por solicitud simple, 20 por lote; las lecturas repetidas del mismo documento se cuentan una vez):
- `read`: `users/{uid}` (myRole/isAdmin y `esAbogadoAsignado`) + `tickets/{ticketId}` = **2**.
- `create`: `users/{uid}` + `tickets/{ticketId}` (dueño) + `resumenesContrato/{ticketId}` con `get` y `getAfter` = **máx. 4**.
- En el lote "ticket + entradas" la regla de `tickets` ya lee `users/{uid}`; total del lote ≤ 4 documentos distintos.

- [ ] **Step 3: Verificación MANUAL (NO EJECUTADA por el plan; la hace el usuario en la consola de Firebase > Firestore > Reglas > Rules Playground, base `epl-tickets`, antes de publicar)**:
  1. `get /tickets/{T}/historial/{E}` autenticado como un usuario con `role: "admin"` → permitido.
  2. Mismo `get` como `gerente_juridico` → permitido.
  3. Como `abogado` cuyo `users/{uid}.abogadoId` es igual a `tickets/{T}.abogadoAsignadoId` → permitido; como otro abogado → denegado.
  4. Como `mesa_control`, `solicitante` dueño y `jefe_zona` → denegado.
  5. `create` como `abogado` con `{fecha, actorUid: <su uid>, actorNombre, actorRol: "abogado", tipo: "estatus", cambios: []}` → permitido; con `actorUid` ajeno → denegado; con `actorRol: "admin"` → denegado; con `tipo: "cambios_solicitados"` → denegado; con una clave extra (`x: 1`) → denegado.
  6. `create` como solicitante dueño con `tipo: "documentos"` → permitido; con `tipo: "estatus"` → denegado.
  7. `update` y `delete` de una entrada como `admin` → denegado.
  8. Visto bueno (no se puede simular un lote en el Playground): publicar las reglas en el proyecto y, con la app del Task 5, dar visto bueno como jefe de zona; confirmar en la consola que aparecen el `vistoBueno` y la entrada `visto_bueno`. Intentar desde la consola del navegador crear una entrada `visto_bueno` suelta (sin el lote) → `permission-denied`.
  Anotar el resultado de cada punto. Publicar las reglas a mano solo cuando todo pase (antes de probar los Tasks 4-5 en la app).

- [ ] **Step 4: Sin commit** — `firestore.rules` está ignorado por git. Confirmar con `git status` que no aparece y que no hay otros cambios pendientes de esta tarea.

---

### Task 4: El servicio escribe el cambio y su historial en el mismo lote

**Files:**
- Modify: `src/domain/tickets/ticket-repository.ts:18-27` (puerto)
- Create: `src/infrastructure/firestore/historial-repository.ts`
- Modify: `src/infrastructure/firestore/ticket-repository.ts:1-4,57-59`
- Modify: `src/domain/tickets/ticket-service.ts:1-12,80-88,134-157`
- Modify: `src/components/tickets/ticket-detail.tsx:67,162-192,257-280`
- Modify: `src/components/tickets/tickets-kanban.tsx:141,179,184`
- Modify: `src/components/configuracion/excluir-tickets-section.tsx:1-14,46-51`
- Test: `src/domain/tickets/ticket-service.test.ts` (reescrito completo)

**Interfaces:**
- Consumes: Task 2 (`entradasAsignacion`, `entradasSolicitud`, `entradaSitio`, `entradaExclusion`, `actorDesdeSesion`), `ActorHistorial`/`EntradaHistorial` (Task 1).
- Produces:
  - `TicketRepository.updateConHistorial(id: string, patch: Partial<Ticket>, entradas: EntradaHistorial[]): Promise<void>` (un `writeBatch`: `update` del ticket + un `set` por entrada).
  - `nuevaEntradaHistorialRef(ticketId: string): DocumentReference` en `src/infrastructure/firestore/historial-repository.ts` (Task 5 y Plan D la usan para meter entradas en otros lotes).
  - Firmas nuevas del servicio (y de `src/lib/tickets.ts`, que las reexporta sin cambios de código):
    - `updateTicketAsignacion(id: string, actor: ActorHistorial, input: AsignacionInput): Promise<void>`
    - `updateTicketSolicitud(id: string, actor: ActorHistorial, input: SolicitudInput): Promise<void>`
    - `updateTicketSitio(id: string, actor: ActorHistorial, sitio: SitioArrendamiento): Promise<void>`
    - `updateTicketExclusion(id: string, actor: ActorHistorial, excluido: boolean): Promise<void>` (ahora lee el ticket; lanza `"Ticket no encontrado."` si no existe)
  - `repo.update` se conserva para `submitSatisfaccion` (`ticket-service.ts:167`) y `backfillSlaHistorico` (`:184`), que no generan entrada.

Hoy `updateTicketAsignacion` hace `await repo.update(id, patch)` (`ticket-service.ts:88`), `updateTicketSolicitud` en la `:142`, `updateTicketSitio` en la `:151` y `updateTicketExclusion` en la `:156`; la implementación usa `updateDoc` (`infrastructure/firestore/ticket-repository.ts:57-59`). Esos cuatro pasan a `updateConHistorial`.

- [ ] **Step 1: Escribir la prueba que falla** — reemplazar **todo** `src/domain/tickets/ticket-service.test.ts` por:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({ deleteTicketDocuments: async () => {} }));
import { createTicketService } from "./ticket-service";
import { buildTicket } from "@/test/ticket-fixture";
import type { Ticket } from "@/types/ticket";
import type { ActorHistorial, EntradaHistorial } from "@/types/historial";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { CatalogoServicio } from "@/types/catalogo";
import type { CatalogoLookup } from "@/domain/catalogo/catalogo-lookup";
import type { ResumenContratoRepository } from "@/domain/contratos/resumen-contrato-repository";
import type { TicketNotifier } from "./ticket-notifier";
import type { TicketRepository } from "./ticket-repository";

type RepoFake = Pick<TicketRepository, "getById" | "update" | "updateConHistorial" | "delete">;
type ResumenesFake = Pick<ResumenContratoRepository, "get" | "upsert" | "updateEstatus" | "delete">;

interface Lote {
  id: string;
  patch: Partial<Ticket>;
  entradas: EntradaHistorial[];
}

const servicioFake = { servicio: "x", categoria: "Contratos", puestoResponsable: "Abogado", slaInterno: 3 } as unknown as CatalogoServicio;
const actor: ActorHistorial = { uid: "u1", nombre: "Ana Legal", rol: "admin" };
const actorMesa: ActorHistorial = { uid: "u2", nombre: "Mesa", rol: "mesa_control" };

function notifierFake(avisos: string[] = []): TicketNotifier {
  return {
    ticketCambioEstatus: async (i) => { avisos.push(i.estatus); },
    ticketAsignado: async () => {}, ticketReasignado: async () => {}, ticketCreado: async () => {},
  };
}

function montar(ticket: Ticket, opts: { resumenesRoto?: boolean; lecturas?: Ticket[]; loteRoto?: boolean } = {}) {
  const resumenes = new Map<string, ResumenContrato>();
  const avisos: string[] = [];
  const borrados: string[] = [];
  const lotes: Lote[] = [];
  const repo: RepoFake = {
    getById: async () => {
      const siguiente = opts.lecturas?.shift();
      return { ...(siguiente ?? ticket) };
    },
    update: async (_: string, patch: Partial<Ticket>) => { Object.assign(ticket, patch); },
    updateConHistorial: async (id: string, patch: Partial<Ticket>, entradas: EntradaHistorial[]) => {
      if (opts.loteRoto) throw new Error("lote rechazado");
      lotes.push({ id, patch, entradas });
      Object.assign(ticket, patch);
    },
    delete: async () => {},
  };
  const roto = async () => { throw new Error("boom"); };
  const repoResumenes: ResumenesFake = opts.resumenesRoto
    ? { get: roto, upsert: roto, updateEstatus: async () => {}, delete: roto }
    : {
        get: async (id: string) => resumenes.get(id) ?? null,
        upsert: async (r: ResumenContrato) => { resumenes.set(r.ticketId, r); },
        updateEstatus: async (id: string, estatus: ResumenContrato["estatus"]) => {
          const r = resumenes.get(id); if (r) r.estatus = estatus;
        },
        delete: async (id: string) => { borrados.push(id); resumenes.delete(id); },
      };
  const catalogo: CatalogoLookup = { findServicio: (id: string) => ({ ...servicioFake, servicio: `Servicio ${id}` }) };
  const service = createTicketService(
    repo as unknown as TicketRepository,
    notifierFake(avisos),
    catalogo,
    repoResumenes as unknown as ResumenContratoRepository
  );
  return { service, resumenes, avisos, borrados, lotes };
}

const input = (estatus: Ticket["estatus"]) => ({ estatus, abogadoAsignadoId: null, notasCierre: null });

describe("sincronizacion del resumen de contrato", () => {
  it("al pasar a Pre-Cierre crea el resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"));
    expect(resumenes.get("t1")?.estatus).toBe("Pre-Cierre");
  });

  it("al pasar de Pre-Cierre a Cierre conserva el visto bueno", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"));
    resumenes.get("t1")!.vistoBueno = { uid: "j1", nombre: "Jefe", fecha: "2026-10-08T00:00:00.000Z" };
    await service.updateTicketAsignacion("t1", actor, input("Cierre"));
    expect(resumenes.get("t1")?.estatus).toBe("Cierre");
    expect(resumenes.get("t1")?.vistoBueno?.uid).toBe("j1");
  });

  it("si el ticket regresa a una etapa previa solo actualiza el estatus del resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"));
    await service.updateTicketAsignacion("t1", actor, input("Proceso en tramite"));
    expect(resumenes.get("t1")?.estatus).toBe("Proceso en tramite");
  });

  it("en etapas previas no crea resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Proceso en tramite"));
    expect(resumenes.size).toBe(0);
  });

  it("si el resumen falla, el cambio de estatus ya guardado no se pierde", async () => {
    const ticket = buildTicket({ id: "t1" });
    const { service } = montar(ticket, { resumenesRoto: true });
    await expect(service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"))).resolves.toBeUndefined();
    expect(ticket.estatus).toBe("Pre-Cierre");
  });
});

const CONTRATO_URL = "https://x.test/o/tickets%2Ft1%2F123_CONTRATO_ARRENDAMIENTO.docx?alt=media";
const solicitud = { areaEmpresa: "A", servicioId: "s", descripcion: "d", documentacion: [CONTRATO_URL] };

describe("carrera con la generacion de Gemini", () => {
  const listo = { estado: "listo" as const, extraccion: null, discrepancias: [], contratoNombre: null, generadoEn: null };

  it("al cambiar de estatus usa el resumenContrato mas reciente del ticket", async () => {
    const base = buildTicket({ id: "t1", resumenContrato: { ...listo, estado: "pendiente" } });
    const fresco = buildTicket({ id: "t1", resumenContrato: { ...listo, estado: "listo", discrepancias: [{ campo: "periodo", valorTicket: "a", valorContrato: "b" }] } });
    const { service, resumenes } = montar(base, { lecturas: [{ ...base }, fresco] });
    await service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"));
    expect(resumenes.get("t1")?.discrepancias).toHaveLength(1);
  });
});

describe("refresco del resumen al editar el ticket", () => {
  it("editar la documentacion en Pre-Cierre refresca contratoUrl y conserva el visto bueno", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"));
    expect(resumenes.get("t1")?.contratoUrl).toBeNull();
    resumenes.get("t1")!.vistoBueno = { uid: "j1", nombre: "Jefe", fecha: "2026-10-08T00:00:00.000Z" };
    await service.updateTicketSolicitud("t1", actor, solicitud);
    expect(resumenes.get("t1")?.contratoUrl).toBe(CONTRATO_URL);
    expect(resumenes.get("t1")?.vistoBueno?.uid).toBe("j1");
  });

  it("editar el sitio en Pre-Cierre refresca el sitio del resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Cierre"));
    await service.updateTicketSitio("t1", actorMesa, { clave: "K1", alias: "Sitio Uno" });
    expect(resumenes.get("t1")?.sitioClave).toBe("K1");
    expect(resumenes.get("t1")?.sitioAlias).toBe("Sitio Uno");
  });

  it("editar en una etapa previa no crea resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketSolicitud("t1", actor, solicitud);
    await service.updateTicketSitio("t1", actorMesa, { clave: "K1", alias: "S" });
    expect(resumenes.size).toBe(0);
  });

  it("si el resumen falla, la edicion guardada no se pierde", async () => {
    const ticket = buildTicket({ id: "t1", estatus: "Pre-Cierre" });
    const { service } = montar(ticket, { resumenesRoto: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(service.updateTicketSolicitud("t1", actor, solicitud)).resolves.toBeUndefined();
    await expect(service.updateTicketSitio("t1", actorMesa, { clave: "K1", alias: "S" })).resolves.toBeUndefined();
    expect(ticket.documentacion).toEqual([CONTRATO_URL]);
    expect(ticket.sitioArrendamiento?.clave).toBe("K1");
  });
});

describe("deleteTicket", () => {
  it("borra tambien el resumen de contrato", async () => {
    const { service, borrados } = montar(buildTicket({ id: "t1" }));
    await service.deleteTicket("t1");
    expect(borrados).toEqual(["t1"]);
  });

  it("si borrar el resumen falla, no propaga el error", async () => {
    const { service } = montar(buildTicket({ id: "t1" }), { resumenesRoto: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(service.deleteTicket("t1")).resolves.toBeUndefined();
  });
});

describe("historial en el mismo lote que el cambio", () => {
  it("un cambio de estatus escribe ticket y entrada en una sola operacion", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Proceso en tramite"));
    expect(lotes).toHaveLength(1);
    expect(lotes[0].patch.estatus).toBe("Proceso en tramite");
    expect(lotes[0].entradas).toHaveLength(1);
    expect(lotes[0].entradas[0]).toMatchObject({ tipo: "estatus", actorUid: "u1", actorNombre: "Ana Legal", actorRol: "admin" });
    expect(lotes[0].entradas[0].cambios).toEqual([
      { campo: "estatus", etiqueta: "Estatus", antes: "Recepcion de solicitud", despues: "Proceso en tramite" },
    ]);
  });

  it("historialEstatus (del que depende el SLA) se sigue actualizando aparte", async () => {
    const ticket = buildTicket({ id: "t1" });
    const { service } = montar(ticket);
    await service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"));
    expect(ticket.historialEstatus).toEqual([{ estatus: "Pre-Cierre", fecha: expect.any(String), uid: "u1" }]);
  });

  it("guardar sin cambios efectivos no crea entradas", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Recepcion de solicitud"));
    expect(lotes[0].entradas).toEqual([]);
  });

  it("asignar abogado y escribir notas generan entradas separadas", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, {
      estatus: "Recepcion de solicitud",
      abogadoAsignadoId: "Karina Valenzuela - Abogado Corporativo",
      notasCierre: "Revisar anexo",
    });
    expect(lotes[0].entradas.map((e) => e.tipo)).toEqual(["asignacion", "notas_cierre"]);
    expect(lotes[0].entradas[0].cambios[0]).toEqual({
      campo: "abogadoAsignadoId", etiqueta: "Abogado asignado", antes: null, despues: "Karina Valenzuela",
    });
  });

  it("editar la solicitud registra la edicion y los documentos en el mismo lote", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketSolicitud("t1", actor, solicitud);
    expect(lotes).toHaveLength(1);
    expect(lotes[0].entradas.map((e) => e.tipo)).toEqual(["solicitud", "documentos"]);
    expect(lotes[0].entradas[0].cambios.map((c) => c.campo)).toEqual(["areaEmpresa", "servicioId", "descripcion", "slaInterno"]);
    expect(lotes[0].entradas[1].cambios).toEqual([
      { campo: "documentacion", etiqueta: "Documentacion", antes: null, despues: "CONTRATO_ARRENDAMIENTO.docx" },
    ]);
  });

  it("cambiar el sitio registra antes y despues con el rol de quien lo hizo", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketSitio("t1", actorMesa, { clave: "K1", alias: "Sitio Uno" });
    expect(lotes[0].entradas).toEqual([
      expect.objectContaining({
        tipo: "sitio",
        actorRol: "mesa_control",
        cambios: [{ campo: "sitioArrendamiento", etiqueta: "Sitio", antes: null, despues: "K1 — Sitio Uno" }],
      }),
    ]);
  });

  it("excluir del pipeline registra si/no y repetirlo no agrega entrada", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketExclusion("t1", actor, true);
    await service.updateTicketExclusion("t1", actor, true);
    expect(lotes[0].entradas[0].cambios).toEqual([
      { campo: "excluidoDelPipeline", etiqueta: "Excluido del pipeline", antes: "no", despues: "sí" },
    ]);
    expect(lotes[1].entradas).toEqual([]);
  });

  it("si el lote falla no se guarda nada, no se avisa y el error llega a quien llamo", async () => {
    const ticket = buildTicket({ id: "t1" });
    const { service, avisos } = montar(ticket, { loteRoto: true });
    await expect(service.updateTicketAsignacion("t1", actor, input("Proceso en tramite"))).rejects.toThrow("lote rechazado");
    expect(ticket.estatus).toBe("Recepcion de solicitud");
    expect(avisos).toEqual([]);
  });
});
```

- [ ] **Step 2: Verificar que falla** — `pnpm test src/domain/tickets/ticket-service.test.ts`. Esperado: FAIL (las pruebas nuevas no encuentran lotes: el servicio todavía llama `repo.update`; `tsc` también marcaría `updateConHistorial` inexistente en el puerto).

- [ ] **Step 3: Implementar el puerto** — en `src/domain/tickets/ticket-repository.ts` agregar el import y el método:

```ts
import type { EntradaHistorial } from "@/types/historial";
```

Dentro de `interface TicketRepository`, después de `update(id: string, patch: Partial<Ticket>): Promise<void>;`:

```ts
  // Ticket y entradas de historial en un solo lote: o se guardan todos o ninguno.
  updateConHistorial(id: string, patch: Partial<Ticket>, entradas: EntradaHistorial[]): Promise<void>;
```

- [ ] **Step 4: Implementar la infraestructura** — crear `src/infrastructure/firestore/historial-repository.ts`:

```ts
import { collection, doc, type DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Referencia nueva (id autogenerado) en tickets/{ticketId}/historial, para agregarla a un writeBatch.
export function nuevaEntradaHistorialRef(ticketId: string): DocumentReference {
  return doc(collection(db, "tickets", ticketId, "historial"));
}
```

En `src/infrastructure/firestore/ticket-repository.ts`, línea 2 del import, agregar `writeBatch`:

```ts
  collection, doc, runTransaction, query, where, onSnapshot, getDoc, getDocs, updateDoc, deleteDoc, limit, writeBatch,
```

agregar el import:

```ts
import { nuevaEntradaHistorialRef } from "./historial-repository";
```

y, inmediatamente después del método `update` (líneas 57-59):

```ts
  async updateConHistorial(id, patch, entradas) {
    const batch = writeBatch(db);
    batch.update(doc(db, "tickets", id), patch);
    for (const entrada of entradas) batch.set(nuevaEntradaHistorialRef(id), entrada);
    await batch.commit();
  },
```

- [ ] **Step 5: Implementar el servicio** — en `src/domain/tickets/ticket-service.ts`:

Agregar imports (después de la línea 12):

```ts
import type { ActorHistorial } from "@/types/historial";
import { entradaExclusion, entradaSitio, entradasAsignacion, entradasSolicitud } from "./historial-rules";
```

Reemplazar las líneas 80-88 (inicio de `updateTicketAsignacion` hasta `await repo.update(id, patch);`) por:

```ts
  async function updateTicketAsignacion(id: string, actor: ActorHistorial, input: AsignacionInput): Promise<void> {
    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");

    const ahora = new Date();
    const { patch, esNuevaAsignacion, esReasignacion, esCambioEstatus } = calcularPatchAsignacion(
      current, input, actor.uid, ahora
    );
    const estatusPrevio = current.estatus;
    await repo.updateConHistorial(id, patch, entradasAsignacion(current, patch, actor, ahora));
```

(el resto de la función, desde `if (esCambioEstatus) {` en la línea 90, queda igual).

Reemplazar `updateTicketSolicitud`, `updateTicketSitio` y `updateTicketExclusion` (líneas 134-157) por:

```ts
  async function updateTicketSolicitud(id: string, actor: ActorHistorial, input: SolicitudInput): Promise<void> {
    const servicio = catalogo.findServicio(input.servicioId);
    if (!servicio) throw new Error("Servicio no encontrado en el catalogo.");

    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");

    const ahora = new Date();
    const patch = calcularPatchSolicitud(current, input, servicio);
    const nombreServicio = (servicioId: string) => catalogo.findServicio(servicioId)?.servicio ?? null;
    await repo.updateConHistorial(id, patch, entradasSolicitud(current, patch, actor, ahora, nombreServicio));
    await refrescarResumenSiVisible({ ...current, ...patch } as Ticket);
  }

  async function updateTicketSitio(id: string, actor: ActorHistorial, sitio: SitioArrendamiento): Promise<void> {
    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");

    const ahora = new Date();
    const patch = calcularPatchSitio(sitio, actor.uid, ahora);
    const entrada = entradaSitio(current, patch, actor, ahora);
    await repo.updateConHistorial(id, patch, entrada ? [entrada] : []);
    await refrescarResumenSiVisible({ ...current, ...patch } as Ticket);
  }

  async function updateTicketExclusion(id: string, actor: ActorHistorial, excluido: boolean): Promise<void> {
    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");

    const entrada = entradaExclusion(current, excluido, actor, new Date());
    await repo.updateConHistorial(id, { excluidoDelPipeline: excluido }, entrada ? [entrada] : []);
  }
```

- [ ] **Step 6: Verificar que pasa** — `pnpm test src/domain/tickets/ticket-service.test.ts`. Esperado: PASS (todas, incluidas las previas).

- [ ] **Step 7: Migrar quienes llaman** (`pnpm exec tsc --noEmit` los señala):

`src/components/tickets/ticket-detail.tsx`:
- Línea 67: `const { uid, role, abogadoId } = useAuthStore();` → `const { uid, nombre, role, abogadoId } = useAuthStore();`
- Agregar el import `import { actorDesdeSesion } from "@/domain/tickets/historial-rules";` junto a los demás imports de `@/domain/...`.
- Después de la línea 72 (`const puedeAsignarAbogado = ...`), agregar: `const actor = actorDesdeSesion({ uid, nombre, role });`
- En `handleGuardarSitio` (línea 162): primera línea del cuerpo `if (!sitioCompleto || !actor) return;` (reemplaza `if (!sitioCompleto) return;`) y la llamada de la línea 167 queda `await updateTicketSitio(id, actor, sitioForm);`.
- En `handleGuardar` (línea 176): primera línea del cuerpo `if (!actor) return;` y la llamada de la línea 181 queda `await updateTicketAsignacion(id, actor, {`.
- En `handleGuardarSolicitud` (línea 257): primera línea del cuerpo `if (!actor) return;` y la llamada de la línea 264 queda `await updateTicketSolicitud(id, actor, {`.

`src/components/tickets/tickets-kanban.tsx`:
- Agregar `import { actorDesdeSesion } from "@/domain/tickets/historial-rules";`.
- Línea 141: `const { uid, role } = useAuthStore();` → `const { uid, nombre, role } = useAuthStore();`
- Línea 179: reemplazar `if (!ticket || nuevoEstatus === ticket.estatus || !uid) return;` por:

```ts
    const actor = actorDesdeSesion({ uid, nombre, role });
    if (!ticket || nuevoEstatus === ticket.estatus || !actor) return;
```

- Línea 184: `await updateTicketAsignacion(ticket.id, uid, {` → `await updateTicketAsignacion(ticket.id, actor, {`.

`src/components/configuracion/excluir-tickets-section.tsx`:
- Agregar imports:

```ts
import { useAuthStore } from "@/stores/auth";
import { actorDesdeSesion } from "@/domain/tickets/historial-rules";
```

- Al inicio del componente (después de `const { tickets, loading } = useTickets({ incluirExcluidos: true });`), tres selectores primitivos (un selector que devuelva un objeto nuevo provoca renders infinitos con zustand 5):

```ts
  const uid = useAuthStore((s) => s.uid);
  const nombre = useAuthStore((s) => s.nombre);
  const role = useAuthStore((s) => s.role);
```

- En `aplicar` (línea 46), primeras líneas del cuerpo:

```ts
    const actor = actorDesdeSesion({ uid, nombre, role });
    if (!actor) return;
```

  y la línea 51 queda `await Promise.all(objetivo.map((t) => updateTicketExclusion(t.id, actor, excluido)));`.

- [ ] **Step 8: Verificación completa** — `pnpm test && pnpm exec tsc --noEmit && pnpm lint`. Los tres con código 0.

- [ ] **Step 9: Verificación manual (NO EJECUTADA por el plan; requiere las reglas del Task 3 publicadas)** — `pnpm dev`:
  1. Como admin, cambiar el estatus de un ticket de prueba en el detalle: en la consola de Firestore aparece `tickets/{id}/historial/{x}` con `tipo: "estatus"`, antes/después correctos, y `historialEstatus` del ticket sigue creciendo.
  2. Arrastrar un ticket en el kanban: misma verificación.
  3. Como solicitante dueño, editar descripción y agregar un archivo: aparecen entradas `solicitud` y `documentos` (documentos por nombre, sin URL).
  4. Como mesa de control, cambiar el sitio: entrada `sitio`.
  5. En Configuración > Mantenimiento, excluir un ticket: entrada `exclusion` ("no" → "sí").
  6. Guardar el formulario sin cambiar nada: no aparece entrada nueva.
  Anotar resultados.

- [ ] **Step 10: Commit** (solo si el Step 8 terminó con código 0):

```bash
git add src/domain/tickets/ticket-repository.ts src/infrastructure/firestore/historial-repository.ts src/infrastructure/firestore/ticket-repository.ts src/domain/tickets/ticket-service.ts src/domain/tickets/ticket-service.test.ts src/components/tickets/ticket-detail.tsx src/components/tickets/tickets-kanban.tsx src/components/configuracion/excluir-tickets-section.tsx
git commit -m "feat: el servicio escribe el cambio y su historial en un solo lote"
```

---

### Task 5: Visto bueno con su entrada de historial

**Files:**
- Create: `src/domain/contratos/visto-bueno-rules.ts`
- Test: `src/domain/contratos/visto-bueno-rules.test.ts`
- Modify: `src/domain/contratos/resumen-contrato-repository.ts:1-3,17`
- Modify: `src/infrastructure/firestore/resumen-contrato-repository.ts:1,50-52`
- Modify: `src/lib/resumenes-contrato.ts:1-9`
- Modify: `src/components/pre-cierre/pre-cierre-detalle.tsx:32-71`

**Interfaces:**
- Consumes: `entradaVistoBueno` (Task 2), `nuevaEntradaHistorialRef` (Task 4), `actorDesdeSesion` (Task 2).
- Produces:
  - `prepararVistoBueno(actor: ActorHistorial, ahora: Date): { visto: VistoBueno; entrada: EntradaHistorial }` en `src/domain/contratos/visto-bueno-rules.ts` (archivo propio: `contrato-rules.ts` no puede importar `historial-rules.ts` porque éste ya importa `nombreDeUrl` de aquél — se evita el ciclo).
  - `ResumenContratoRepository.registrarVistoBueno(ticketId: string, visto: VistoBueno, entrada: EntradaHistorial): Promise<void>` (un `writeBatch`).
  - `registrarVistoBueno(ticketId: string, actor: ActorHistorial): Promise<void>` en `src/lib/resumenes-contrato.ts` (antes recibía `{ uid, nombre }`).

- [ ] **Step 1: Escribir la prueba que falla** — crear `src/domain/contratos/visto-bueno-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prepararVistoBueno } from "./visto-bueno-rules";

describe("prepararVistoBueno", () => {
  it("arma el visto bueno y su entrada de historial con la misma fecha", () => {
    const ahora = new Date("2026-10-09T15:00:00.000Z");
    const { visto, entrada } = prepararVistoBueno({ uid: "j1", nombre: "Jefe Uno", rol: "jefe_zona" }, ahora);
    expect(visto).toEqual({ uid: "j1", nombre: "Jefe Uno", fecha: ahora.toISOString() });
    expect(entrada).toMatchObject({ tipo: "visto_bueno", actorUid: "j1", actorRol: "jefe_zona", fecha: ahora.toISOString() });
    expect(entrada.cambios).toEqual([
      { campo: "vistoBueno", etiqueta: "Visto bueno", antes: null, despues: `Jefe Uno (${ahora.toISOString()})` },
    ]);
  });
});
```

- [ ] **Step 2: Verificar que falla** — `pnpm test src/domain/contratos/visto-bueno-rules.test.ts`. Esperado: FAIL (no existe el módulo).

- [ ] **Step 3: Implementar** — crear `src/domain/contratos/visto-bueno-rules.ts`:

```ts
import type { VistoBueno } from "@/types/resumen-contrato";
import type { ActorHistorial, EntradaHistorial } from "@/types/historial";
import { entradaVistoBueno } from "@/domain/tickets/historial-rules";

// El visto bueno y su entrada de historial se guardan juntos (las reglas exigen ambos en el mismo lote).
export function prepararVistoBueno(actor: ActorHistorial, ahora: Date): { visto: VistoBueno; entrada: EntradaHistorial } {
  const visto: VistoBueno = { uid: actor.uid, nombre: actor.nombre, fecha: ahora.toISOString() };
  return { visto, entrada: entradaVistoBueno(actor, ahora, visto) };
}
```

Puerto `src/domain/contratos/resumen-contrato-repository.ts`: agregar `import type { EntradaHistorial } from "@/types/historial";` y cambiar la línea 17 por:

```ts
  // Visto bueno y su entrada de historial en un solo lote.
  registrarVistoBueno(ticketId: string, visto: VistoBueno, entrada: EntradaHistorial): Promise<void>;
```

Infraestructura `src/infrastructure/firestore/resumen-contrato-repository.ts`: en el import de la línea 1 agregar `writeBatch`; agregar `import { nuevaEntradaHistorialRef } from "./historial-repository";` y reemplazar `registrarVistoBueno` (líneas 50-52) por:

```ts
  async registrarVistoBueno(ticketId, visto, entrada) {
    const batch = writeBatch(db);
    batch.update(doc(db, COLECCION, ticketId), { vistoBueno: visto });
    batch.set(nuevaEntradaHistorialRef(ticketId), entrada);
    await batch.commit();
  },
```

Fachada `src/lib/resumenes-contrato.ts` completa:

```ts
import { firestoreResumenContratoRepository as repo } from "@/infrastructure/firestore/resumen-contrato-repository";
import { prepararVistoBueno } from "@/domain/contratos/visto-bueno-rules";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { ActorHistorial } from "@/types/historial";

export const subscribeResumenes = repo.subscribeMany;
export const subscribeResumen = repo.subscribeOne;

export async function registrarVistoBueno(ticketId: string, actor: ActorHistorial): Promise<void> {
  const { visto, entrada } = prepararVistoBueno(actor, new Date());
  await repo.registrarVistoBueno(ticketId, visto, entrada);
}
export type { ResumenContrato };
```

Pantalla `src/components/pre-cierre/pre-cierre-detalle.tsx`:
- Agregar `import { actorDesdeSesion } from "@/domain/tickets/historial-rules";`.
- Después de la línea 35 (`const nombre = useAuthStore((s) => s.nombre);`): `const role = useAuthStore((s) => s.role);`
- `darVistoBueno` (líneas 60-71) queda:

```ts
  async function darVistoBueno() {
    const actor = actorDesdeSesion({ uid, nombre, role });
    if (!actor) return;
    setGuardando(true);
    setError(null);
    try {
      await registrarVistoBueno(id, actor);
    } catch {
      setError("No se pudo registrar el visto bueno. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }
```

- [ ] **Step 4: Verificar** — `pnpm test src/domain/contratos/visto-bueno-rules.test.ts` PASS; luego `pnpm test && pnpm exec tsc --noEmit && pnpm lint` con código 0.

- [ ] **Step 5: Verificación manual (NO EJECUTADA; requiere reglas del Task 3 publicadas)** — como jefe de zona, dar visto bueno a un ticket en Pre-Cierre: en Firestore aparecen `resumenesContrato/{id}.vistoBueno` y `tickets/{id}/historial/{x}` con `tipo: "visto_bueno"` y `actorRol: "jefe_zona"`. Si se publicó la regla sin el Task 5 desplegado, el visto bueno viejo (sin entrada) sigue funcionando: la regla de `resumenesContrato` no cambió.

- [ ] **Step 6: Commit** (solo con el Step 4 en código 0):

```bash
git add src/domain/contratos/visto-bueno-rules.ts src/domain/contratos/visto-bueno-rules.test.ts src/domain/contratos/resumen-contrato-repository.ts src/infrastructure/firestore/resumen-contrato-repository.ts src/lib/resumenes-contrato.ts src/components/pre-cierre/pre-cierre-detalle.tsx
git commit -m "feat: el visto bueno queda en el historial del ticket"
```

---

### Task 6: Lectura del historial: puerto, línea de tiempo y visibilidad

**Files:**
- Create: `src/domain/tickets/historial-repository.ts`
- Modify: `src/infrastructure/firestore/historial-repository.ts` (agregar el repositorio)
- Modify: `src/domain/tickets/historial-rules.ts` (agregar al final)
- Create: `src/lib/historial.ts`, `src/hooks/use-historial.ts`
- Test: `src/domain/tickets/historial-rules.test.ts` (agregar al final)

**Interfaces:**
- Consumes: `RepositoryError`, `Unsubscribe` de `src/domain/tickets/ticket-repository.ts:4-8`; `HistorialEntry` (= entrada de `historialEstatus`) de `src/types/ticket.ts:17`; `isAdminRole` de `src/types/user.ts:17`.
- Produces:
  - `interface HistorialRepository { subscribe(ticketId: string, callback: (entradas: EntradaHistorialGuardada[]) => void, onError?: (e: RepositoryError) => void): Unsubscribe }`.
  - `firestoreHistorialRepository: HistorialRepository` (un solo `orderBy("fecha", "desc")`).
  - `type ItemLineaTiempo = { origen: "historial"; fecha: string; entrada: EntradaHistorialGuardada } | { origen: "estatus"; fecha: string; estatus: Estatus }`.
  - `lineaDeTiempo(entradas: EntradaHistorialGuardada[], historialEstatus: HistorialEntry[]): ItemLineaTiempo[]` — entradas en orden descendente y, al final, las de `historialEstatus` anteriores a la primera entrada (todas si no hay entradas), también descendentes.
  - `puedeVerHistorial(sesion: { role: Role; abogadoId: string | null }, ticket: Pick<Ticket, "abogadoAsignadoId">): boolean` (espejo de la regla de lectura).
  - `subscribeHistorial` en `src/lib/historial.ts`; `useHistorial(ticketId: string): { entradas: EntradaHistorialGuardada[]; loading: boolean; error: boolean }`.

- [ ] **Step 1: Escribir la prueba que falla** — en `src/domain/tickets/historial-rules.test.ts` agregar `lineaDeTiempo` y `puedeVerHistorial` al import de `./historial-rules`, cambiar `import { TIPOS_HISTORIAL, type ActorHistorial } from "@/types/historial";` por `import { TIPOS_HISTORIAL, type ActorHistorial, type EntradaHistorialGuardada } from "@/types/historial";` y, al final:

```ts
describe("lineaDeTiempo", () => {
  const entrada = (id: string, fecha: string): EntradaHistorialGuardada => ({
    id, fecha, actorUid: "u1", actorNombre: "Ana", actorRol: "admin", tipo: "estatus", cambios: [],
  });

  it("entradas en orden descendente y, al final, el historial de estatus previo al despliegue", () => {
    const items = lineaDeTiempo(
      [entrada("a", "2026-10-09T10:00:00.000Z"), entrada("b", "2026-10-10T10:00:00.000Z")],
      [
        { estatus: "Asignacion de responsable", fecha: "2026-10-01T10:00:00.000Z", uid: "x" },
        { estatus: "Proceso en tramite", fecha: "2026-10-02T10:00:00.000Z", uid: "x" },
        { estatus: "Pre-Cierre", fecha: "2026-10-09T10:00:00.000Z", uid: "x" },
      ]
    );
    expect(items.map((i) => (i.origen === "historial" ? i.entrada.id : i.estatus))).toEqual([
      "b", "a", "Proceso en tramite", "Asignacion de responsable",
    ]);
  });

  it("sin entradas muestra todo el historial de estatus", () => {
    const items = lineaDeTiempo([], [{ estatus: "Cierre", fecha: "2026-10-01T10:00:00.000Z", uid: "x" }]);
    expect(items).toEqual([{ origen: "estatus", fecha: "2026-10-01T10:00:00.000Z", estatus: "Cierre" }]);
  });
});

describe("puedeVerHistorial", () => {
  const ticket = { abogadoAsignadoId: "Karina Valenzuela - Abogado Corporativo" };

  it("admin y gerente juridico siempre", () => {
    expect(puedeVerHistorial({ role: "admin", abogadoId: null }, ticket)).toBe(true);
    expect(puedeVerHistorial({ role: "gerente_juridico", abogadoId: null }, ticket)).toBe(true);
  });

  it("el abogado asignado si; otro abogado no", () => {
    expect(puedeVerHistorial({ role: "abogado", abogadoId: "Karina Valenzuela - Abogado Corporativo" }, ticket)).toBe(true);
    expect(puedeVerHistorial({ role: "abogado", abogadoId: "Jessica Valadez - Abogado Comercial" }, ticket)).toBe(false);
  });

  it("mesa de control, solicitante y jefe de zona no", () => {
    expect(puedeVerHistorial({ role: "mesa_control", abogadoId: null }, ticket)).toBe(false);
    expect(puedeVerHistorial({ role: "solicitante", abogadoId: null }, ticket)).toBe(false);
    expect(puedeVerHistorial({ role: "jefe_zona", abogadoId: null }, ticket)).toBe(false);
  });

  it("sin abogado asignado nadie entra por esa via", () => {
    expect(puedeVerHistorial({ role: "abogado", abogadoId: null }, { abogadoAsignadoId: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Verificar que falla** — `pnpm test src/domain/tickets/historial-rules.test.ts`. Esperado: FAIL (`lineaDeTiempo`/`puedeVerHistorial` no existen).

- [ ] **Step 3: Implementar las funciones puras** — en `src/domain/tickets/historial-rules.ts`: cambiar `import type { Estatus, Ticket } from "@/types/ticket";` por `import type { Estatus, HistorialEntry, Ticket } from "@/types/ticket";`, cambiar `import type { Role } from "@/types/user";` por `import { isAdminRole, type Role } from "@/types/user";`, cambiar el import de `@/types/historial` para incluir `EntradaHistorialGuardada`:

```ts
import type { ActorHistorial, CambioCampo, EntradaHistorial, EntradaHistorialGuardada, TipoHistorial } from "@/types/historial";
```

y agregar al final:

```ts
export type ItemLineaTiempo =
  | { origen: "historial"; fecha: string; entrada: EntradaHistorialGuardada }
  | { origen: "estatus"; fecha: string; estatus: Estatus };

// Tickets previos al historial: su historialEstatus se muestra al final, sin detalle de campos.
// Lo posterior a la primera entrada ya esta en el historial (tipo "estatus"), no se repite.
export function lineaDeTiempo(entradas: EntradaHistorialGuardada[], historialEstatus: HistorialEntry[]): ItemLineaTiempo[] {
  const nuevas: ItemLineaTiempo[] = [...entradas]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((entrada) => ({ origen: "historial" as const, fecha: entrada.fecha, entrada }));
  const primera = entradas.reduce<string | null>((min, e) => (min === null || e.fecha < min ? e.fecha : min), null);
  const previas: ItemLineaTiempo[] = (historialEstatus ?? [])
    .filter((h) => primera === null || h.fecha < primera)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((h) => ({ origen: "estatus" as const, fecha: h.fecha, estatus: h.estatus }));
  return [...nuevas, ...previas];
}

// Espejo de "allow read" de tickets/{id}/historial en firestore.rules (isAdmin o abogado asignado).
export function puedeVerHistorial(
  sesion: { role: Role; abogadoId: string | null },
  ticket: Pick<Ticket, "abogadoAsignadoId">
): boolean {
  if (isAdminRole(sesion.role)) return true;
  return !!sesion.abogadoId && sesion.abogadoId === ticket.abogadoAsignadoId;
}
```

- [ ] **Step 4: Verificar que pasa** — `pnpm test src/domain/tickets/historial-rules.test.ts`. Esperado: PASS.

- [ ] **Step 5: Puerto, infraestructura, fachada y hook**

Crear `src/domain/tickets/historial-repository.ts`:

```ts
import type { EntradaHistorialGuardada } from "@/types/historial";
import type { RepositoryError, Unsubscribe } from "./ticket-repository";

// Solo lectura: las entradas se escriben dentro de los lotes de cada cambio (ver updateConHistorial).
export interface HistorialRepository {
  subscribe(
    ticketId: string,
    callback: (entradas: EntradaHistorialGuardada[]) => void,
    onError?: (e: RepositoryError) => void
  ): Unsubscribe;
}
```

Reemplazar `src/infrastructure/firestore/historial-repository.ts` completo por:

```ts
import { collection, doc, onSnapshot, orderBy, query, type DocumentReference, type FirestoreError } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EntradaHistorial } from "@/types/historial";
import type { RepositoryError } from "@/domain/tickets/ticket-repository";
import type { HistorialRepository } from "@/domain/tickets/historial-repository";

function toRepositoryError(err: FirestoreError): RepositoryError {
  return { code: err.code };
}

// Referencia nueva (id autogenerado) en tickets/{ticketId}/historial, para agregarla a un writeBatch.
export function nuevaEntradaHistorialRef(ticketId: string): DocumentReference {
  return doc(collection(db, "tickets", ticketId, "historial"));
}

export const firestoreHistorialRepository: HistorialRepository = {
  // Un solo orderBy sobre un campo: usa el indice automatico, no requiere indice compuesto.
  subscribe(ticketId, callback, onError) {
    return onSnapshot(
      query(collection(db, "tickets", ticketId, "historial"), orderBy("fecha", "desc")),
      (snap) => callback(snap.docs.map((d) => ({ ...(d.data() as EntradaHistorial), id: d.id }))),
      onError ? (err) => onError(toRepositoryError(err)) : undefined
    );
  },
};
```

Crear `src/lib/historial.ts`:

```ts
import { firestoreHistorialRepository as repo } from "@/infrastructure/firestore/historial-repository";

export const subscribeHistorial = repo.subscribe;
export type { EntradaHistorialGuardada } from "@/types/historial";
```

Crear `src/hooks/use-historial.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { subscribeHistorial } from "@/lib/historial";
import type { EntradaHistorialGuardada } from "@/types/historial";

// Solo montar donde puedeVerHistorial() sea verdadero: para los demas las reglas niegan la lectura.
export function useHistorial(ticketId: string) {
  const status = useAuthStore((s) => s.status);
  const [entradas, setEntradas] = useState<EntradaHistorialGuardada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status !== "signed-in") return;
    setLoading(true);
    setError(false);
    return subscribeHistorial(
      ticketId,
      (data) => {
        setEntradas(data);
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      }
    );
  }, [ticketId, status]);

  return { entradas, loading, error };
}
```

- [ ] **Step 6: Verificación completa** — `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (código 0).

- [ ] **Step 7: Commit**:

```bash
git add src/domain/tickets/historial-repository.ts src/infrastructure/firestore/historial-repository.ts src/domain/tickets/historial-rules.ts src/domain/tickets/historial-rules.test.ts src/lib/historial.ts src/hooks/use-historial.ts
git commit -m "feat: lectura del historial y linea de tiempo"
```

---

### Task 7: Sección "Historial" en el detalle del ticket

**Files:**
- Create: `src/components/tickets/historial-panel.tsx`
- Modify: `src/components/tickets/ticket-detail.tsx` (import, cálculo de visibilidad tras la línea 154, render tras la sección "Asignacion y estatus" que cierra en la línea 637)

**Interfaces:**
- Consumes: `useHistorial` (Task 6), `lineaDeTiempo`, `puedeVerHistorial`, `ETIQUETA_TIPO_HISTORIAL` (Tasks 2 y 6), `formatFecha(iso, { conHora: true })` de `src/lib/format-fecha.ts:3`.
- Produces: `HistorialPanel({ ticket }: { ticket: Ticket })`.

- [ ] **Step 1: Crear el componente** — `src/components/tickets/historial-panel.tsx`:

```tsx
"use client";

import { Loader2 } from "lucide-react";
import { useHistorial } from "@/hooks/use-historial";
import { ETIQUETA_TIPO_HISTORIAL, lineaDeTiempo } from "@/domain/tickets/historial-rules";
import { formatFecha } from "@/lib/format-fecha";
import type { Ticket } from "@/types/ticket";

// Solo texto plano: los valores (incluido el texto de comentarios editados) se pintan como texto de React.
export function HistorialPanel({ ticket }: { ticket: Ticket }) {
  const { entradas, loading, error } = useHistorial(ticket.id);
  const items = lineaDeTiempo(entradas, ticket.historialEstatus ?? []);

  return (
    <section className="section-card p-6 space-y-4">
      <h2 className="eyebrow">Historial</h2>

      {loading ? (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger">No se pudo cargar el historial.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Sin cambios registrados.</p>
      ) : (
        <ol className="space-y-4">
          {items.map((item) =>
            item.origen === "historial" ? (
              <li key={item.entrada.id} className="border-l-2 border-border pl-3">
                <p className="text-xs text-muted">
                  {formatFecha(item.fecha, { conHora: true })} · {item.entrada.actorNombre || "Sin nombre"}
                </p>
                <p className="text-sm font-medium">{ETIQUETA_TIPO_HISTORIAL[item.entrada.tipo] ?? item.entrada.tipo}</p>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {item.entrada.cambios.map((c) => (
                    <li key={c.campo} className="whitespace-pre-wrap break-words">
                      <span className="text-muted">{c.etiqueta}:</span> {c.antes ?? "—"} → {c.despues ?? "—"}
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key={`estatus-${item.fecha}-${item.estatus}`} className="border-l-2 border-border pl-3">
                <p className="text-xs text-muted">{formatFecha(item.fecha, { conHora: true })}</p>
                <p className="text-sm font-medium">Cambio de estatus</p>
                <p className="text-sm">
                  {item.estatus} <span className="text-muted">(registro previo, sin detalle)</span>
                </p>
              </li>
            )
          )}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Integrar en el detalle** — en `src/components/tickets/ticket-detail.tsx`:
- Imports: `import { HistorialPanel } from "./historial-panel";` y agregar `puedeVerHistorial` al import de `@/domain/tickets/historial-rules` (agregado en el Task 4): `import { actorDesdeSesion, puedeVerHistorial } from "@/domain/tickets/historial-rules";`.
- Después de la línea 154 (`const puedeCambiarSitio = puedeActualizarSitio(role, ticket);`):

```ts
  // Admin/Gerente Juridico y el abogado asignado (misma condicion que firestore.rules).
  const verHistorial = puedeVerHistorial({ role, abogadoId }, ticket);
```

- Justo después del `</section>` que cierra "Asignacion y estatus" (línea 637) y antes de `{/* Calificacion ...`:

```tsx
      {verHistorial && <HistorialPanel ticket={ticket} />}
```

- [ ] **Step 3: Verificación completa** — `pnpm test && pnpm exec tsc --noEmit && pnpm lint` (código 0).

- [ ] **Step 4: Verificación manual (NO EJECUTADA; no hay pruebas de componentes)** — `pnpm dev`, con las reglas del Task 3 publicadas:
  1. Como admin, abrir un ticket con cambios del Task 4: la sección "Historial" aparece en la columna izquierda, debajo de "Asignacion y estatus", con lo más reciente arriba, fecha, nombre, tipo y cada cambio "antes → después".
  2. Un ticket viejo sin entradas muestra sus cambios de estatus previos al final con "(registro previo, sin detalle)".
  3. Como el abogado asignado: la ve. Como otro abogado, mesa de control y solicitante dueño: la sección no aparece (y la consola del navegador no muestra `permission-denied`).
  4. En pantallas angostas (< lg) la sección no rompe el ancho; textos largos se parten.
  Anotar resultados.

- [ ] **Step 5: Commit**:

```bash
git add src/components/tickets/historial-panel.tsx src/components/tickets/ticket-detail.tsx
git commit -m "feat: seccion Historial en el detalle del ticket"
```

---

## Self-review against the spec

| Requisito (spec Parte 1) | Task |
|---|---|
| Subcolección `tickets/{id}/historial` con `fecha`, `actorUid/Nombre/Rol`, `tipo` (11 tipos), `cambios[]` | 1 (tipos) |
| Valores legibles: documentos por nombre, fechas ISO, booleanos sí/no | 1 (`textoDeValor`, `textoDocumentos`) |
| `calcularCambios(antes, despues, campos)` pura, solo campos vigilados, omite sin cambio; derivados dentro de `solicitud` solo si cambian | 1, 2 (`camposSolicitud`) |
| Construcción de entradas por tipo (estatus, asignación, solicitud, documentos, sitio, exclusión, notas de cierre, visto bueno, cambios solicitados, comentario editado/eliminado) | 2 |
| `updateTicketAsignacion`, `updateTicketSolicitud`, `updateTicketSitio`, `updateTicketExclusion` y documentos escriben en el mismo `writeBatch` | 4 (documentos viajan en `updateTicketSolicitud`, igual que hoy en `ticket-detail.tsx:264`) |
| `historialEstatus` se conserva (SLA) | 4 (prueba "historialEstatus ... se sigue actualizando aparte"); `asignacion-rules.ts` no cambia |
| Sin cambios efectivos no hay entrada | 2, 4 |
| Puerto `HistorialRepository` + implementación Firestore (patrón `ResumenContratoRepository`) | 6 (lectura), 4 (`nuevaEntradaHistorialRef` para los lotes) |
| Reglas: read `isAdmin()` o abogado asignado; create `actorUid == uid` y Legal/admin, dueño solo `solicitud`/`documentos`; update/delete denegados | 3 |
| Pantalla "Historial" descendente, solo para quien la regla permite, con `historialEstatus` previo al final, sin migración | 6 (`lineaDeTiempo`, `puedeVerHistorial`), 7 |
| Pruebas unitarias: `calcularCambios`, entradas por tipo, servicio escribe cambio e historial en el mismo lote (repos falsos) | 1, 2, 4 |
| Reglas y pantallas: verificación manual | 3, 4, 5, 7 |

Ambigüedades resueltas en este plan:
- **Varias entradas por guardado:** un mismo "Guardar" del detalle puede generar hasta tres entradas (`estatus`, `asignacion`, `notas_cierre`), todas en el mismo lote. `fechaCierre` va dentro de `estatus`; `fechaAsignacion`/`fechaCompromiso` dentro de `asignacion`.
- **Actor completo:** el spec pide `actorNombre`/`actorRol`; los métodos reciben `ActorHistorial` en lugar del uid (cambian 4 firmas y sus 3 componentes llamadores).
- **Visto bueno:** el spec lo lista como tipo registrado pero su regla de `create` no deja escribir al jefe de zona; se agrega la rama `isJefeZona() && tipo == "visto_bueno" && vistoBuenoEnEsteLote()` (ver "Spec issues found").
- **`comentarioId`:** se agrega como clave opcional de la entrada (la usa Plan D para validar con `getAfter` que quien escribe es el autor del comentario).
- **`cambios_solicitados`** queda fuera de la lista de tipos que el cliente puede crear: solo lo escribe el servidor (Plan D).
- **Línea de tiempo:** de `historialEstatus` solo se muestran los registros anteriores a la primera entrada, para no duplicar los cambios de estatus ya registrados.

## Spec issues found

1. **El jefe de zona no puede escribir su entrada `visto_bueno` con la regla del spec.** El spec registra vistos buenos en el historial, pero su regla `create` solo admite Legal/admin y al dueño (solicitud/documentos). Resuelto: rama extra para `jefe_zona` limitada a `tipo == "visto_bueno"` y validada con `get`/`getAfter` sobre `resumenesContrato/{id}` (Task 3).
2. **RESUELTO POR EL USUARIO — "Abogado asignado" por `users.abogadoId` sin importar el rol.** La regla compara `users/{uid}.abogadoId` con `tickets/{id}.abogadoAsignadoId`; el catálogo `ABOGADOS` incluye a "Andres Medina - Mesa de Control". Decisión confirmada: si el ticket está asignado a esa persona, ella es la responsable, ve el historial y participa en el hilo; Mesa de Control en general sigue fuera. Se implementa la regla literal (y `puedeVerHistorial` la refleja). Registrado también en la tabla de decisiones del spec.
3. **`deleteTicket` deja huérfanas las subcolecciones.** Firestore no borra subcolecciones en cascada y las reglas niegan `delete` en `historial`: al borrar un ticket, sus entradas quedan (legibles solo por admin; la rama del abogado falla porque `get(tickets/...)` ya no existe). Se deja así (el spec dice que `deleteTicket` no escribe entrada); limpiarlas requeriría una ruta de servidor.
4. **Despliegue acoplado:** sin la regla de `historial` publicada, todo `updateConHistorial` falla (incluido el cambio del ticket). No es un defecto del spec, pero obliga a publicar las reglas del Task 3 antes de desplegar el código (ver Global Constraints).
