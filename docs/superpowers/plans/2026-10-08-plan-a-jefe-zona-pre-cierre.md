# Jefe de Zona y etapa Pre-Cierre — Plan A

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar el rol `jefe_zona`, la etapa `Pre-Cierre` y una vista restringida (colección `resumenesContrato`) donde el jefe de zona consulta el resumen de contrato de los tickets en Pre-Cierre/Cierre y registra su visto bueno.

**Architecture:** El jefe de zona nunca lee `tickets`: lee `resumenesContrato/{ticketId}`, un documento derivado que Legal/admin escriben desde el cliente al mover el ticket a Pre-Cierre/Cierre (mismo patrón que el resto de la app: Firestore SDK de cliente + reglas). Las reglas de Firestore son la autoridad de permisos. El resumen se arma a partir de datos del ticket; los campos de pago de Gemini (Plan B) viajan en `ticket.resumenContrato` y se copian al resumen cuando existen.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Firebase (Firestore client SDK + firebase-admin), vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-08-jefe-zona-pre-cierre-gemini-design.md`

## Global Constraints

- Etapa nueva: texto exacto `"Pre-Cierre"`, entre `"Validacion y presentacion de requerimiento"` y `"Cierre"` en `ESTATUS_VALUES`.
- Rol nuevo: `jefe_zona`. No pertenece a `LEGAL_STAFF_ROLES`, `ADMIN_LIKE_ROLES` ni `SOLICITANTE_ROLES`. Sí a `STAFF_ROLES` (cuenta de correo+contraseña creada desde el panel de Usuarios).
- El jefe de zona ve **todos** los tickets en Pre-Cierre y Cierre (sin filtro por zona). Solo lectura, salvo registrar el visto bueno.
- El visto bueno **no mueve** la etapa y **no bloquea** el cierre.
- El jefe de zona no lee la colección `tickets` (reglas de Firestore).
- Texto de UI y mensajes en español sin acentos en identificadores y reglas, igual que el código existente; los textos visibles siguen el estilo actual del repo (sin acentos en los strings existentes).
- `firestore.rules` se sincroniza a mano con `src/types/user.ts`: ambos cambian en el mismo task.
- Comandos: `pnpm test` (vitest run), `pnpm exec tsc --noEmit` para tipos, `pnpm lint`.
- No hacer commit ni push sin que el usuario lo pida; los pasos "Commit" abajo solo se ejecutan si el usuario lo autoriza.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/types/user.ts` (mod) | Rol `jefe_zona`, helper `esJefeZona` |
| `src/types/ticket.ts` (mod) | Etapa `Pre-Cierre`; campo opcional `resumenContrato` y `vistoBueno` no (vive en el resumen) |
| `src/types/resumen-contrato.ts` (nuevo) | Tipos `ResumenContrato`, `ExtraccionContrato` |
| `src/domain/contratos/contrato-rules.ts` (nuevo) | `encontrarContrato`, `nombreDeUrl`, `construirResumenContrato`, `accionResumen`, `etapaVisibleParaJefeZona` |
| `src/domain/contratos/resumen-contrato-repository.ts` (nuevo) | Puerto del repositorio |
| `src/infrastructure/firestore/resumen-contrato-repository.ts` (nuevo) | Implementación Firestore |
| `src/domain/tickets/ticket-service.ts` (mod) | Sincroniza el resumen al cambiar de etapa |
| `src/lib/tickets.ts` (mod) | Cableado de la nueva dependencia |
| `src/lib/resumenes-contrato.ts` (nuevo) | Fachada cliente: suscripción y visto bueno |
| `src/hooks/use-resumenes-contrato.ts` (nuevo) | Hook de lista / detalle |
| `src/app/(app)/pre-cierre/page.tsx`, `[id]/page.tsx` (nuevos) | Vistas del jefe de zona |
| `src/components/pre-cierre/*` (nuevos) | Tabla y detalle del resumen |
| `firestore.rules` (mod) | Rol, lectura/escritura de `resumenesContrato` |
| notificaciones (varios, mod) | Tipo `pre_cierre` y destinatarios |

---

### Task 1: Rol `jefe_zona`

**Files:**
- Modify: `src/types/user.ts:1,6`
- Modify: `src/domain/notificaciones/preferencias-rules.ts:9-17`
- Modify: `src/components/configuracion/usuarios-panel.tsx:20-29`
- Modify: `src/types/user.test.ts`

**Interfaces:**
- Produces: `Role` incluye `"jefe_zona"`; `esJefeZona(role: Role | null | undefined): boolean`; `STAFF_ROLES` incluye `jefe_zona`.

- [ ] **Step 1: Escribir la prueba que falla** — agregar al final de `src/types/user.test.ts` (y agregar `esJefeZona` al import de `./user`):

```ts
describe("jefe_zona", () => {
  it("esJefeZona solo es verdadero para ese rol", () => {
    expect(esJefeZona("jefe_zona")).toBe(true);
    expect(esJefeZona("gerente_area")).toBe(false);
    expect(esJefeZona("admin")).toBe(false);
    expect(esJefeZona(null)).toBe(false);
    expect(esJefeZona(undefined)).toBe(false);
  });

  it("se crea con correo y contrasena desde el panel de Usuarios", () => {
    expect(STAFF_ROLES).toContain("jefe_zona");
  });

  it("no es staff de Legal, ni admin, ni solicitante", () => {
    expect(LEGAL_STAFF_ROLES).not.toContain("jefe_zona");
    expect(isAdminRole("jefe_zona")).toBe(false);
    expect(isSolicitanteRole("jefe_zona")).toBe(false);
  });
});
```

- [ ] **Step 2: Verificar que falla** — `pnpm test src/types/user.test.ts`. Esperado: FAIL (`esJefeZona` no existe / tipo no asignable).

- [ ] **Step 3: Implementar**

En `src/types/user.ts` línea 1:

