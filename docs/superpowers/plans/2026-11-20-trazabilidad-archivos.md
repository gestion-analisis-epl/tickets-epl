# Trazabilidad de archivos por ticket — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar con exactitud quién subió o eliminó cada archivo de un ticket (y con qué rol), mostrarlo junto a cada archivo y en el Historial de cambios.

**Architecture:** Cada subida o borrado crea un documento append-only en `tickets/{id}/archivos` y una entrada en `tickets/{id}/historial`, en el mismo lote que el cambio del ticket. La lista de archivos une cada URL con su registro por la ruta de Storage. Un módulo de dominio puro (`src/domain/archivos/archivo-rules.ts`) arma los registros y las entradas; el servicio de tickets lo llama.

**Tech Stack:** Next.js (App Router), TypeScript, Firebase Firestore (reglas incluidas), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-trazabilidad-archivos-design.md` (la Task 6 corrige dos puntos del spec que el código real contradice).

## Global Constraints

- Idioma de toda la interfaz: español simple, sin tecnicismos. Los usuarios no saben de sistemas: nada cortado, un dato por campo.
- Los registros solo se agregan: `update` y `delete` de `tickets/{id}/archivos` son `false` en las reglas.
- Nunca se guarda la URL de descarga (lleva token) en un registro: solo `ruta` y `nombre`.
- `actorRol` del registro debe ser el rol real del usuario (`myRole()` en las reglas). En `nuevo-ticket-form.tsx` usar `roleReal` del store, no `role` (que cambia con "Ver como").
- Los archivos de tickets existentes muestran exactamente el texto `Origen no registrado`.
- Jefe de zona y Sitios no ven el "subido por" (leen el resumen, no el ticket).
- **Orden de despliegue:** las reglas de Firestore (Task 3) deben desplegarse **antes** de publicar el código de la app. Sin ellas, crear un ticket con archivos falla por permisos.
- No se hace commit ni deploy sin que el usuario lo pida. Los pasos "Commit" se ejecutan solo con su autorización. Si se hace commit, terminar el mensaje con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/types/archivo.ts` | Crear | Tipos `RegistroArchivo`, `RegistroArchivoGuardado`, `OrigenArchivo`, `AccionArchivo`. |
| `src/types/historial.ts` | Modificar | Tipos `archivo_subido` y `archivo_eliminado`; ambos son de proceso. |
| `src/domain/tickets/historial-rules.ts` | Modificar | Etiquetas de los dos tipos nuevos. |
| `src/domain/archivos/archivo-rules.ts` | Crear | Funciones puras: registros, entradas, diferencias, autor de un archivo. |
| `src/domain/archivos/archivo-rules.test.ts` | Crear | Pruebas de lo anterior. |
| `src/domain/archivos/archivos-repository.ts` | Crear | Interfaz de lectura de registros. |
| `src/infrastructure/firestore/archivos-repository.ts` | Crear | Implementación Firestore (suscripción y referencia nueva). |
| `src/domain/tickets/ticket-repository.ts` | Modificar | `create`, `updateConHistorial` aceptan registros; método `agregarHistorial`. |
| `src/infrastructure/firestore/ticket-repository.ts` | Modificar | Escribe los registros en la transacción y en el lote. |
| `src/domain/tickets/ticket-service.ts` | Modificar | `createTicket`, `updateTicketSolicitud`, `updateTicketRevisionLegal`, `updateTicketAltaRetroactiva`. |
| `src/domain/tickets/ticket-service-archivos.test.ts` | Crear | Pruebas del servicio con repositorio falso. |
| `firestore.rules` | Modificar | Subcolección `archivos` y tipos de historial nuevos. |
| `src/hooks/use-archivos-ticket.ts` | Crear | Suscripción a los registros de un ticket. |
| `src/components/tickets/autor-archivo.tsx` | Crear | Texto "Subido por ..." / "Origen no registrado". |
| `src/components/tickets/ticket-detail.tsx` | Modificar | Muestra el autor y pasa `actor` a revisión legal y Alta retroactiva. |
| `src/components/tickets/revision-legal-panel.tsx` | Modificar | Muestra el autor de cada anexo guardado. |
| `src/components/tickets/nuevo-ticket-form.tsx` | Modificar | Arma los registros de creación y los pasa a `createTicket`. |
| `src/lib/tickets.ts` | Sin cambios | Reexporta las funciones del servicio; las firmas nuevas se heredan. |

---

### Task 1: Tipos y reglas de dominio

**Files:**
- Create: `src/types/archivo.ts`
- Create: `src/domain/archivos/archivo-rules.ts`
- Test: `src/domain/archivos/archivo-rules.test.ts`
- Modify: `src/types/historial.ts`
- Modify: `src/domain/tickets/historial-rules.ts:272-285`

**Interfaces:**
- Consumes: `construirEntrada(tipo, actor, ahora, cambios)` de `historial-rules.ts`; `rutaDeUrlStorage(url)` de `@/lib/storage-ruta`; `nombreDeUrl(url)` de `@/domain/documentos/nombre-url`; `ETIQUETA_ROL` de `@/domain/tickets/rol-presentacion` (no se usa aquí, solo en UI).
- Produces (Tasks 2-5 dependen de estos nombres exactos):
  - `RegistroArchivo`, `RegistroArchivoGuardado`, `OrigenArchivo`, `AccionArchivo`, `ORIGENES_ARCHIVO` (en `src/types/archivo.ts`)
  - `CAMPOS_DOCUMENTO_REVISION: readonly string[]`
  - `ETIQUETA_ORIGEN_ARCHIVO: Record<OrigenArchivo, string>`
  - `registroArchivo(accion, archivo, origen, actor, ahora, campo?): RegistroArchivo | null`
  - `entradaArchivo(registro: RegistroArchivo): EntradaHistorial`
  - `registrosPorCambioDeUrls(antes: string[], despues: string[], origen, actor, ahora, campo?): RegistroArchivo[]`
  - `registrosPorCambioDeSlots(antes: object | undefined, despues: object | undefined, claves: readonly string[], origen, actor, ahora): RegistroArchivo[]`
  - `registrosDeCreacion(grupos, actor, ahora): RegistroArchivo[]`
  - `autorDeArchivo(registros: RegistroArchivoGuardado[], url: string): RegistroArchivoGuardado | null`

- [ ] **Step 1: Crear los tipos**

Crear `src/types/archivo.ts`:

```ts
import type { Role } from "./user";

// De dónde viene el archivo dentro del ticket. Sincronizar a mano con firestore.rules (tickets/{id}/archivos).
export const ORIGENES_ARCHIVO = [
  "documentacion",
  "formato_arrendamiento",
  "documento_arrendamiento",
  "alta",
  "revision_legal",
] as const;

export type OrigenArchivo = (typeof ORIGENES_ARCHIVO)[number];
export type AccionArchivo = "subido" | "eliminado";

// Documento tickets/{ticketId}/archivos/{archivoId}. Solo se agrega: las reglas niegan update/delete.
// Nunca lleva la URL de descarga (tiene token): la llave para unirlo con una URL es `ruta`.
export interface RegistroArchivo {
  nombre: string;
  ruta: string; // ruta del objeto en Storage, p. ej. "tickets/abc/1700000000_Predial.pdf"
  origen: OrigenArchivo;
  // Campo concreto cuando aplica (clave del documento de Alta, campo de la revisión legal). Se omite si no aplica:
  // el SDK de cliente rechaza valores undefined.
  campo?: string;
  accion: AccionArchivo;
  fecha: string; // ISO
  actorUid: string;
  actorNombre: string;
  actorRol: Role;
}

export interface RegistroArchivoGuardado extends RegistroArchivo {
  id: string;
}
```