```ts
export type Role = "solicitante" | "gerente_area" | "mesa_control" | "abogado" | "gerente_juridico" | "admin" | "jefe_zona";
```

Línea 6 (`STAFF_ROLES`) y helper al final del bloque de helpers (antes de `AppUser`):

```ts
export const STAFF_ROLES: Role[] = ["mesa_control", "abogado", "gerente_juridico", "admin", "jefe_zona"];
```

```ts
// Solo consulta tickets en Pre-Cierre/Cierre, a traves de resumenesContrato (ver firestore.rules).
// No lee la coleccion tickets. Sincronizar a mano con firestore.rules isJefeZona().
export function esJefeZona(role: Role | null | undefined): boolean {
  return role === "jefe_zona";
}
```

En `src/domain/notificaciones/preferencias-rules.ts`, dentro de `CORREOS_POR_ROL` agregar (se llena en el Task 6):

```ts
  jefe_zona: [],
```

En `src/components/configuracion/usuarios-panel.tsx` agregar `jefe_zona: "Jefe de Zona",` a `ROLE_LABEL` y `"jefe_zona"` al final de `ROLE_OPTIONS`.

- [ ] **Step 4: Verificar** — `pnpm test src/types/user.test.ts` PASS; `pnpm exec tsc --noEmit` sin errores nuevos (los `Record<Role, …>` fuerzan a cubrir el rol; si aparece otro, agregar `jefe_zona` ahí con el valor análogo a `abogado`/`[]`).

- [ ] **Step 5: Revisar que el jefe de zona no sea tratado como "ve todo"**

`uidsConsultaTickets` devuelve `null` (= todos) para cualquier rol no solicitante. Agregar la prueba y el guard en `src/domain/tickets/visibilidad-rules.ts`: el jefe de zona devuelve `[]` (ninguna consulta de tickets).

Prueba en `visibilidad-rules.test.ts`:

```ts
it("el jefe de zona no consulta tickets (usa resumenesContrato)", () => {
  expect(uidsConsultaTickets({ uid: "j1", role: "jefe_zona" })).toEqual([]);
});
```

Implementación (primera línea de la función):

```ts
  if (esJefeZona(filtro.role)) return [];
```
(importar `esJefeZona` de `@/types/user`). En `ticket-repository.ts` `subscribeMany`, `consultas` queda vacío; `emitir` con arreglo vacío llama `callback([])` solo si se invoca: agregar `if (consultas.length === 0) { callback([]); return () => {}; }` justo después de calcular `consultas`.

- [ ] **Step 6: Commit** (si el usuario lo autoriza)

```bash
git add src/types/user.ts src/types/user.test.ts src/domain/notificaciones/preferencias-rules.ts src/components/configuracion/usuarios-panel.tsx src/domain/tickets/visibilidad-rules.ts src/domain/tickets/visibilidad-rules.test.ts src/infrastructure/firestore/ticket-repository.ts
git commit -m "feat: agrega el rol jefe_zona"
```

---

### Task 2: Etapa `Pre-Cierre`

**Files:**
- Modify: `src/types/ticket.ts:3-11`
- Modify: `src/components/ui/badge.tsx:52-60`
- Modify: `src/lib/dashboard-stats.ts:16-19,70`
- Test: `src/lib/dashboard-stats.test.ts`

**Interfaces:**
- Produces: `Estatus` incluye `"Pre-Cierre"`; `ESTATUS_TONE["Pre-Cierre"] = "orange"`.

- [ ] **Step 1: Prueba que falla** — en `src/lib/dashboard-stats.test.ts` (usar `buildTicket` de `@/test/ticket-fixture`):

```ts
it("Pre-Cierre cuenta como activo y aparece en porEstatus", () => {
  const stats = computeDashboardStats(
    [buildTicket({ id: "a", estatus: "Pre-Cierre" }), buildTicket({ id: "b", estatus: "Cierre" })],
    []
  );
  expect(stats.activos).toBe(1);
  expect(stats.cerrados).toBe(1);
  expect(stats.porEstatus.find((e) => e.label === "Pre-Cierre")?.value).toBe(1);
});
```

- [ ] **Step 2:** `pnpm test src/lib/dashboard-stats.test.ts` → FAIL (tipo `"Pre-Cierre"` no asignable).

- [ ] **Step 3: Implementar** — en `ESTATUS_VALUES` insertar `"Pre-Cierre",` entre `"Validacion y presentacion de requerimiento",` y `"Cierre",`. En `badge.tsx` agregar `"Pre-Cierre": "orange",` entre las líneas de "Validacion y presentacion…" y "Cierre", y actualizar el comentario `(7 etapas…)` a `(8 etapas…)`. `computeDashboardStats` y `ticketsParaKpi` ya cuentan `activos` como `!== "Cierre"`: no requieren cambio. El kanban itera `ESTATUS_VALUES` (`tickets-kanban.tsx:215`), así que aparece la columna sola; verificar a ojo en el Step 5.

- [ ] **Step 4:** `pnpm test` completo → PASS; `pnpm exec tsc --noEmit` limpio.

- [ ] **Step 5: Verificación manual** — `pnpm dev`, abrir `/tickets` en vista kanban con un usuario de Legal: debe verse la columna "Pre-Cierre" entre "Validacion y presentacion…" y "Cierre"; arrastrar un ticket de prueba a ella persiste el cambio.

- [ ] **Step 6: Commit** (si se autoriza): `feat: agrega la etapa Pre-Cierre`.

---

### Task 3: Reglas puras del resumen de contrato

**Files:**
- Create: `src/types/resumen-contrato.ts`
- Create: `src/domain/contratos/contrato-rules.ts`
- Modify: `src/types/ticket.ts` (campo `resumenContrato?`)
- Test: `src/domain/contratos/contrato-rules.test.ts`

**Interfaces:**
- Produces (todo lo usa el Plan B):

```ts
// src/types/resumen-contrato.ts
export type FormaPago = "mensual" | "bimestral" | "trimestral" | "semestral" | "anual" | "bianual" | "otra";
export type EstadoResumen = "pendiente" | "listo" | "error" | "sin_contrato";

export interface Discrepancia { campo: "domicilio" | "periodo" | "arrendador"; valorTicket: string; valorContrato: string; }

// Lo que Gemini extrae del contrato (Plan B). null = no consta en el contrato.
export interface ExtraccionContrato {
  sitio: string | null; codigo: string | null; domicilio: string | null; altaArrendador: string | null;
  solicitante: string | null; periodoInicio: string | null; periodoFin: string | null;
  condicionesPago: string | null; montoPagoAnual: number | null; formaPago: FormaPago | null;
}

// Vive en tickets/{id}.resumenContrato (lo escribe el servidor, Plan B).
export interface ResumenContratoTicket {
  estado: EstadoResumen;
  extraccion: ExtraccionContrato | null;
  discrepancias: Discrepancia[];
  contratoNombre: string | null;
  generadoEn: string | null; // ISO
  error?: string;
}

export interface VistoBueno { uid: string; nombre: string; fecha: string; }

// Documento resumenesContrato/{ticketId}: lo unico que ve el jefe de zona.
export interface ResumenContrato {
  ticketId: string; folio: string; estatus: Estatus;
  sitioClave: string | null; sitioAlias: string | null;
  domicilio: string | null; solicitante: string; altaArrendador: string | null;
  periodoInicio: string | null; periodoFin: string | null;
  condicionesPago: string | null; montoPagoAnual: number | null; formaPago: FormaPago | null;
  discrepancias: Discrepancia[];
  contratoUrl: string | null; contratoNombre: string | null;
  estadoResumen: EstadoResumen;
  vistoBueno: VistoBueno | null;
  actualizadoEn: string; // ISO
}
```

```ts
// src/domain/contratos/contrato-rules.ts
export function nombreDeUrl(url: string): string;
export function encontrarContrato(documentacion: string[]): string | null; // URL del primer .docx cuyo nombre contiene CONTRATO_ARRENDAMIENTO
export function construirResumenContrato(ticket: Ticket, ahora: Date, previo?: ResumenContrato | null): ResumenContrato;
export function accionResumen(estatusPrevio: Estatus, estatusNuevo: Estatus): "upsert" | "actualizar-estatus" | "ninguna";
export const ETAPAS_VISIBLES_JEFE_ZONA: readonly Estatus[]; // ["Pre-Cierre", "Cierre"]
```

- [ ] **Step 1: Pruebas que fallan** — crear `src/domain/contratos/contrato-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { accionResumen, construirResumenContrato, encontrarContrato, nombreDeUrl } from "./contrato-rules";
import { buildTicket } from "@/test/ticket-fixture";

const url = (nombre: string) =>
  `https://firebasestorage.googleapis.com/v0/b/tickets-epl-legal/o/tickets%2Ft1%2F${encodeURIComponent(nombre)}?alt=media&token=abc`;

describe("nombreDeUrl", () => {
  it("devuelve el nombre del archivo sin la ruta ni el prefijo de timestamp", () => {
    expect(nombreDeUrl(url("1700000000_SITIO_CONTRATO_ARRENDAMIENTO_V2.docx"))).toBe("SITIO_CONTRATO_ARRENDAMIENTO_V2.docx");
  });
  it("con una URL invalida devuelve cadena vacia", () => {
    expect(nombreDeUrl("no-es-url")).toBe("");
  });
});

describe("encontrarContrato", () => {
  it("encuentra el docx cuyo nombre contiene CONTRATO_ARRENDAMIENTO", () => {
    const docs = [url("1_predial.pdf"), url("2_QRO01_CONTRATO_ARRENDAMIENTO_FINAL.docx")];
    expect(encontrarContrato(docs)).toBe(docs[1]);
  });
  it("ignora mayusculas y minusculas", () => {
    const docs = [url("3_qro01_contrato_arrendamiento.DOCX")];
    expect(encontrarContrato(docs)).toBe(docs[0]);
  });
  it("no toma archivos que no son docx", () => {
    expect(encontrarContrato([url("1_CONTRATO_ARRENDAMIENTO.pdf")])).toBeNull();
  });
  it("sin coincidencia devuelve null", () => {
    expect(encontrarContrato([url("1_otro.docx")])).toBeNull();
    expect(encontrarContrato([])).toBeNull();
  });
  it("con varios, toma el primero", () => {
    const docs = [url("1_A_CONTRATO_ARRENDAMIENTO.docx"), url("2_B_CONTRATO_ARRENDAMIENTO.docx")];
    expect(encontrarContrato(docs)).toBe(docs[0]);
  });
});

describe("accionResumen", () => {
  it.each([
    ["Proceso en tramite", "Pre-Cierre", "upsert"],
    ["Validacion y presentacion de requerimiento", "Cierre", "upsert"],
    ["Pre-Cierre", "Cierre", "upsert"],
    ["Cierre", "Pre-Cierre", "upsert"],
    ["Pre-Cierre", "Proceso en tramite", "actualizar-estatus"],
    ["Cierre", "Proceso en tramite", "actualizar-estatus"],
    ["Recepcion de solicitud", "Proceso en tramite", "ninguna"],
  ] as const)("%s -> %s = %s", (previo, nuevo, esperado) => {
    expect(accionResumen(previo, nuevo)).toBe(esperado);
  });
});