- [ ] **Step 2: Escribir las pruebas que fallan**

Crear `src/domain/archivos/archivo-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  autorDeArchivo,
  CAMPOS_DOCUMENTO_REVISION,
  entradaArchivo,
  registroArchivo,
  registrosDeCreacion,
  registrosPorCambioDeSlots,
  registrosPorCambioDeUrls,
} from "./archivo-rules";
import { esTipoDeProceso, type ActorHistorial } from "@/types/historial";
import type { RegistroArchivoGuardado } from "@/types/archivo";

const url = (nombre: string) =>
  `https://firebasestorage.googleapis.com/v0/b/b/o/tickets%2Ft1%2F123_${nombre}?alt=media&token=x`;
const ahora = new Date("2026-11-20T16:00:00.000Z");
const ana: ActorHistorial = { uid: "u1", nombre: "Ana", rol: "solicitante" };
const luis: ActorHistorial = { uid: "u2", nombre: "Luis", rol: "gerente_juridico" };

const guardado = (r: Partial<RegistroArchivoGuardado> = {}): RegistroArchivoGuardado => ({
  id: "r1",
  nombre: "A.pdf",
  ruta: "tickets/t1/123_A.pdf",
  origen: "documentacion",
  accion: "subido",
  fecha: "2026-11-20T10:00:00.000Z",
  actorUid: "u1",
  actorNombre: "Ana",
  actorRol: "solicitante",
  ...r,
});

describe("registroArchivo", () => {
  it("toma ruta y nombre de la URL y guarda al actor y la fecha", () => {
    expect(registroArchivo("subido", { url: url("Predial.pdf") }, "documentacion", ana, ahora)).toEqual({
      nombre: "Predial.pdf",
      ruta: "tickets/t1/123_Predial.pdf",
      origen: "documentacion",
      accion: "subido",
      fecha: "2026-11-20T16:00:00.000Z",
      actorUid: "u1",
      actorNombre: "Ana",
      actorRol: "solicitante",
    });
  });

  it("incluye el campo solo cuando se indica", () => {
    const r = registroArchivo("subido", { url: url("A.pdf") }, "alta", ana, ahora, "predial");
    expect(r?.campo).toBe("predial");
    expect("campo" in registroArchivo("subido", { url: url("A.pdf") }, "alta", ana, ahora)!).toBe(false);
  });

  it("prefiere la ruta y el nombre que ya se conocen (archivos recién subidos)", () => {
    const r = registroArchivo("subido", { ruta: "tickets-drafts/d1/9_IMG.jpeg", nombre: "IMG 1.jpeg" }, "documentacion", ana, ahora);
    expect(r).toMatchObject({ ruta: "tickets-drafts/d1/9_IMG.jpeg", nombre: "IMG 1.jpeg" });
  });

  it("devuelve null si la URL no es de Storage", () => {
    expect(registroArchivo("subido", { url: "https://otro.test/x.pdf" }, "documentacion", ana, ahora)).toBeNull();
  });
});

describe("entradaArchivo", () => {
  it("una subida es una entrada archivo_subido del actor, visible para el solicitante", () => {
    const registro = registroArchivo("subido", { url: url("Predial.pdf") }, "documentacion", luis, ahora)!;
    expect(entradaArchivo(registro)).toEqual({
      fecha: "2026-11-20T16:00:00.000Z",
      actorUid: "u2",
      actorNombre: "Luis",
      actorRol: "gerente_juridico",
      tipo: "archivo_subido",
      cambios: [{ campo: "archivo", etiqueta: "Documentación", antes: null, despues: "Predial.pdf" }],
      visibleSolicitante: true,
    });
  });

  it("un borrado es una entrada archivo_eliminado con el nombre en 'antes'", () => {
    const registro = registroArchivo("eliminado", { url: url("Predial.pdf") }, "alta", ana, ahora, "predial")!;
    const entrada = entradaArchivo(registro);
    expect(entrada.tipo).toBe("archivo_eliminado");
    expect(entrada.cambios).toEqual([
      { campo: "archivo", etiqueta: "Documento de alta de arrendador", antes: "Predial.pdf", despues: null },
    ]);
  });

  it("los dos tipos son cambios de proceso", () => {
    expect(esTipoDeProceso("archivo_subido")).toBe(true);
    expect(esTipoDeProceso("archivo_eliminado")).toBe(true);
  });
});

describe("registrosPorCambioDeUrls", () => {
  it("registra los archivos nuevos como subidos y los que faltan como eliminados", () => {
    const registros = registrosPorCambioDeUrls([url("A.pdf"), url("B.pdf")], [url("B.pdf"), url("C.pdf")], "documentacion", luis, ahora);
    expect(registros.map((r) => `${r.accion}:${r.nombre}:${r.actorRol}`)).toEqual([
      "subido:C.pdf:gerente_juridico",
      "eliminado:A.pdf:gerente_juridico",
    ]);
  });

  it("sin cambios no registra nada", () => {
    expect(registrosPorCambioDeUrls([url("A.pdf")], [url("A.pdf")], "documentacion", luis, ahora)).toEqual([]);
  });
});

describe("registrosPorCambioDeSlots", () => {
  it("reemplazar un documento registra su subida y el borrado del anterior, cada uno con su campo", () => {
    const antes = { documentoPropiedad: url("A.pdf"), nombrePropietario: "x" };
    const despues = { documentoPropiedad: url("B.pdf"), cartaAutorizacion: url("C.pdf") };
    const registros = registrosPorCambioDeSlots(antes, despues, CAMPOS_DOCUMENTO_REVISION, "revision_legal", luis, ahora);
    expect(registros.map((r) => `${r.accion}:${r.campo}:${r.nombre}`)).toEqual([
      "subido:documentoPropiedad:B.pdf",
      "eliminado:documentoPropiedad:A.pdf",
      "subido:cartaAutorizacion:C.pdf",
    ]);
  });

  it("un documento que no cambia no genera registro", () => {
    const igual = { documentoPropiedad: url("A.pdf") };
    expect(registrosPorCambioDeSlots(igual, igual, CAMPOS_DOCUMENTO_REVISION, "revision_legal", luis, ahora)).toEqual([]);
  });

  it("acepta que antes no exista", () => {
    const registros = registrosPorCambioDeSlots(undefined, { documentoPropiedad: url("A.pdf") }, CAMPOS_DOCUMENTO_REVISION, "revision_legal", luis, ahora);
    expect(registros).toHaveLength(1);
  });
});

describe("registrosDeCreacion", () => {
  it("solo registra los archivos terminados de subir, con su origen y campo", () => {
    const registros = registrosDeCreacion(
      [
        {
          origen: "documentacion",
          archivos: [
            { name: "a.pdf", path: "tickets-drafts/d/1_a.pdf", status: "done" },
            { name: "b.pdf", path: "tickets-drafts/d/2_b.pdf", status: "error" },
            { name: "c.pdf", status: "done" },
          ],
        },
        { origen: "alta", campo: "predial", archivos: [{ name: "p.pdf", path: "tickets-drafts/d/3_p.pdf", status: "done" }] },
      ],
      ana,
      ahora
    );
    expect(registros.map((r) => `${r.origen}:${r.campo ?? "-"}:${r.nombre}:${r.ruta}`)).toEqual([
      "documentacion:-:a.pdf:tickets-drafts/d/1_a.pdf",
      "alta:predial:p.pdf:tickets-drafts/d/3_p.pdf",
    ]);
    expect(registros.every((r) => r.accion === "subido" && r.actorUid === "u1")).toBe(true);
  });
});