describe("construirResumenContrato", () => {
  const ahora = new Date("2026-10-08T12:00:00.000Z");

  it("arma el resumen con los datos del ticket", () => {
    const ticket = buildTicket({
      id: "t9", folio: "JUR-0009", estatus: "Pre-Cierre", solicitanteNombre: "Ana Lopez",
      sitioArrendamiento: { clave: "QRO01", alias: "Queretaro Centro" },
      documentacion: [url("1_QRO01_CONTRATO_ARRENDAMIENTO.docx")],
      contratoArrendamiento: {
        domicilio: "Av. 1 #2", altaArrendador: "Juan SA", solicitante: "Ana Lopez",
        periodoInicio: "2026-01-01", periodoFin: "2027-01-01", condicionesPago: "Dia 5", montoPago: 120000, motivo: "Renovacion",
      },
    });
    const r = construirResumenContrato(ticket, ahora);
    expect(r).toMatchObject({
      ticketId: "t9", folio: "JUR-0009", estatus: "Pre-Cierre",
      sitioClave: "QRO01", sitioAlias: "Queretaro Centro", domicilio: "Av. 1 #2",
      solicitante: "Ana Lopez", altaArrendador: "Juan SA",
      periodoInicio: "2026-01-01", periodoFin: "2027-01-01",
      contratoNombre: "QRO01_CONTRATO_ARRENDAMIENTO.docx", estadoResumen: "pendiente",
      vistoBueno: null, actualizadoEn: ahora.toISOString(),
    });
    expect(r.contratoUrl).toBe(ticket.documentacion[0]);
  });

  it("sin contratoArrendamiento deja los campos en null y usa el solicitante del ticket", () => {
    const r = construirResumenContrato(buildTicket({ estatus: "Cierre" }), ahora);
    expect(r.domicilio).toBeNull();
    expect(r.solicitante).toBe("Juan Perez");
    expect(r.contratoUrl).toBeNull();
    expect(r.estadoResumen).toBe("sin_contrato");
  });

  it("conserva el visto bueno previo", () => {
    const previo = construirResumenContrato(buildTicket({ estatus: "Pre-Cierre" }), ahora);
    previo.vistoBueno = { uid: "j1", nombre: "Jefe", fecha: ahora.toISOString() };
    const r = construirResumenContrato(buildTicket({ estatus: "Cierre" }), ahora, previo);
    expect(r.vistoBueno).toEqual(previo.vistoBueno);
    expect(r.estatus).toBe("Cierre");
  });

  it("copia los campos de pago y las discrepancias de ticket.resumenContrato cuando estan listos", () => {
    const ticket = buildTicket({
      estatus: "Pre-Cierre",
      resumenContrato: {
        estado: "listo", contratoNombre: "x.docx", generadoEn: ahora.toISOString(), error: undefined,
        discrepancias: [{ campo: "domicilio", valorTicket: "A", valorContrato: "B" }],
        extraccion: {
          sitio: null, codigo: null, domicilio: "B", altaArrendador: null, solicitante: null,
          periodoInicio: null, periodoFin: null, condicionesPago: "Dia 5", montoPagoAnual: 240000, formaPago: "mensual",
        },
      },
    });
    const r = construirResumenContrato(ticket, ahora);
    expect(r.condicionesPago).toBe("Dia 5");
    expect(r.montoPagoAnual).toBe(240000);
    expect(r.formaPago).toBe("mensual");
    expect(r.discrepancias).toHaveLength(1);
    expect(r.estadoResumen).toBe("listo");
  });
});
```

- [ ] **Step 2:** `pnpm test src/domain/contratos` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

Agregar a `Ticket` (`src/types/ticket.ts`, sección "Verde"): `resumenContrato?: ResumenContratoTicket; // lo escribe el servidor (Plan B)` e importar el tipo. Crear `src/types/resumen-contrato.ts` con los tipos de la sección *Interfaces* (importando `Estatus` de `./ticket`; para evitar el ciclo, `ticket.ts` usa `import type`).

`src/domain/contratos/contrato-rules.ts`:

```ts
import type { Estatus, Ticket } from "@/types/ticket";
import type { ResumenContrato } from "@/types/resumen-contrato";

export const ETAPAS_VISIBLES_JEFE_ZONA: readonly Estatus[] = ["Pre-Cierre", "Cierre"];

const esEtapaVisible = (e: Estatus) => ETAPAS_VISIBLES_JEFE_ZONA.includes(e);

// Storage guarda `{timestamp}_{nombre}` (ver lib/storage.ts); se quita el prefijo.
export function nombreDeUrl(url: string): string {
  try {
    const ruta = decodeURIComponent(new URL(url).pathname);
    const archivo = ruta.slice(ruta.lastIndexOf("/") + 1);
    return archivo.replace(/^\d+_/, "");
  } catch {
    return "";
  }
}

export function encontrarContrato(documentacion: string[]): string | null {
  return (
    documentacion.find((url) => {
      const nombre = nombreDeUrl(url).toUpperCase();
      return nombre.endsWith(".DOCX") && nombre.includes("CONTRATO_ARRENDAMIENTO");
    }) ?? null
  );
}

export function accionResumen(estatusPrevio: Estatus, estatusNuevo: Estatus): "upsert" | "actualizar-estatus" | "ninguna" {
  if (esEtapaVisible(estatusNuevo)) return "upsert";
  if (esEtapaVisible(estatusPrevio)) return "actualizar-estatus";
  return "ninguna";
}

export function construirResumenContrato(ticket: Ticket, ahora: Date, previo?: ResumenContrato | null): ResumenContrato {
  const contrato = ticket.contratoArrendamiento;
  const gemini = ticket.resumenContrato;
  const contratoUrl = encontrarContrato(ticket.documentacion);
  const extraccion = gemini?.estado === "listo" ? gemini.extraccion : null;

  return {
    ticketId: ticket.id,
    folio: ticket.folio,
    estatus: ticket.estatus,
    sitioClave: ticket.sitioArrendamiento?.clave ?? null,
    sitioAlias: ticket.sitioArrendamiento?.alias ?? contrato?.sitio ?? null,
    domicilio: contrato?.domicilio ?? null,
    solicitante: contrato?.solicitante || ticket.solicitanteNombre,
    altaArrendador: contrato?.altaArrendador ?? null,
    periodoInicio: contrato?.periodoInicio ?? null,
    periodoFin: contrato?.periodoFin ?? null,
    condicionesPago: extraccion?.condicionesPago ?? contrato?.condicionesPago ?? null,
    montoPagoAnual: extraccion?.montoPagoAnual ?? contrato?.montoPago ?? null,
    formaPago: extraccion?.formaPago ?? null,
    discrepancias: gemini?.discrepancias ?? [],
    contratoUrl,
    contratoNombre: contratoUrl ? nombreDeUrl(contratoUrl) : null,
    estadoResumen: !contratoUrl ? "sin_contrato" : gemini?.estado ?? "pendiente",
    vistoBueno: previo?.vistoBueno ?? null,
    actualizadoEn: ahora.toISOString(),
  };
}
```