describe("autorDeArchivo", () => {
  it("devuelve el registro de subida más reciente de esa ruta", () => {
    const registros = [
      guardado({ id: "viejo", fecha: "2026-11-01T10:00:00.000Z", actorNombre: "Ana" }),
      guardado({ id: "nuevo", fecha: "2026-11-05T10:00:00.000Z", actorNombre: "Luis", actorRol: "gerente_juridico" }),
    ];
    expect(autorDeArchivo(registros, url("A.pdf"))?.id).toBe("nuevo");
  });

  it("ignora los borrados y las rutas de otros archivos", () => {
    const registros = [guardado({ accion: "eliminado" }), guardado({ ruta: "tickets/t1/123_B.pdf" })];
    expect(autorDeArchivo(registros, url("A.pdf"))).toBeNull();
  });

  it("sin registros (ticket anterior) devuelve null", () => {
    expect(autorDeArchivo([], url("A.pdf"))).toBeNull();
  });

  it("una URL que no es de Storage devuelve null", () => {
    expect(autorDeArchivo([guardado()], "https://otro.test/A.pdf")).toBeNull();
  });
});
```

- [ ] **Step 3: Correr las pruebas y confirmar que fallan**

Run: `npx vitest run src/domain/archivos/archivo-rules.test.ts`
Expected: FAIL — `Cannot find module './archivo-rules'`.

- [ ] **Step 4: Ampliar los tipos del historial**

En `src/types/historial.ts`, agregar los dos tipos al final de `TIPOS_HISTORIAL` (después de `"comentario_eliminado",`):

```ts
  "archivo_subido",
  "archivo_eliminado",
```

y agregarlos a `TIPOS_HISTORIAL_PROCESO` (después de `"cambios_solicitados",`), para que el solicitante y los abogados vean todas las subidas sin importar quién las haga:

```ts
  "archivo_subido",
  "archivo_eliminado",
```

En `src/domain/tickets/historial-rules.ts`, dentro de `ETIQUETA_TIPO_HISTORIAL` (después de `comentario_eliminado: "Comentario eliminado",`):

```ts
  archivo_subido: "Archivo subido",
  archivo_eliminado: "Archivo eliminado",
```

- [ ] **Step 5: Implementar las reglas de dominio**

Crear `src/domain/archivos/archivo-rules.ts`:

```ts
import type { AccionArchivo, OrigenArchivo, RegistroArchivo, RegistroArchivoGuardado } from "@/types/archivo";
import type { ActorHistorial, EntradaHistorial } from "@/types/historial";
import { rutaDeUrlStorage } from "@/lib/storage-ruta";
import { nombreDeUrl } from "@/domain/documentos/nombre-url";
import { construirEntrada } from "@/domain/tickets/historial-rules";

export const ETIQUETA_ORIGEN_ARCHIVO: Record<OrigenArchivo, string> = {
  documentacion: "Documentación",
  formato_arrendamiento: "Formato de arrendamiento",
  documento_arrendamiento: "Documento de arrendamiento",
  alta: "Documento de alta de arrendador",
  revision_legal: "Anexo de la revisión legal",
};

// Campos de RevisionLegal que guardan la URL de un archivo (ver types/ticket.ts).
export const CAMPOS_DOCUMENTO_REVISION = [
  "documentoPersonalidad",
  "documentoPropiedad",
  "cartaAutorizacion",
  "documentoBeneficiario",
  "documentoRepresentante",
  "cartaRepresentante",
] as const;

interface ArchivoConocido {
  ruta?: string;
  url?: string;
  nombre?: string;
}

// null si no se puede saber la ruta en Storage (URL que no es de Firebase Storage).
export function registroArchivo(
  accion: AccionArchivo,
  archivo: ArchivoConocido,
  origen: OrigenArchivo,
  actor: ActorHistorial,
  ahora: Date,
  campo?: string
): RegistroArchivo | null {
  const ruta = archivo.ruta ?? (archivo.url ? rutaDeUrlStorage(archivo.url) : null);
  if (!ruta) return null;
  const nombre = archivo.nombre ?? (archivo.url ? nombreDeUrl(archivo.url) : "");
  return {
    nombre: nombre || "archivo sin nombre",
    ruta,
    origen,
    accion,
    fecha: ahora.toISOString(),
    actorUid: actor.uid,
    actorNombre: actor.nombre,
    actorRol: actor.rol,
    ...(campo ? { campo } : {}),
  };
}

// Una entrada del Historial por archivo: el actor y la fecha salen del propio registro.
export function entradaArchivo(registro: RegistroArchivo): EntradaHistorial {
  const subido = registro.accion === "subido";
  const actor: ActorHistorial = { uid: registro.actorUid, nombre: registro.actorNombre, rol: registro.actorRol };
  const entrada = construirEntrada(subido ? "archivo_subido" : "archivo_eliminado", actor, new Date(registro.fecha), [
    {
      campo: "archivo",
      etiqueta: ETIQUETA_ORIGEN_ARCHIVO[registro.origen],
      antes: subido ? null : registro.nombre,
      despues: subido ? registro.nombre : null,
    },
  ]);
  if (!entrada) throw new Error("La entrada de archivo siempre lleva un cambio.");
  return entrada;
}

function sinNulos(registros: (RegistroArchivo | null)[]): RegistroArchivo[] {
  return registros.filter((r): r is RegistroArchivo => r !== null);
}

// Listas de URLs (p. ej. ticket.documentacion): lo nuevo es "subido", lo que ya no está es "eliminado".
export function registrosPorCambioDeUrls(
  antes: string[],
  despues: string[],
  origen: OrigenArchivo,
  actor: ActorHistorial,
  ahora: Date,
  campo?: string
): RegistroArchivo[] {
  return sinNulos([
    ...despues.filter((u) => !antes.includes(u)).map((u) => registroArchivo("subido", { url: u }, origen, actor, ahora, campo)),
    ...antes.filter((u) => !despues.includes(u)).map((u) => registroArchivo("eliminado", { url: u }, origen, actor, ahora, campo)),
  ]);
}

function urlDeCampo(objeto: object | undefined, clave: string): string[] {
  const valor = (objeto as Record<string, unknown> | undefined)?.[clave];
  return typeof valor === "string" && valor ? [valor] : [];
}

// Documentos de un solo archivo por campo (revisión legal, documentos de Alta): el campo queda en el registro.
export function registrosPorCambioDeSlots(
  antes: object | undefined,
  despues: object | undefined,
  claves: readonly string[],
  origen: OrigenArchivo,
  actor: ActorHistorial,
  ahora: Date
): RegistroArchivo[] {
  return claves.flatMap((clave) =>
    registrosPorCambioDeUrls(urlDeCampo(antes, clave), urlDeCampo(despues, clave), origen, actor, ahora, clave)
  );
}

export interface ArchivoSubidoEnFormulario {
  name: string;
  path?: string;
  status: string;
}

export interface GrupoArchivosCreacion {
  origen: OrigenArchivo;
  campo?: string;
  archivos: ArchivoSubidoEnFormulario[];
}

// Archivos que de verdad quedan en el ticket nuevo (los de borrador que se quitaron o fallaron no cuentan).
export function registrosDeCreacion(grupos: GrupoArchivosCreacion[], actor: ActorHistorial, ahora: Date): RegistroArchivo[] {
  return sinNulos(
    grupos.flatMap((g) =>
      g.archivos
        .filter((a) => a.status === "done" && a.path)
        .map((a) => registroArchivo("subido", { ruta: a.path, nombre: a.name }, g.origen, actor, ahora, g.campo))
    )
  );
}