- [ ] **Step 4:** `pnpm test src/domain/contratos` → PASS; `pnpm exec tsc --noEmit` limpio.

- [ ] **Step 5: Commit** (si se autoriza): `feat: reglas del resumen de contrato y deteccion del docx`.

---

### Task 4: Repositorio y sincronización del resumen

**Files:**
- Create: `src/domain/contratos/resumen-contrato-repository.ts`
- Create: `src/infrastructure/firestore/resumen-contrato-repository.ts`
- Modify: `src/domain/tickets/ticket-service.ts:18,48-81`
- Modify: `src/lib/tickets.ts:11`
- Create: `src/domain/tickets/ticket-service.test.ts`

**Interfaces:**
- Consumes: `accionResumen`, `construirResumenContrato` (Task 3).
- Produces:

```ts
export interface ResumenContratoRepository {
  get(ticketId: string): Promise<ResumenContrato | null>;
  upsert(resumen: ResumenContrato): Promise<void>;
  updateEstatus(ticketId: string, estatus: Estatus, actualizadoEn: string): Promise<void>;
  subscribeMany(callback: (r: ResumenContrato[]) => void, onError?: (e: RepositoryError) => void): () => void; // solo etapas visibles (Task 7)
  subscribeOne(ticketId: string, callback: (r: ResumenContrato | null) => void, onError?: ...): () => void;
  registrarVistoBueno(ticketId: string, visto: VistoBueno): Promise<void>;
}
```
`createTicketService(repo, notifier, catalogo, resumenes: ResumenContratoRepository)` — cuarto parámetro.

- [ ] **Step 1: Prueba que falla** — `ticket-service.test.ts` con repositorios en memoria (fakes locales en el mismo archivo):

```ts
import { describe, expect, it } from "vitest";
import { createTicketService } from "./ticket-service";
import { buildTicket } from "@/test/ticket-fixture";
import type { Ticket } from "@/types/ticket";
import type { ResumenContrato } from "@/types/resumen-contrato";

function montar(ticket: Ticket) {
  const resumenes = new Map<string, ResumenContrato>();
  const avisos: string[] = [];
  const repo: any = {
    getById: async () => ticket,
    update: async (_: string, patch: Partial<Ticket>) => { Object.assign(ticket, patch); },
  };
  const notifier: any = {
    ticketCambioEstatus: async (i: { estatus: string }) => { avisos.push(i.estatus); },
    ticketAsignado: async () => {}, ticketReasignado: async () => {}, ticketCreado: async () => {},
  };
  const repoResumenes: any = {
    get: async (id: string) => resumenes.get(id) ?? null,
    upsert: async (r: ResumenContrato) => { resumenes.set(r.ticketId, r); },
    updateEstatus: async (id: string, estatus: ResumenContrato["estatus"]) => {
      const r = resumenes.get(id); if (r) r.estatus = estatus;
    },
  };
  const service = createTicketService(repo, notifier, { findServicio: () => undefined } as any, repoResumenes);
  return { service, resumenes, avisos };
}

const input = (estatus: Ticket["estatus"]) => ({ estatus, abogadoAsignadoId: null, notasCierre: null });

describe("sincronizacion del resumen de contrato", () => {
  it("al pasar a Pre-Cierre crea el resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", "u1", input("Pre-Cierre"));
    expect(resumenes.get("t1")?.estatus).toBe("Pre-Cierre");
  });

  it("al pasar de Pre-Cierre a Cierre conserva el visto bueno", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", "u1", input("Pre-Cierre"));
    resumenes.get("t1")!.vistoBueno = { uid: "j1", nombre: "Jefe", fecha: "2026-10-08T00:00:00.000Z" };
    await service.updateTicketAsignacion("t1", "u1", input("Cierre"));
    expect(resumenes.get("t1")?.estatus).toBe("Cierre");
    expect(resumenes.get("t1")?.vistoBueno?.uid).toBe("j1");
  });

  it("si el ticket regresa a una etapa previa solo actualiza el estatus del resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", "u1", input("Pre-Cierre"));
    await service.updateTicketAsignacion("t1", "u1", input("Proceso en tramite"));
    expect(resumenes.get("t1")?.estatus).toBe("Proceso en tramite");
  });

  it("en etapas previas no crea resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", "u1", input("Proceso en tramite"));
    expect(resumenes.size).toBe(0);
  });

  it("si el resumen falla, el cambio de estatus ya guardado no se pierde", async () => {
    const ticket = buildTicket({ id: "t1" });
    const roto: any = { get: async () => { throw new Error("boom"); }, upsert: async () => { throw new Error("boom"); }, updateEstatus: async () => {} };
    const s2 = createTicketService(
      { getById: async () => ticket, update: async (_: string, p: Partial<Ticket>) => { Object.assign(ticket, p); } } as any,
      { ticketCambioEstatus: async () => {}, ticketAsignado: async () => {}, ticketReasignado: async () => {}, ticketCreado: async () => {} } as any,
      { findServicio: () => undefined } as any,
      roto
    );
    await expect(s2.updateTicketAsignacion("t1", "u1", input("Pre-Cierre"))).resolves.toBeUndefined();
    expect(ticket.estatus).toBe("Pre-Cierre");
  });
});
```