// Quién subió el archivo que hoy está en la URL: el registro de subida más reciente de esa ruta.
// null en tickets anteriores a la trazabilidad (la interfaz muestra "Origen no registrado").
export function autorDeArchivo(registros: RegistroArchivoGuardado[], url: string): RegistroArchivoGuardado | null {
  const ruta = rutaDeUrlStorage(url);
  if (!ruta) return null;
  const subidas = registros.filter((r) => r.ruta === ruta && r.accion === "subido");
  if (subidas.length === 0) return null;
  return subidas.reduce((a, b) => (a.fecha >= b.fecha ? a : b));
}
```

- [ ] **Step 6: Correr las pruebas de dominio y la suite completa**

Run: `npx vitest run src/domain/archivos/archivo-rules.test.ts`
Expected: PASS (todas).

Run: `npx tsc --noEmit && npx vitest run`
Expected: sin errores de tipos y todas las pruebas pasan. Si alguna prueba existente enumera los tipos de proceso (p. ej. en `historial-rules.test.ts`), actualizarla para incluir `archivo_subido` y `archivo_eliminado`.

- [ ] **Step 7: Commit (solo si el usuario lo autoriza)**

```bash
git add src/types/archivo.ts src/types/historial.ts src/domain/archivos src/domain/tickets/historial-rules.ts
git commit -m "feat: reglas de dominio para registrar quien sube cada archivo"
```

---

### Task 2: Repositorios y servicio de tickets

**Files:**
- Create: `src/domain/archivos/archivos-repository.ts`
- Create: `src/infrastructure/firestore/archivos-repository.ts`
- Test: `src/domain/tickets/ticket-service-archivos.test.ts`
- Modify: `src/domain/tickets/ticket-repository.ts:16-30`
- Modify: `src/infrastructure/firestore/ticket-repository.ts:1-67`
- Modify: `src/domain/tickets/ticket-service.ts:1-60,157-170,213-240`

**Interfaces:**
- Consumes: todo lo producido en Task 1.
- Produces:
  - `ArchivosRepository.subscribe(ticketId, callback, onError?)` y `firestoreArchivosRepository` (Task 4 la usa).
  - `nuevoRegistroArchivoRef(ticketId): DocumentReference`.
  - `TicketRepository.create(build, archivos?)`, `updateConHistorial(id, patch, entradas, archivos?)`, `agregarHistorial(id, entradas)`.
  - Servicio: `createTicket(input, archivos = [])`, `updateTicketRevisionLegal(id, actor, revision)`, `updateTicketAltaRetroactiva(id, actor, entrada)`. `updateTicketSolicitud` conserva su firma.

- [ ] **Step 1: Escribir las pruebas del servicio (fallan)**

Crear `src/domain/tickets/ticket-service-archivos.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({ deleteTicketDocuments: async () => {} }));
import { createTicketService } from "./ticket-service";
import { buildTicket } from "@/test/ticket-fixture";
import type { Ticket } from "@/types/ticket";
import type { ActorHistorial, EntradaHistorial } from "@/types/historial";
import type { RegistroArchivo } from "@/types/archivo";
import type { CatalogoServicio } from "@/types/catalogo";
import type { CatalogoLookup } from "@/domain/catalogo/catalogo-lookup";
import type { ResumenContratoRepository } from "@/domain/contratos/resumen-contrato-repository";
import type { NuevoTicketBuilder, TicketRepository } from "./ticket-repository";
import type { TicketNotifier } from "./ticket-notifier";
import type { NuevoTicketInput } from "./nuevo-ticket";

const url = (nombre: string) =>
  `https://firebasestorage.googleapis.com/v0/b/b/o/tickets%2Ft1%2F123_${nombre}?alt=media&token=x`;
const solicitante: ActorHistorial = { uid: "user-1", nombre: "Juan Perez", rol: "solicitante" };
const abogado: ActorHistorial = { uid: "u9", nombre: "Alejandra", rol: "abogado", abogadoId: "a1" };
const gerenteJuridico: ActorHistorial = { uid: "u3", nombre: "Gerente", rol: "gerente_juridico" };

interface Lote {
  id: string;
  patch: Partial<Ticket>;
  entradas: EntradaHistorial[];
  archivos: RegistroArchivo[];
}

function montar(ticket: Ticket, opts: { historialRoto?: boolean } = {}) {
  const lotes: Lote[] = [];
  const creados: { archivos: RegistroArchivo[] }[] = [];
  const historial: { id: string; entradas: EntradaHistorial[] }[] = [];
  const repo = {
    getById: async () => ({ ...ticket }),
    update: async (_: string, patch: Partial<Ticket>) => { Object.assign(ticket, patch); },
    updateConHistorial: async (id: string, patch: Partial<Ticket>, entradas: EntradaHistorial[], archivos: RegistroArchivo[] = []) => {
      lotes.push({ id, patch, entradas, archivos });
      Object.assign(ticket, patch);
    },
    create: async (build: NuevoTicketBuilder, archivos: RegistroArchivo[] = []) => {
      build({ id: "nuevo", folio: "JUR-0099" });
      creados.push({ archivos });
      return { id: "nuevo", folio: "JUR-0099" };
    },
    agregarHistorial: async (id: string, entradas: EntradaHistorial[]) => {
      if (opts.historialRoto) throw new Error("historial rechazado");
      historial.push({ id, entradas });
    },
    delete: async () => {},
  };
  const resumenes = { get: async () => null, upsert: async () => {}, updateEstatus: async () => {}, delete: async () => {} };
  const notifier: TicketNotifier = {
    ticketCambioEstatus: async () => {}, ticketAsignado: async () => {}, ticketReasignado: async () => {}, ticketCreado: async () => {},
  };
  const catalogo: CatalogoLookup = {
    findServicio: (id: string) =>
      ({ id, servicio: `Servicio ${id}`, categoria: "Contratos", puestoResponsable: "Abogado", slaInterno: 3 }) as unknown as CatalogoServicio,
  };
  const service = createTicketService(
    repo as unknown as TicketRepository,
    notifier,
    catalogo,
    resumenes as unknown as ResumenContratoRepository
  );
  return { service, lotes, creados, historial };
}

const INPUT: NuevoTicketInput = {
  solicitanteId: "user-1",
  solicitanteNombre: "Juan Perez",
  areaEmpresa: "Grupo EPL",
  servicioId: "JUR-C001",
  descripcion: "Alta",
  documentacion: [],
};

const registroCreacion: RegistroArchivo = {
  nombre: "Predial.pdf",
  ruta: "tickets-drafts/d1/1_Predial.pdf",
  origen: "documentacion",
  accion: "subido",
  fecha: "2026-11-20T16:00:00.000Z",
  actorUid: "user-1",
  actorNombre: "Juan Perez",
  actorRol: "solicitante",
};

describe("createTicket con archivos", () => {
  it("pasa los registros al repositorio y agrega su entrada al historial", async () => {
    const { service, creados, historial } = montar(buildTicket());
    await service.createTicket(INPUT, [registroCreacion]);
    expect(creados[0].archivos).toEqual([registroCreacion]);
    expect(historial).toHaveLength(1);
    expect(historial[0].id).toBe("nuevo");
    expect(historial[0].entradas.map((e) => e.tipo)).toEqual(["archivo_subido"]);
    expect(historial[0].entradas[0]).toMatchObject({ actorUid: "user-1", actorRol: "solicitante" });
  });

  it("sin archivos no toca el historial", async () => {
    const { service, historial } = montar(buildTicket());
    await service.createTicket(INPUT);
    expect(historial).toEqual([]);
  });

  it("si el historial falla el ticket ya creado no se pierde", async () => {
    const { service } = montar(buildTicket(), { historialRoto: true });
    await expect(service.createTicket(INPUT, [registroCreacion])).resolves.toEqual({ id: "nuevo", folio: "JUR-0099" });
  });
});