- [ ] **Step 2:** `pnpm test src/domain/tickets/ticket-service.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

Puerto `src/domain/contratos/resumen-contrato-repository.ts` con la interfaz de *Interfaces* (importar `RepositoryError` de `@/domain/tickets/ticket-repository`).

En `ticket-service.ts`: cuarto parámetro `resumenes: ResumenContratoRepository`; importar `accionResumen, construirResumenContrato`. En `updateTicketAsignacion`, justo después de `await repo.update(id, patch);` agregar (best-effort, igual que los avisos):

```ts
    if (esCambioEstatus) {
      await sincronizarResumen({ ...current, ...patch } as Ticket, current.estatus).catch((err) =>
        console.error("No se pudo sincronizar el resumen de contrato:", err)
      );
    }
```

y dentro de `createTicketService`, antes de `updateTicketAsignacion`:

```ts
  async function sincronizarResumen(ticket: Ticket, estatusPrevio: Estatus): Promise<void> {
    const accion = accionResumen(estatusPrevio, ticket.estatus);
    if (accion === "ninguna") return;
    const ahora = new Date();
    if (accion === "actualizar-estatus") return resumenes.updateEstatus(ticket.id, ticket.estatus, ahora.toISOString());
    const previo = await resumenes.get(ticket.id);
    await resumenes.upsert(construirResumenContrato(ticket, ahora, previo));
  }
```
(importar `Estatus` de `@/types/ticket`).

Implementación Firestore `src/infrastructure/firestore/resumen-contrato-repository.ts` (colección `resumenesContrato`, id = ticketId; `subscribeMany` consulta `where("estatus", "in", ETAPAS_VISIBLES_JEFE_ZONA)` — las reglas exigen ese filtro; `registrarVistoBueno` usa `updateDoc(ref, { vistoBueno })`; `updateEstatus` usa `updateDoc(ref, { estatus, actualizadoEn })`; `get` usa `getDoc`; `upsert` usa `setDoc(ref, resumen)`). Seguir el estilo de `ticket-repository.ts` (mapear errores con `toRepositoryError`).

En `lib/tickets.ts` cambiar la línea 11 a pasar `firestoreResumenContratoRepository` como cuarto argumento.

- [ ] **Step 4:** `pnpm test` PASS; `pnpm exec tsc --noEmit` limpio.

- [ ] **Step 5: Commit** (si se autoriza): `feat: sincroniza resumenesContrato al cambiar de etapa`.

---

### Task 5: Reglas de Firestore

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1:** En el bloque de funciones (tras `isAdmin()`) agregar:

```
    // Solo consulta resumenesContrato (Pre-Cierre/Cierre). No lee tickets. Sincronizar con
    // esJefeZona() en src/types/user.ts.
    function isJefeZona() { return isSignedIn() && myRole() == "jefe_zona"; }
```

- [ ] **Step 2:** Antes del cierre de `/documents`, agregar:

```
    // Resumen derivado del ticket para el jefe de zona. Lo escribe Legal/admin al mover el
    // ticket a Pre-Cierre/Cierre (ver ticket-service sincronizarResumen). El jefe de zona
    // lee solo esas dos etapas — las consultas deben filtrar por estatus — y unicamente
    // puede fijar su visto bueno, y solo en Pre-Cierre.
    match /resumenesContrato/{ticketId} {
      allow read: if isLegalStaff() || isAdmin()
                  || (isJefeZona() && resource.data.estatus in ["Pre-Cierre", "Cierre"]);

      allow create, delete: if isLegalStaff() || isAdmin();

      allow update: if isLegalStaff() || isAdmin()
                    || (isJefeZona()
                        && resource.data.estatus == "Pre-Cierre"
                        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["vistoBueno"])
                        && request.resource.data.vistoBueno.uid == request.auth.uid);
    }