describe("updateTicketSolicitud registra quien sube y quien quita documentos", () => {
  it("un documento nuevo y uno quitado quedan registrados con el actor", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1", documentacion: [url("Viejo.pdf")] }));
    await service.updateTicketSolicitud("t1", gerenteJuridico, {
      areaEmpresa: "A", servicioId: "s", descripcion: "d", documentacion: [url("Nuevo.pdf")],
    });
    const lote = lotes[0];
    expect(lote.archivos.map((r) => `${r.accion}:${r.nombre}:${r.actorRol}:${r.origen}`)).toEqual([
      "subido:Nuevo.pdf:gerente_juridico:documentacion",
      "eliminado:Viejo.pdf:gerente_juridico:documentacion",
    ]);
    expect(lote.entradas.filter((e) => e.tipo === "archivo_subido" || e.tipo === "archivo_eliminado")).toHaveLength(2);
  });

  it("si la documentación no cambia no registra archivos", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1", documentacion: [url("A.pdf")] }));
    await service.updateTicketSolicitud("t1", solicitante, {
      areaEmpresa: "A", servicioId: "s", descripcion: "d", documentacion: [url("A.pdf")],
    });
    expect(lotes[0].archivos).toEqual([]);
  });
});

describe("updateTicketRevisionLegal registra los anexos del abogado", () => {
  it("un anexo nuevo queda con su campo y el abogado como autor", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1", servicioId: "JUR-C071" }));
    await service.updateTicketRevisionLegal("t1", abogado, {
      tipoPropietario: "fisica",
      acreditaPropiedad: true,
      documentoPropiedad: url("Escrituras.pdf"),
    });
    expect(lotes[0].patch.revisionLegal?.documentoPropiedad).toBe(url("Escrituras.pdf"));
    expect(lotes[0].archivos).toHaveLength(1);
    expect(lotes[0].archivos[0]).toMatchObject({
      accion: "subido", origen: "revision_legal", campo: "documentoPropiedad", nombre: "Escrituras.pdf", actorRol: "abogado",
    });
    expect(lotes[0].entradas.map((e) => e.tipo)).toEqual(["archivo_subido"]);
  });
});

describe("updateTicketAltaRetroactiva registra los documentos que agrega el abogado", () => {
  it("un documento nuevo queda registrado con su clave", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1", servicioId: "JUR-C071" }));
    await service.updateTicketAltaRetroactiva("t1", abogado, {
      tipoAlta: "nuevo", motivoCambio: "", geolocalizacion: null, documentos: { predial: url("Predial.pdf") },
    });
    expect(lotes[0].archivos).toHaveLength(1);
    expect(lotes[0].archivos[0]).toMatchObject({ accion: "subido", origen: "alta", campo: "predial", actorRol: "abogado" });
  });

  it("un documento que ya había subido el solicitante en el formulario anterior no se atribuye al abogado", async () => {
    const ticket = buildTicket({
      id: "t1",
      servicioId: "JUR-C071",
      documentosArrendamiento: { predial: url("Predial.pdf") } as unknown as Ticket["documentosArrendamiento"],
    });
    const { service, lotes } = montar(ticket);
    await service.updateTicketAltaRetroactiva("t1", abogado, {
      tipoAlta: "nuevo", motivoCambio: "", geolocalizacion: null, documentos: { predial: url("Predial.pdf") },
    });
    expect(lotes[0].archivos).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr y confirmar que fallan**

Run: `npx vitest run src/domain/tickets/ticket-service-archivos.test.ts`
Expected: FAIL (las firmas nuevas todavía no existen; `service.createTicket(INPUT, [..])` no registra nada, `updateConHistorial` no recibe archivos).

- [ ] **Step 3: Interfaces de repositorio**

En `src/domain/tickets/ticket-repository.ts`, agregar el import y cambiar la interfaz.

Agregar bajo los imports existentes:

```ts
import type { RegistroArchivo } from "@/types/archivo";
```

Reemplazar las líneas de `create` y `updateConHistorial` y agregar `agregarHistorial`:

```ts
// create() recibe un builder porque el folio solo se conoce dentro de la transaccion que lo genera.
// Los registros de archivos viajan en la misma transaccion: o se guarda el ticket con ellos o nada.
export interface TicketRepository {
  create(build: NewTicketBuilder, archivos?: RegistroArchivo[]): Promise<{ id: string; folio: string }>;
  getById(id: string): Promise<Ticket | null>;
  getByFolio(folio: string): Promise<Ticket | null>;
  update(id: string, patch: Partial<Ticket>): Promise<void>;
  // Ticket, entradas de historial y registros de archivos en un solo lote: o se guardan todos o ninguno.
  updateConHistorial(id: string, patch: Partial<Ticket>, entradas: EntradaHistorial[], archivos?: RegistroArchivo[]): Promise<void>;
  // Solo entradas de historial (tras crear un ticket, cuando el ticket ya existe para las reglas).
  agregarHistorial(id: string, entradas: EntradaHistorial[]): Promise<void>;
  delete(id: string): Promise<void>;
  listCerrados(): Promise<Ticket[]>;
  subscribeMany(filter: { uid: string; role: Role; supervisaUids?: string[] }, callback: (tickets: Ticket[]) => void): Unsubscribe;
  subscribeOne(id: string, callback: (ticket: Ticket | null) => void, onError?: (err: RepositoryError) => void): Unsubscribe;
}
```

Crear `src/domain/archivos/archivos-repository.ts`:

```ts
import type { RegistroArchivoGuardado } from "@/types/archivo";
import type { RepositoryError, Unsubscribe } from "@/domain/tickets/ticket-repository";

export interface ArchivosRepository {
  subscribe(
    ticketId: string,
    callback: (registros: RegistroArchivoGuardado[]) => void,
    onError?: (err: RepositoryError) => void
  ): Unsubscribe;
}
```

- [ ] **Step 4: Implementación Firestore**

Crear `src/infrastructure/firestore/archivos-repository.ts`:

```ts
import { collection, doc, onSnapshot, type DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { RegistroArchivo } from "@/types/archivo";
import type { ArchivosRepository } from "@/domain/archivos/archivos-repository";

// Referencia nueva (id autogenerado) en tickets/{ticketId}/archivos, para agregarla a un writeBatch o transaccion.
export function nuevoRegistroArchivoRef(ticketId: string): DocumentReference {
  return doc(collection(db, "tickets", ticketId, "archivos"));
}

export const firestoreArchivosRepository: ArchivosRepository = {
  subscribe(ticketId, callback, onError) {
    return onSnapshot(
      collection(db, "tickets", ticketId, "archivos"),
      (snap) => callback(snap.docs.map((d) => ({ ...(d.data() as RegistroArchivo), id: d.id }))),
      onError ? (err) => onError({ code: err.code }) : undefined
    );
  },
};
```

En `src/infrastructure/firestore/ticket-repository.ts`:

Agregar el import junto a `nuevaEntradaHistorialRef`:

```ts
import { nuevoRegistroArchivoRef } from "./archivos-repository";
```

Cambiar la firma de `create` y escribir los registros dentro de la transacción (después de `tx.set(ref, ticket);`):

```ts
  async create(build, archivos = []) {
```

```ts
      tx.set(counterRef, { next: next + 1 }, { merge: true });
      tx.set(ref, ticket);
      for (const registro of archivos) tx.set(nuevoRegistroArchivoRef(ref.id), registro);
```

Reemplazar `updateConHistorial` y agregar `agregarHistorial` justo después:

```ts
  async updateConHistorial(id, patch, entradas, archivos = []) {
    const batch = writeBatch(db);
    batch.update(doc(db, "tickets", id), patch);
    for (const entrada of entradas) batch.set(nuevaEntradaHistorialRef(id), entrada);
    for (const registro of archivos) batch.set(nuevoRegistroArchivoRef(id), registro);
    await batch.commit();
  },

  async agregarHistorial(id, entradas) {
    const batch = writeBatch(db);
    for (const entrada of entradas) batch.set(nuevaEntradaHistorialRef(id), entrada);
    await batch.commit();
  },
```

- [ ] **Step 5: Servicio de tickets**

En `src/domain/tickets/ticket-service.ts`:

Agregar imports (junto a los demás):

```ts
import type { RegistroArchivo } from "@/types/archivo";
import {
  CAMPOS_DOCUMENTO_REVISION,
  entradaArchivo,
  registrosPorCambioDeSlots,
  registrosPorCambioDeUrls,
} from "@/domain/archivos/archivo-rules";
import { DOCUMENTOS_ALTA, documentosAltaIniciales } from "./alta-arrendador-rules";
```

Nota: `alta-arrendador-rules` ya se importa con `calcularPatchAltaRetroactiva, esAltaRetroactiva, validarAltaRetroactiva, type AltaRetroactivaCapturada`; en lugar de un segundo import, agregar `DOCUMENTOS_ALTA` y `documentosAltaIniciales` a esa línea existente.

Reemplazar `createTicket`:

```ts
  async function createTicket(input: NuevoTicketInput, archivos: RegistroArchivo[] = []): Promise<{ id: string; folio: string }> {
    const servicio = catalogo.findServicio(input.servicioId);
    if (!servicio) throw new Error("Servicio no encontrado en el catalogo.");

    let mensaje = "";
    const resultado = await repo.create(({ id, folio }) => {
      mensaje = `Nueva solicitud ${folio}: ${servicio.servicio}`;
      return { ticket: buildNuevoTicket(input, servicio, { id, folio }, new Date()), notificacionMensaje: mensaje };
    }, archivos);

    // Los registros ya quedaron guardados con el ticket. Las entradas del historial van aparte porque
    // las reglas necesitan que el ticket exista; si fallan, el registro de quien subio cada archivo se conserva.
    if (archivos.length > 0) {
      await repo
        .agregarHistorial(resultado.id, archivos.map(entradaArchivo))
        .catch((err) => console.error("No se pudo agregar el historial de archivos:", err));
    }

    await notifier
      .ticketCreado({ ticketId: resultado.id, folio: resultado.folio, mensaje, solicitanteId: input.solicitanteId })
      .catch(() => {});

    return resultado;
  }
```

En `updateTicketSolicitud`, reemplazar las dos líneas de `const patch ...` hasta `await repo.updateConHistorial(...)` por:

```ts
    const ahora = new Date();
    const patch = calcularPatchSolicitud(current, input, servicio);
    const nombreServicio = (servicioId: string) => catalogo.findServicio(servicioId)?.servicio ?? null;
    const registros = registrosPorCambioDeUrls(
      current.documentacion, patch.documentacion ?? current.documentacion, "documentacion", actor, ahora
    );
    const entradas = [
      ...conVisibilidad(entradasSolicitud(current, patch, actor, ahora, nombreServicio), current, actor),
      ...registros.map(entradaArchivo),
    ];
    await repo.updateConHistorial(id, patch, entradas, registros);
```

Reemplazar `updateTicketRevisionLegal`:

```ts
  async function updateTicketRevisionLegal(id: string, actor: ActorHistorial, revision: RevisionLegal): Promise<void> {
    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");
    if (!usaFormularioAlta(current.servicioId)) throw new Error("El ticket no es un alta ni un cambio de arrendador.");
    if (!etapaPermiteEditar(current)) {
      throw new Error("La revisión legal ya no se puede editar porque el ticket está en Pre-Cierre o Cierre.");
    }
    const normalizada = normalizarRevisionLegal(revision);
    const registros = registrosPorCambioDeSlots(
      current.revisionLegal, normalizada, CAMPOS_DOCUMENTO_REVISION, "revision_legal", actor, new Date()
    );
    await repo.updateConHistorial(id, { revisionLegal: normalizada }, registros.map(entradaArchivo), registros);
    await refrescarResumenSiVisible({ ...current, revisionLegal: normalizada } as Ticket);
  }
```

Reemplazar `updateTicketAltaRetroactiva`:

```ts
  async function updateTicketAltaRetroactiva(id: string, actor: ActorHistorial, entrada: AltaRetroactivaCapturada): Promise<void> {
    const errores = validarAltaRetroactiva(entrada);
    const primero = Object.values(errores)[0];
    if (primero) throw new Error(primero);

    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");
    if (!esAltaRetroactiva(current)) throw new Error("Este ticket ya tiene los datos de alta capturados por el solicitante.");
    if (bloqueadoPorPreCierre(current.estatus)) throw new Error(MENSAJE_BLOQUEO_PRE_CIERRE);

    const patch = calcularPatchAltaRetroactiva(entrada);
    // "Antes" es lo que el formulario mostro al abogado: incluye los documentos que el solicitante subio en el
    // formulario anterior, que no se le atribuyen al abogado.
    const registros = registrosPorCambioDeSlots(
      documentosAltaIniciales(current),
      patch.altaArrendador?.documentos,
      DOCUMENTOS_ALTA.map((d) => d.key),
      "alta",
      actor,
      new Date()
    );
    await repo.updateConHistorial(id, patch, registros.map(entradaArchivo), registros);
    await refrescarResumenSiVisible({ ...current, ...patch } as Ticket);
  }
```

- [ ] **Step 6: Correr pruebas y tipos**

Run: `npx vitest run src/domain/tickets/ticket-service-archivos.test.ts`
Expected: PASS (todas).

Run: `npx tsc --noEmit`
Expected: errores solo en `src/components/tickets/ticket-detail.tsx` (las dos llamadas con la firma anterior de `updateTicketAltaRetroactiva` y `updateTicketRevisionLegal`). Se corrigen en Task 4. Cualquier otro error se arregla aquí.

Run: `npx vitest run`
Expected: todas las pruebas pasan (las existentes de `ticket-service.test.ts` no cambian: su repositorio falso ignora el cuarto parámetro).

- [ ] **Step 7: Commit (solo si el usuario lo autoriza)**

```bash
git add src/domain/archivos src/infrastructure/firestore src/domain/tickets
git commit -m "feat: el servicio de tickets registra quien sube y quita cada archivo"
```

---

### Task 3: Reglas de Firestore

**Files:**
- Modify: `firestore.rules:77-105` (historial), `firestore.rules:241-247` (create de historial), y agregar el bloque `archivos`.

**Interfaces:**
- Consumes: forma de `RegistroArchivo` (Task 1) y `TIPOS_HISTORIAL_PROCESO` (Task 1).
- Produces: permisos para que Tasks 4 y 5 funcionen contra Firestore real.

No hay emulador de reglas en el repo: se verifica leyendo las reglas y probando en la app (Task 6).

- [ ] **Step 1: Aceptar los tipos nuevos en el historial**

En `visibilidadSolicitanteValida`, ampliar la lista de tipos de proceso:

```
                     || e.tipo in ["estatus", "asignacion", "notas_cierre", "visto_bueno", "cambios_solicitados",
                                   "archivo_subido", "archivo_eliminado"]));
```

En `entradaHistorialValida`, ampliar la lista de tipos:

```
             && e.tipo in ["estatus", "asignacion", "solicitud", "documentos", "sitio", "contrato", "exclusion",
                           "notas_cierre", "visto_bueno", "comentario_editado", "comentario_eliminado",
                           "archivo_subido", "archivo_eliminado"];
```

En `match /tickets/{ticketId}/historial/{entradaId}`, `allow create`, permitir al solicitante dueño los tipos de archivo:

```
                        || (esDuenoTicket(ticketId) && request.resource.data.tipo in ["solicitud", "documentos", "archivo_subido", "archivo_eliminado"])
```

Actualizar también el comentario que dice "Sincronizar con TIPOS_HISTORIAL" sin cambiar su texto: ya apunta al lugar correcto.

- [ ] **Step 2: Agregar la subcolección `archivos`**

Insertar justo después del bloque `match /tickets/{ticketId}/historial/{entradaId} { ... }`:

```
    // Quien sube o quita cada archivo. Solo se agrega: nadie edita ni borra registros.
    // Lectura: quien puede leer el ticket (dueno, Legal, admin y el gerente que supervisa al dueno).
    // Creacion: el actor firma con su propio uid y rol real. Se usa getAfter para el dueno porque al crear
    // un ticket el registro va en la misma transaccion y get() todavia no ve el ticket.
    // Sincronizar con src/types/archivo.ts.
    match /tickets/{ticketId}/archivos/{archivoId} {
      allow read: if isSignedIn()
                  && (esDuenoTicket(ticketId) || isLegalStaff() || isAdmin()
                      || supervisaA(get(/databases/$(database)/documents/tickets/$(ticketId)).data.solicitanteId));

      allow create: if isSignedIn()
                    && request.resource.data.keys().hasOnly(["nombre", "ruta", "origen", "campo", "accion", "fecha", "actorUid", "actorNombre", "actorRol"])
                    && request.resource.data.keys().hasAll(["nombre", "ruta", "origen", "accion", "fecha", "actorUid", "actorNombre", "actorRol"])
                    && request.resource.data.actorUid == request.auth.uid
                    && request.resource.data.actorRol == myRole()
                    && request.resource.data.nombre is string
                    && request.resource.data.ruta is string
                    && request.resource.data.fecha is string
                    && request.resource.data.actorNombre is string
                    && request.resource.data.origen in ["documentacion", "formato_arrendamiento", "documento_arrendamiento", "alta", "revision_legal"]
                    && request.resource.data.accion in ["subido", "eliminado"]
                    && (isLegalStaff() || isAdmin()
                        || getAfter(/databases/$(database)/documents/tickets/$(ticketId)).data.solicitanteId == request.auth.uid);

      allow update, delete: if false;
    }
```

- [ ] **Step 3: Revisar**

Leer `firestore.rules` completo una vez: llaves balanceadas, la regla `archivos` está dentro de `match /databases/{database}/documents`, y ninguna otra regla cambió. No desplegar sin autorización del usuario.

- [ ] **Step 4: Commit (solo si el usuario lo autoriza)**

```bash
git add firestore.rules
git commit -m "feat: reglas de Firestore para el registro de archivos por ticket"
```

---

### Task 4: Mostrar quién subió cada archivo y conectar el detalle del ticket

**Files:**
- Create: `src/hooks/use-archivos-ticket.ts`
- Create: `src/components/tickets/autor-archivo.tsx`
- Modify: `src/components/tickets/ticket-detail.tsx` (imports, llamadas a servicios, 4 listas de archivos)
- Modify: `src/components/tickets/revision-legal-panel.tsx:11-18,121-123`

**Interfaces:**
- Consumes: `firestoreArchivosRepository`, `autorDeArchivo`, `RegistroArchivoGuardado`, `etiquetaRol` de `@/domain/tickets/rol-presentacion`, `formatFecha` de `@/lib/format-fecha`.
- Produces: `useArchivosTicket(ticketId, habilitado): RegistroArchivoGuardado[]`; `<AutorArchivo url registros />`; `RevisionLegalPanel` acepta `registros?: RegistroArchivoGuardado[]`.

- [ ] **Step 1: Hook**

Crear `src/hooks/use-archivos-ticket.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { firestoreArchivosRepository } from "@/infrastructure/firestore/archivos-repository";
import type { RegistroArchivoGuardado } from "@/types/archivo";

// Registros de quién subió cada archivo del ticket. Si no hay permiso o falla, queda vacío:
// la pantalla muestra "Origen no registrado" y no se rompe.
export function useArchivosTicket(ticketId: string, habilitado: boolean): RegistroArchivoGuardado[] {
  const [registros, setRegistros] = useState<RegistroArchivoGuardado[]>([]);

  useEffect(() => {
    if (!habilitado) return;
    return firestoreArchivosRepository.subscribe(ticketId, setRegistros, () => setRegistros([]));
  }, [ticketId, habilitado]);

  return habilitado ? registros : [];
}
```

- [ ] **Step 2: Componente**

Crear `src/components/tickets/autor-archivo.tsx`:

```tsx
import { autorDeArchivo } from "@/domain/archivos/archivo-rules";
import { etiquetaRol } from "@/domain/tickets/rol-presentacion";
import { formatFecha } from "@/lib/format-fecha";
import type { RegistroArchivoGuardado } from "@/types/archivo";

// Una línea con quién subió el archivo, su rol y cuándo. Sin registro (ticket anterior): "Origen no registrado".
export function AutorArchivo({ url, registros }: { url: string; registros: RegistroArchivoGuardado[] }) {
  const autor = autorDeArchivo(registros, url);
  return (
    <span className="block w-full text-xs text-muted">
      {autor
        ? `Subido por ${autor.actorNombre || "usuario sin nombre"} (${etiquetaRol(autor.actorRol)}), ${formatFecha(autor.fecha, { conHora: true })}`
        : "Origen no registrado"}
    </span>
  );
}
```

- [ ] **Step 3: Conectar `ticket-detail.tsx`**

Agregar imports:

```tsx
import { AutorArchivo } from "./autor-archivo";
import { useArchivosTicket } from "@/hooks/use-archivos-ticket";
```

Después de la línea `const esDueno = ticket.solicitanteId === uid;` (dentro de `TicketDetail`, ya con `ticket` cargado, línea ~193), agregar:

```tsx
  const registrosArchivos = useArchivosTicket(id, !modoEjemplo);
```

Importante: los hooks no pueden ir después de un `return` condicional. Ubicar esa línea junto a los demás hooks al inicio del componente (justo después de `const actor = ...` / `useAuthStore`), no después de los `if (!ticket) return`. Si `modoEjemplo` aún no está definido en ese punto, mover la línea a donde ya esté definido pero antes de cualquier `return` anticipado.

Cambiar las dos llamadas que cambiaron de firma (líneas ~797 y ~809):

```tsx
          <AltaRetroactivaForm
            ticketId={id}
            ticket={ticket}
            onGuardar={async (entrada) => {
              if (!actor) throw new Error("Tu sesión no está disponible. Recarga la página.");
              await updateTicketAltaRetroactiva(id, actor, entrada);
            }}
          />
```

```tsx
          <RevisionLegalPanel
            ticketId={id}
            revision={ticket.revisionLegal}
            registros={registrosArchivos}
            editable={puedeEditarRevision}
            simulado={modoEjemplo}
            onGuardar={async (rev) => {
              if (!actor) throw new Error("Tu sesión no está disponible. Recarga la página.");
              await updateTicketRevisionLegal(id, actor, rev);
            }}
          />
```

Lista de documentación (dentro del `<li key={url}>` de `ticket.documentacion.map`), agregar después de `EnlaceDocumento` y de la etiqueta original, antes de `puedeEditarEtiquetas`:

```tsx
                        <AutorArchivo url={url} registros={registrosArchivos} />
```

Formato de arrendamiento (reemplazar el ternario del bloque `ticket.formatoArrendamientoUrl`):

```tsx
                {ticket.formatoArrendamientoUrl
                  ? (
                    <>
                      <EnlaceDocumento url={ticket.formatoArrendamientoUrl} etiqueta={nombreArchivo(ticket.formatoArrendamientoUrl)} />
                      <AutorArchivo url={ticket.formatoArrendamientoUrl} registros={registrosArchivos} />
                    </>
                  )
                  : <p className="text-sm text-muted">Sin adjuntar</p>}
```

Documentos de arrendamiento (el `url ? <EnlaceDocumento .../> : <span ...>` dentro de `DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO.map`):

```tsx
                        {url
                          ? (
                            <>
                              <EnlaceDocumento url={url} etiqueta={doc.label} />
                              <AutorArchivo url={url} registros={registrosArchivos} />
                            </>
                          )
                          : <span className="text-sm text-muted">{doc.label}: sin adjuntar</span>}
```

Documentos de alta (el mismo patrón dentro de `DOCUMENTOS_ALTA.filter(...).map`):

```tsx
                          {url
                            ? (
                              <>
                                <EnlaceDocumento url={url} etiqueta={doc.label} />
                                <AutorArchivo url={url} registros={registrosArchivos} />
                              </>
                            )
                            : <span className="text-sm text-muted">{doc.label}: sin adjuntar</span>}
```

- [ ] **Step 4: Anexos de la revisión legal**

En `src/components/tickets/revision-legal-panel.tsx`:

Imports:

```tsx
import { AutorArchivo } from "./autor-archivo";
import type { RegistroArchivoGuardado } from "@/types/archivo";
```

En `Props`, agregar:

```tsx
  // Quién subió cada archivo guardado; sin esto (jefe de zona, Sitios) no se muestra el autor.
  registros?: RegistroArchivoGuardado[];
```

En la firma: `export function RevisionLegalPanel({ ticketId, revision, registros, editable, onGuardar, simulado = false }: Props) {`

En la función `documento(...)`, después del `<a href=...>Ver documento subido</a>`:

```tsx
      {r[campo] && registros && revision?.[campo] === r[campo] && <AutorArchivo url={r[campo]!} registros={registros} />}
```

(Solo se muestra cuando el archivo ya está guardado; uno recién subido y aún sin guardar no tiene registro y no debe decir "Origen no registrado".)

- [ ] **Step 5: Tipos y pruebas**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npx vitest run`
Expected: todas pasan.

- [ ] **Step 6: Commit (solo si el usuario lo autoriza)**

```bash
git add src/hooks/use-archivos-ticket.ts src/components/tickets
git commit -m "feat: se muestra quien subio cada archivo en el detalle del ticket"
```

---

### Task 5: Registrar los archivos al crear un ticket

**Files:**
- Modify: `src/components/tickets/nuevo-ticket-form.tsx` (imports, `enviar()`)

**Interfaces:**
- Consumes: `registrosDeCreacion` (Task 1), `createTicket(input, archivos)` (Task 2), `roleReal` del store.
- Produces: tickets nuevos con un registro por archivo.

- [ ] **Step 1: Imports y rol real**

Agregar import:

```tsx
import { registrosDeCreacion } from "@/domain/archivos/archivo-rules";
```

Cambiar la línea del store (línea ~69) para leer también `roleReal`:

```tsx
  const { uid, nombre, role, roleReal } = useAuthStore();
```

(`role` sigue usándose para `ocultaSla`; `roleReal` es el rol que validan las reglas.)

- [ ] **Step 2: Armar los registros en `enviar()`**

Después de `const documentacion = files.filter(...)...;` y antes de `const { id, folio } = await createTicket({`, agregar:

```tsx
      const archivos = registrosDeCreacion(
        [
          { origen: "documentacion", archivos: files },
          ...(requiereFormato ? [{ origen: "formato_arrendamiento" as const, archivos: formatoFiles }] : []),
          ...(requiereDocumentosIndividuales
            ? DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO.map((d) => ({
                origen: "documento_arrendamiento" as const, campo: d.key, archivos: documentosFiles[d.key],
              }))
            : []),
          ...(esAlta
            ? docsAlta.map((d) => ({ origen: "alta" as const, campo: d.key, archivos: altaDocsFiles[d.key] ?? [] }))
            : []),
        ],
        { uid, nombre, rol: roleReal },
        new Date()
      );
```

Cambiar el cierre de la llamada a `createTicket` para pasar los registros como segundo argumento:

```tsx
      const { id, folio } = await createTicket(
        {
          solicitanteId: uid,
          solicitanteNombre: nombre,
          areaEmpresa: form.areaEmpresa,
          servicioId: form.servicioId,
          descripcion: form.descripcion,
          documentacion,
          formatoArrendamientoUrl: requiereFormato ? formatoFiles[0]?.url : undefined,
          documentosArrendamiento,
          contratoArrendamiento,
          ...(altaArrendador ? { altaArrendador } : {}),
          sitioArrendamiento: { clave: sitio.clave, alias: sitio.alias },
        },
        archivos
      );
```

Los grupos replican exactamente lo que ya entra al ticket: `formatoFiles` solo si `requiereFormato`, los documentos individuales solo si `requiereDocumentosIndividuales`, los de Alta solo si `esAlta` y solo las claves de `docsAlta`. Los archivos de borrador que se quitaron o fallaron no aparecen (se filtran por `status === "done"` y por estar en el estado actual).

- [ ] **Step 3: Tipos y pruebas**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sin errores y todas las pruebas pasan.

- [ ] **Step 4: Commit (solo si el usuario lo autoriza)**

```bash
git add src/components/tickets/nuevo-ticket-form.tsx
git commit -m "feat: se registra quien sube cada archivo al crear un ticket"
```

---

### Task 6: Corregir el spec y verificar en la app

**Files:**
- Modify: `docs/superpowers/specs/2026-11-20-trazabilidad-archivos-design.md`

- [ ] **Step 1: Corregir el spec**

En la tabla "Modelo de datos", fila `origen`, reemplazar el texto por:

```
| `origen` | De dónde viene: `documentacion`, `formato_arrendamiento`, `documento_arrendamiento`, `alta`, `revision_legal`. |
```

En "Dónde se escribe", reemplazar la fila de Alta retroactiva por:

```
| Alta retroactiva | `alta-retroactiva-form.tsx` | Actualiza un ticket que ya existe: los registros van en el mismo lote que guarda los datos de alta. |
```

y agregar debajo de la tabla:

```
El contrato no tiene un camino de subida propio: es un archivo más de `documentacion`, por eso no hay origen `contrato`.
Las entradas del Historial de los archivos subidos al crear el ticket se escriben justo después de crearlo (las reglas
necesitan que el ticket exista); el registro de cada archivo sí se guarda atómicamente con el ticket.
Los dos tipos de historial nuevos son "de proceso": el solicitante y los abogados ven todas las subidas, sin importar quién las haga.
```

- [ ] **Step 2: Verificación automática final**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sin errores; todas las pruebas pasan.

- [ ] **Step 3: Desplegar reglas (con autorización del usuario) y verificar en el navegador**

Pedir al usuario que autorice y desplegar primero las reglas: `firebase deploy --only firestore:rules`.

Luego, con `npm run dev` y el navegador:
1. Crear un ticket nuevo con dos archivos de documentación. En el detalle, cada archivo debe decir `Subido por <nombre> (<rol>), <fecha>`. El Historial debe tener dos entradas "Archivo subido".
2. Como solicitante dueño o admin, editar la solicitud: agregar un archivo y quitar otro. El historial muestra "Archivo subido" y "Archivo eliminado" con el actor y su rol.
3. Abrir un ticket anterior a este cambio: sus archivos dicen `Origen no registrado`.
4. En un ticket de Alta, como abogado asignado, subir un anexo en la revisión legal y guardar: aparece su nombre y rol junto al anexo.
5. Con un gerente jurídico, agregar un documento: aparece como `Gerente Jurídico`.

- [ ] **Step 4: Commit (solo si el usuario lo autoriza)**

```bash
git add docs/superpowers/specs/2026-11-20-trazabilidad-archivos-design.md
git commit -m "docs: corrige el spec de trazabilidad de archivos"
```