```

- [ ] **Step 3: Verificar** — la app no tiene pruebas de reglas. Con el emulador (`pnpm exec firebase emulators:start --only firestore`, si está configurado) o desplegando a un entorno de pruebas, comprobar manualmente: (a) jefe de zona **no** puede `get` un doc de `tickets`; (b) puede listar `resumenesContrato` con `where("estatus","in",["Pre-Cierre","Cierre"])` y **no** sin ese filtro; (c) puede escribir `vistoBueno` solo en Pre-Cierre; (d) un solicitante no lee `resumenesContrato`. Registrar el resultado de las cuatro comprobaciones.

- [ ] **Step 4:** `pnpm exec firebase deploy --only firestore:rules` **solo cuando el usuario lo autorice** (afecta producción).

- [ ] **Step 5: Commit** (si se autoriza): `feat: reglas de Firestore para jefe_zona y resumenesContrato`.

---

### Task 6: Correo de aviso `pre_cierre`

**Files:**
- Modify: `src/domain/notificaciones/notificacion.ts:3-6`
- Modify: `src/domain/notificaciones/email-template.ts:33-77`
- Modify: `src/domain/notificaciones/preferencias-rules.ts:9-28`
- Modify: `src/lib/notificaciones-email.ts:8-17,96-119`
- Modify: `src/components/layout/notification-bell.tsx:12-45` (tres `Record<TipoNotificacion,…>`)
- Modify: `src/infrastructure/firestore/ticket-notifier.ts:43-51`
- Test: `src/domain/notificaciones/email-template.test.ts`, `preferencias-rules.test.ts`

**Interfaces:**
- Produces: `TipoNotificacion` incluye `"pre_cierre"`. El correo de `pre_cierre` va a jefes de zona activos con la preferencia habilitada; muestra solo `["sitio", "solicitante"]` y **no** datos del contrato.

- [ ] **Step 1: Pruebas que fallan**

`email-template.test.ts`:

```ts
it("pre_cierre solo muestra sitio y solicitante", () => {
  const html = renderEmailNotificacion({
    tipo: "pre_cierre", mensaje: "El ticket JUR-0001 esta en Pre-Cierre.", folio: "JUR-0001",
    verTicketUrl: "http://x/pre-cierre/t1", calificarUrl: null,
    ticket: { sitio: "QRO01 — Centro", solicitante: "Ana", abogado: "NO DEBE VERSE", servicio: "NO DEBE VERSE" },
  });
  expect(html).toContain("QRO01");
  expect(html).toContain("Ana");
  expect(html).not.toContain("NO DEBE VERSE");
});
```

`preferencias-rules.test.ts`:

```ts
it("el jefe de zona puede apagar el aviso de Pre-Cierre", () => {
  expect(tiposCorreoEditables("jefe_zona")).toEqual(["pre_cierre"]);
});
```

- [ ] **Step 2:** `pnpm test src/domain/notificaciones` → FAIL.

- [ ] **Step 3: Implementar**
  - `notificacion.ts`: agregar `| "pre_cierre"` al union.
  - `email-template.ts`: `ACENTO_POR_TIPO.pre_cierre = AMBAR`; `ETIQUETA_POR_TIPO.pre_cierre = "Ticket en Pre-Cierre"`; `CAMPOS_POR_TIPO.pre_cierre = ["sitio", "solicitante"]`.
  - `preferencias-rules.ts`: `jefe_zona: ["pre_cierre"]`; `ETIQUETA_CORREO.pre_cierre = "Ticket en Pre-Cierre"`.
  - `notificaciones-email.ts`: `TIPO_LABEL.pre_cierre = "Ticket en Pre-Cierre"`; nueva función y rama:

```ts
async function jefesZonaDestino(tipo: TipoNotificacion): Promise<Destino> {
  const db = getAdminDb();
  const snap = await db.collection("users").where("role", "==", "jefe_zona").get();
  return filtrarDestinatarios(snap.docs.map((d) => d.data()), tipo);
}
```
    en `resolverDestinatarios`, junto a la rama de `nuevo_ticket` (no necesita leer el ticket): `if (tipo === "pre_cierre") return jefesZonaDestino(tipo);`.
  - `verTicketUrl` del correo apunta a `/tickets/{id}`; para `pre_cierre` debe apuntar a `/pre-cierre/{id}`. En `enviarNotificacionEmailInterno`, cambiar la línea de `verTicketUrl` a:

```ts
  const verTicketUrl = input.tipo === "pre_cierre" ? `${APP_URL}/pre-cierre/${input.ticketId}` : `${APP_URL}/tickets/${input.ticketId}`;
```
  - `notification-bell.tsx`: agregar entrada `pre_cierre` en `TIPO_LABEL`, `TIPO_ICON` y `TIPO_TONE` copiando el estilo de `cambio_estatus` (usar el mismo icono y un tono ámbar).
  - `ticket-notifier.ts` (`ticketCambioEstatus`): después del `Promise.all` existente, si `estatus === "Pre-Cierre"`, enviar el aviso a jefes de zona:

```ts
    if (estatus === "Pre-Cierre") {
      await enviarEmailNotificacion({
        tipo: "pre_cierre", mensaje: `El ticket ${folio} esta en Pre-Cierre y espera tu visto bueno.`, ticketId, ticketFolio: folio,
      });
    }
```
    Importante: `cambio_estatus` con estatus `Pre-Cierre` también sale al solicitante y a Legal; es el comportamiento actual de cualquier cambio de etapa y se mantiene.

- [ ] **Step 4:** `pnpm test` PASS; `pnpm exec tsc --noEmit` limpio.

- [ ] **Step 5: Verificación manual** — con `NOTIFICACIONES_DESTINATARIOS_PRUEBA` apuntando a un correo propio, mover un ticket a Pre-Cierre y confirmar que llega un correo "Ticket en Pre-Cierre" cuyo enlace abre `/pre-cierre/{id}` y sin datos del contrato.

- [ ] **Step 6: Commit** (si se autoriza): `feat: correo de aviso de Pre-Cierre a jefes de zona`.

---

### Task 7: Vistas del jefe de zona y visto bueno

**Files:**
- Create: `src/lib/resumenes-contrato.ts`, `src/hooks/use-resumenes-contrato.ts`
- Create: `src/app/(app)/pre-cierre/page.tsx`, `src/app/(app)/pre-cierre/[id]/page.tsx`
- Create: `src/components/pre-cierre/pre-cierre-lista.tsx`, `src/components/pre-cierre/pre-cierre-detalle.tsx`
- Modify: `src/components/layout/sidebar.tsx:24-30,83`
- Modify: `src/app/(app)/layout.tsx:17-19`
- Modify: `src/app/(app)/page.tsx:7-16`
- Modify: `src/lib/auth-actions.ts` (sin cambio: `signInStaff` ya admite cualquier rol no solicitante)

**Interfaces:**
- Consumes: `ResumenContratoRepository` (Task 4), `ResumenContrato` (Task 3).
- Produces: rutas `/pre-cierre` y `/pre-cierre/[id]`; `registrarVistoBueno(ticketId, { uid, nombre })` en `lib/resumenes-contrato.ts`.

- [ ] **Step 1: Fachada y hook**

`src/lib/resumenes-contrato.ts`:

```ts
import { firestoreResumenContratoRepository as repo } from "@/infrastructure/firestore/resumen-contrato-repository";
import type { ResumenContrato } from "@/types/resumen-contrato";

export const subscribeResumenes = repo.subscribeMany;
export const subscribeResumen = repo.subscribeOne;

export async function registrarVistoBueno(ticketId: string, usuario: { uid: string; nombre: string }): Promise<void> {
  await repo.registrarVistoBueno(ticketId, { uid: usuario.uid, nombre: usuario.nombre, fecha: new Date().toISOString() });
}
export type { ResumenContrato };
```

`src/hooks/use-resumenes-contrato.ts`: dos hooks `useResumenes()` y `useResumen(id)` con el mismo patrón que `use-tickets.ts` / `use-ticket.ts` (estado `loading`, cancelar la suscripción en el cleanup, no suscribirse hasta `status === "signed-in"`). `useResumenes` ordena por `actualizadoEn` descendente.

- [ ] **Step 2: Guardas de ruta**

En `src/app/(app)/layout.tsx`, tras obtener `status`, leer `role` y agregar un efecto que redirija al jefe de zona fuera de cualquier ruta que no empiece por `/pre-cierre`:

```tsx
  const role = useAuthStore((s) => s.role);
  useEffect(() => {
    if (status === "signed-in" && esJefeZona(role) && !pathname.startsWith("/pre-cierre")) router.replace("/pre-cierre");
  }, [status, role, pathname, router]);
```
(importar `esJefeZona`). Esto es comodidad de UI; la seguridad real son las reglas del Task 5.

En `sidebar.tsx`: agregar `import { ClipboardCheck }` de `lucide-react`; item nuevo `{ label: "Pre-Cierre", href: "/pre-cierre", icon: ClipboardCheck, roles: ["jefe_zona"] }`; y a los demás items (`Inicio`, `Dashboard`, `Tickets`, `Nuevo ticket`) darles `roles` explícitos para excluir a `jefe_zona`: `roles: ["solicitante", "gerente_area", "mesa_control", "abogado", "gerente_juridico", "admin"]` (constante `ROLES_SIN_JEFE_ZONA` arriba del arreglo). El item de catálogo ya es explícito. Hacer lo mismo en `app/(app)/page.tsx` no es necesario porque el jefe de zona nunca llega a `/`.

- [ ] **Step 3: Lista** — `pre-cierre-lista.tsx`: tabla con columnas Folio, Sitio (`sitioClave — sitioAlias`), Solicitante, Etapa (`EstatusBadge`), Visto bueno (`Badge` verde "Dado por {nombre}" o gris "Pendiente"), fila enlazada a `/pre-cierre/{ticketId}`. Estados vacío y de carga siguiendo `tickets-table.tsx`. `page.tsx` renderiza `<h1 className="page-rule text-3xl font-semibold">Pre-Cierre</h1>` y la lista, con el mismo padding que `tickets/[id]/page.tsx`.

- [ ] **Step 4: Detalle** — `pre-cierre-detalle.tsx` con `useResumen(id)`:
  - Sección "Contrato": Sitio, Código, Domicilio, Alta de arrendador, Solicitante, Periodo, Condiciones de pago, Monto anual (formato moneda MXN), Forma de pago. Campo `null` se pinta como "No disponible".
  - Aviso de `estadoResumen`: `pendiente` → "El resumen del contrato aún no se genera." ; `error` → "No se pudo generar el resumen."; `sin_contrato` → "El ticket no tiene el contrato de arrendamiento adjunto."
  - Alertas de `discrepancias`: lista "El contrato dice X, el ticket dice Y" por campo.
  - Enlace "Descargar contrato original" (`contratoUrl`, `contratoNombre`) si existe.
  - Nota fija: "Resumen generado automáticamente; no sustituye la revisión legal del contrato."
  - Botón "Dar visto bueno" visible solo si `estatus === "Pre-Cierre"` y no hay `vistoBueno`; al confirmar llama `registrarVistoBueno(id, { uid, nombre })` (de `useAuthStore`) y muestra el estado "Visto bueno dado por {nombre} el {fecha}". En `Cierre` solo se muestra el visto bueno existente.
  - `[id]/page.tsx` renderiza el detalle con el mismo contenedor que `tickets/[id]/page.tsx`.

- [ ] **Step 5: Verificación manual (obligatoria, no hay pruebas de componentes)** — con `pnpm dev`: (1) crear un usuario `jefe_zona` desde Configuración > Usuarios y entrar por el login de staff; (2) debe aterrizar en `/pre-cierre`; escribir `/tickets` en la barra redirige de vuelta; (3) mover un ticket de prueba a Pre-Cierre con un usuario de Legal: aparece en la lista del jefe de zona en vivo; (4) dar visto bueno: se refleja y el ticket sigue en Pre-Cierre; (5) pasar el ticket a Cierre: sigue visible con el visto bueno; regresarlo a "Proceso en tramite": desaparece de la lista; (6) en la consola del navegador, `getDoc(doc(db,"tickets",id))` como jefe de zona falla con `permission-denied`. Anotar resultado de cada punto.

- [ ] **Step 6: Suite completa** — `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint` limpios.

- [ ] **Step 7: Commit** (si se autoriza): `feat: vista de Pre-Cierre y visto bueno del jefe de zona`.

---

## Self-review contra el spec

- Rol + etapa (§1): Tasks 1, 2. Visto bueno sin mover etapa: Tasks 4, 5, 7.
- Visibilidad restringida (§2): Tasks 3–5, 7. **Desviación del spec:** el spec decía "escritura solo servidor"; aquí Legal/admin escriben `resumenesContrato` desde el cliente (consistente con toda la app). El Plan B escribe con Admin SDK cuando regenera.
- **Desviación 2:** el spec proponía servir el contrato por API para que Storage no se abriera. Aquí el jefe de zona usa la URL de descarga con token guardada en el resumen. `storage.rules` sigue permitiendo lectura a cualquier usuario autenticado (incluido el jefe de zona); endurecerlo requiere `firestore.get()` desde Storage Rules hacia la base nombrada `epl-tickets`, que no se probó. Queda como riesgo conocido a decidir con el usuario.
- Correo (§4): Task 6. Pruebas (§5): visibilidad, `encontrarContrato`, dashboard, sincronización, plantilla; no hay pruebas de reglas de Firestore ni de componentes (el repo no las tiene): verificación manual en Tasks 5 y 7.
- Gemini, discrepancias reales, backfill y `sin_contrato` manual: **Plan B** (`2026-10-08-plan-b-gemini-resumen-contratos.md`). Aquí `ResumenContratoTicket` ya existe en tipos y el resumen lo copia cuando esté presente.
