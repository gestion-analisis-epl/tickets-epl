# Alta de Arrendador Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar el formulario de Alta de Arrendadores (JUR-C071) con tipo de alta, domicilio desglosado, geolocalización y documentos nuevos, y agregar la sección "Revisión legal" (propietario, acreditación, limitaciones, beneficiarios, condición de pago) que llena el abogado.

**Architecture:** Dos bloques nuevos en el ticket de Firestore: `altaArrendador` (solicitante) y `revisionLegal` (abogado). La lógica (validación, limpieza de ramas, reparto, compuerta a Pre-Cierre) vive en funciones puras de `src/domain/tickets/` con pruebas; la UI y las reglas de Firestore solo las consumen.

**Tech Stack:** Next.js 16 / React 19, TypeScript, Firestore, Vitest (`pnpm test`), ESLint.

**Spec:** `docs/superpowers/specs/2026-10-27-alta-arrendador-design.md`

## Global Constraints

- Aplica **solo** a `JUR-C071`. `JUR-C072` (Cambio de Arrendador) no se toca.
- Tickets de C071 anteriores (sin `altaArrendador`) no se bloquean por los campos nuevos.
- Se conservan todos los campos actuales del formulario (clave, alias, vigencia, monto, condiciones de pago, motivo, solicitante, etc.).
- Porcentajes como enteros en centésimas de por ciento: `10000` = 100 %. Siempre suman `10000`.
- Firestore rechaza `undefined`: nunca escribir llaves con valor `undefined`.
- Solo el abogado asignado y los roles tipo admin escriben `revisionLegal`; Mesa de Control no.
- `revisionLegal` queda bloqueada en Pre-Cierre y Cierre (se corrige regresando el ticket de etapa).
- La UI usa lenguaje simple, un dato por campo, nada cortado (usuarios sin conocimiento técnico).
- `AGENTS.md`: esta versión de Next tiene cambios que rompen convenciones; antes de la Task 8 revisar `node_modules/next/dist/docs/`. Si la carpeta no existe, avisar al usuario antes de continuar (no inventar APIs).
- Comandos desde la raíz del repo. Pruebas: `pnpm test -- <archivo>`. Verificación final: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/types/ticket.ts` (mod) | Tipos `AltaArrendadorInput`, `RevisionLegal` y campos nuevos de `Ticket` |
| `src/domain/tickets/alta-arrendador-rules.ts` (nuevo) | Constantes, texto de domicilio, validación del bloque del solicitante |
| `src/domain/tickets/revision-legal-rules.ts` (nuevo) | Reparto, normalización, faltantes, permisos, error de compuerta |
| `src/domain/sitios/sitios-rules.ts` (mod) | Columna opcional `anun_Geolocalizacion` |
| `src/domain/tickets/nuevo-ticket-validacion.ts` (mod) | Integra la validación del bloque nuevo |
| `src/domain/tickets/nuevo-ticket.ts` (mod) | Pasa `altaArrendador` al ticket |
| `src/domain/tickets/ticket-service.ts` (mod) + `src/lib/tickets.ts` (mod) | Compuerta y `updateTicketRevisionLegal` |
| `src/domain/contratos/contrato-rules.ts` (mod) | Documentos del bloque nuevo en el resumen |
| `src/components/tickets/alta-arrendador-fields.tsx` (nuevo) | Campos del solicitante (tipo, motivo, domicilio, geolocalización) |
| `src/components/tickets/nuevo-ticket-form.tsx` (mod) | Integra campos y documentos nuevos solo en C071 |
| `src/components/tickets/revision-legal-panel.tsx` (nuevo) | Formulario del abogado |
| `src/components/tickets/ticket-detail.tsx` (mod) | Muestra datos nuevos e inserta el panel |
| `firestore.rules` (mod) | Permisos de `revisionLegal` |

---

### Task 1: Tipos y constantes

**Files:**
- Modify: `src/types/ticket.ts`
- Create: `src/domain/tickets/alta-arrendador-rules.ts`
- Test: `src/domain/tickets/alta-arrendador-rules.test.ts`

**Interfaces:**
- Produces (`types/ticket.ts`):
  - `TipoAlta = "nuevo" | "cambio"`
  - `DomicilioDesglosado { calle; numero; interior; colonia; municipio; estado; cp; entreCalles: string }`
  - `DocumentoAltaKey = "identificaciones" | "personalidadLegal" | "acreditacionPropiedad" | "predial" | "comprobanteDomicilio" | "contratoAnterior"`
  - `AltaArrendadorInput { tipoAlta: TipoAlta; motivoCambio?: string; domicilio: DomicilioDesglosado; geolocalizacion?: string; documentos: Partial<Record<DocumentoAltaKey, string>> }`
  - `RevisionLegal` (ver código) y `Ticket.altaArrendador?`, `Ticket.revisionLegal?`
- Produces (`alta-arrendador-rules.ts`): `DOCUMENTOS_ALTA`, `documentosAltaRequeridos(tipo)`, `domicilioTexto(d)`, `DOMICILIO_VACIO`, `validarAlta(a)`, tipo `AltaCapturada`.

- [ ] **Step 1: Agregar los tipos a `src/types/ticket.ts`**

Insertar después de `DocumentosArrendamientoInput`:

```ts
export type TipoAlta = "nuevo" | "cambio";

export interface DomicilioDesglosado {
  calle: string;
  numero: string;
  interior: string; // opcional: "" si no aplica
  colonia: string;
  municipio: string;
  estado: string;
  cp: string;
  entreCalles: string;
}

export type DocumentoAltaKey =
  | "identificaciones" | "personalidadLegal" | "acreditacionPropiedad"
  | "predial" | "comprobanteDomicilio" | "contratoAnterior";

// Solo Alta de Arrendadores (JUR-C071). Lo llena el solicitante.
export interface AltaArrendadorInput {
  tipoAlta: TipoAlta;
  motivoCambio?: string; // solo si tipoAlta === "cambio"
  domicilio: DomicilioDesglosado;
  geolocalizacion?: string; // copiada de la hoja de sitios; ausente si la hoja no la trae
  documentos: Partial<Record<DocumentoAltaKey, string>>; // URLs de Storage
}

export type TipoPropietario = "fisica" | "moral";
export type EscenarioBeneficiario = "propietario" | "tercero" | "varios";
export type ModalidadVarios = "equitativo" | "representante";

export interface Beneficiario {
  nombre: string;
  porcentaje: number; // centesimas de por ciento: 10000 = 100 %
}

// Lo llena el abogado asignado. Todo opcional: se guarda a medias.
export interface RevisionLegal {
  tipoPropietario?: TipoPropietario;
  nombrePropietario?: string; // persona fisica: nombre completo; moral: razon social
  representanteLegal?: string; // solo moral
  documentoPersonalidad?: string; // solo moral (URL)
  acreditaPropiedad?: boolean;
  documentoPropiedad?: string; // si acreditaPropiedad === true
  cartaAutorizacion?: string; // si acreditaPropiedad === false
  hayLimitacion?: boolean;
  tipoLimitacion?: string; // si hayLimitacion === true
  escenarioBeneficiario?: EscenarioBeneficiario;
  beneficiarioNombre?: string; // escenario "tercero"
  documentoBeneficiario?: string; // escenario "tercero"
  clausulaEspecial?: boolean; // escenario "tercero": recordatorio del abogado
  modalidadVarios?: ModalidadVarios; // escenario "varios"
  beneficiarios?: Beneficiario[]; // escenario "varios"
  representanteComun?: number; // indice en beneficiarios, modalidad "representante"
  documentoRepresentante?: string; // modalidad "representante"
  cartaRepresentante?: string; // modalidad "representante"
  hayCondicionPago?: boolean;
  condicionPago?: string; // si hayCondicionPago === true
}
```

En `interface Ticket`, debajo de `contratoArrendamiento?`, agregar:

```ts
  altaArrendador?: AltaArrendadorInput; // JUR-C071; ausente en tickets previos
  revisionLegal?: RevisionLegal; // la llena el abogado asignado
```

- [ ] **Step 2: Escribir la prueba que falla**

`src/domain/tickets/alta-arrendador-rules.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DOMICILIO_VACIO, documentosAltaRequeridos, domicilioTexto, validarAlta } from "./alta-arrendador-rules";

const DOM = { calle: "Reforma", numero: "10", interior: "", colonia: "Centro", municipio: "Queretaro", estado: "Qro", cp: "76000", entreCalles: "A y B" };

describe("documentosAltaRequeridos", () => {
  it("el contrato anterior solo se pide en cambio", () => {
    expect(documentosAltaRequeridos("nuevo").map((d) => d.key)).not.toContain("contratoAnterior");
    expect(documentosAltaRequeridos("cambio").map((d) => d.key)).toContain("contratoAnterior");
  });
});

describe("domicilioTexto", () => {
  it("arma el texto sin el interior vacio", () => {
    expect(domicilioTexto(DOM)).toBe("Reforma 10, Col. Centro, Queretaro, Qro, CP 76000, entre A y B");
  });
  it("incluye el interior cuando existe", () => {
    expect(domicilioTexto({ ...DOM, interior: "3" })).toContain("Int. 3");
  });
});

describe("validarAlta", () => {
  it("una alta nueva completa no tiene errores", () => {
    expect(validarAlta({ tipoAlta: "nuevo", motivoCambio: "", domicilio: DOM })).toEqual({});
  });
  it("exige el tipo de alta", () => {
    expect(validarAlta({ tipoAlta: "", motivoCambio: "", domicilio: DOM }).tipoAlta).toBeTruthy();
  });
  it("exige el motivo solo si es cambio", () => {
    expect(validarAlta({ tipoAlta: "cambio", motivoCambio: " ", domicilio: DOM }).motivoCambio).toBeTruthy();
    expect(validarAlta({ tipoAlta: "nuevo", motivoCambio: "", domicilio: DOM }).motivoCambio).toBeUndefined();
  });
  it("exige cada campo del domicilio salvo el interior", () => {
    const e = validarAlta({ tipoAlta: "nuevo", motivoCambio: "", domicilio: DOMICILIO_VACIO });
    expect(Object.keys(e)).toEqual(expect.arrayContaining(["calle", "numero", "colonia", "municipio", "estado", "cp", "entreCalles"]));
    expect(e.interior).toBeUndefined();
  });
});
```

- [ ] **Step 3: Verificar que falla**

Run: `pnpm test -- src/domain/tickets/alta-arrendador-rules.test.ts`
Expected: FAIL (módulo `./alta-arrendador-rules` no existe).

- [ ] **Step 4: Implementar `src/domain/tickets/alta-arrendador-rules.ts`**

```ts
import type { DocumentoAltaKey, DomicilioDesglosado, TipoAlta } from "@/types/ticket";

export const DOMICILIO_VACIO: DomicilioDesglosado = {
  calle: "", numero: "", interior: "", colonia: "", municipio: "", estado: "", cp: "", entreCalles: "",
};

export const DOCUMENTOS_ALTA: { key: DocumentoAltaKey; label: string; soloCambio?: boolean }[] = [
  { key: "identificaciones", label: "Identificaciones" },
  { key: "personalidadLegal", label: "Personalidad legal" },
  { key: "acreditacionPropiedad", label: "Acreditación de propiedad" },
  { key: "predial", label: "Predial" },
  { key: "comprobanteDomicilio", label: "Comprobante de domicilio" },
  { key: "contratoAnterior", label: "Contrato anterior", soloCambio: true },
];

export function documentosAltaRequeridos(tipo: TipoAlta | "") {
  return DOCUMENTOS_ALTA.filter((d) => !d.soloCambio || tipo === "cambio");
}

export const ETIQUETAS_DOMICILIO: Record<keyof DomicilioDesglosado, string> = {
  calle: "Calle", numero: "Número", interior: "Interior (si aplica)", colonia: "Colonia",
  municipio: "Municipio", estado: "Estado", cp: "Código postal", entreCalles: "Entre calles",
};

// El texto unico sigue existiendo en contratoArrendamiento.domicilio (resumenes y correos lo usan).
export function domicilioTexto(d: DomicilioDesglosado): string {
  return [
    [d.calle, d.numero].filter(Boolean).join(" "),
    d.interior && `Int. ${d.interior}`,
    d.colonia && `Col. ${d.colonia}`,
    d.municipio,
    d.estado,
    d.cp && `CP ${d.cp}`,
    d.entreCalles && `entre ${d.entreCalles}`,
  ].filter(Boolean).join(", ");
}

export interface AltaCapturada {
  tipoAlta: TipoAlta | "";
  motivoCambio: string;
  domicilio: DomicilioDesglosado;
}

export function validarAlta(a: AltaCapturada): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!a.tipoAlta) errores.tipoAlta = "Selecciona el tipo de alta.";
  if (a.tipoAlta === "cambio" && !a.motivoCambio.trim()) errores.motivoCambio = "Explica el motivo del cambio de arrendador.";
  for (const campo of Object.keys(ETIQUETAS_DOMICILIO) as (keyof DomicilioDesglosado)[]) {
    if (campo !== "interior" && !a.domicilio[campo].trim()) errores[campo] = `Captura: ${ETIQUETAS_DOMICILIO[campo].toLowerCase()}.`;
  }
  return errores;
}
```

- [ ] **Step 5: Verificar que pasa**

Run: `pnpm test -- src/domain/tickets/alta-arrendador-rules.test.ts` → PASS. Luego `pnpm exec tsc --noEmit` → sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/types/ticket.ts src/domain/tickets/alta-arrendador-rules.ts src/domain/tickets/alta-arrendador-rules.test.ts
git commit -m "feat: tipos y reglas del bloque de alta de arrendador"
```

---

### Task 2: Reglas de la revisión legal

**Files:**
- Create: `src/domain/tickets/revision-legal-rules.ts`
- Test: `src/domain/tickets/revision-legal-rules.test.ts`

**Interfaces:**
- Consumes: tipos de Task 1; `solicitudEditable` y `isAdminRole` (existentes).
- Produces:
  - `repartoEquitativo(n: number): number[]`
  - `normalizarRevisionLegal(r: RevisionLegal): RevisionLegal`
  - `faltantesRevisionLegal(r: RevisionLegal): string[]`
  - `revisionLegalPendiente(t: Pick<Ticket, "altaArrendador" | "revisionLegal">): string[]`
  - `puedeEditarRevisionLegal(sesion, ticket): boolean`
  - `class RevisionLegalIncompletaError extends Error { faltantes: string[] }`

- [ ] **Step 1: Escribir las pruebas que fallan**

`src/domain/tickets/revision-legal-rules.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  repartoEquitativo, normalizarRevisionLegal, faltantesRevisionLegal, revisionLegalPendiente, puedeEditarRevisionLegal,
} from "./revision-legal-rules";
import type { RevisionLegal } from "@/types/ticket";

const COMPLETA: RevisionLegal = {
  tipoPropietario: "fisica", nombrePropietario: "Juan Perez",
  acreditaPropiedad: true, documentoPropiedad: "u1",
  hayLimitacion: false, escenarioBeneficiario: "propietario", hayCondicionPago: false,
};

describe("repartoEquitativo", () => {
  it("suma siempre 10000 y el ultimo absorbe la diferencia", () => {
    expect(repartoEquitativo(2)).toEqual([5000, 5000]);
    expect(repartoEquitativo(3)).toEqual([3333, 3333, 3334]);
  });
});

describe("normalizarRevisionLegal", () => {
  it("borra los datos de persona moral al cambiar a fisica", () => {
    const r = normalizarRevisionLegal({ ...COMPLETA, representanteLegal: "X", documentoPersonalidad: "d" });
    expect(r.representanteLegal).toBeUndefined();
    expect(r.documentoPersonalidad).toBeUndefined();
  });
  it("conserva el documento que corresponde a acreditaPropiedad y borra el otro", () => {
    const r = normalizarRevisionLegal({ ...COMPLETA, cartaAutorizacion: "c" });
    expect(r.documentoPropiedad).toBe("u1");
    expect(r.cartaAutorizacion).toBeUndefined();
  });
  it("borra el tipo de limitacion si no hay limitacion", () => {
    expect(normalizarRevisionLegal({ ...COMPLETA, tipoLimitacion: "hipoteca" }).tipoLimitacion).toBeUndefined();
  });
  it("borra los datos de beneficiarios que no son del escenario elegido", () => {
    const r = normalizarRevisionLegal({ ...COMPLETA, beneficiarioNombre: "Z", beneficiarios: [{ nombre: "A", porcentaje: 10000 }] });
    expect(r.beneficiarioNombre).toBeUndefined();
    expect(r.beneficiarios).toBeUndefined();
  });
  it("calcula los porcentajes: equitativo y representante comun", () => {
    const base = { ...COMPLETA, escenarioBeneficiario: "varios" as const };
    const eq = normalizarRevisionLegal({ ...base, modalidadVarios: "equitativo", beneficiarios: [{ nombre: "A", porcentaje: 0 }, { nombre: "B", porcentaje: 0 }, { nombre: "C", porcentaje: 0 }] });
    expect(eq.beneficiarios!.map((b) => b.porcentaje)).toEqual([3333, 3333, 3334]);
    const rep = normalizarRevisionLegal({ ...base, modalidadVarios: "representante", representanteComun: 1, beneficiarios: [{ nombre: "A", porcentaje: 0 }, { nombre: "B", porcentaje: 0 }] });
    expect(rep.beneficiarios!.map((b) => b.porcentaje)).toEqual([0, 10000]);
  });
  it("no deja llaves undefined", () => {
    expect(Object.values(normalizarRevisionLegal(COMPLETA)).includes(undefined)).toBe(false);
  });
});

describe("faltantesRevisionLegal", () => {
  it("una revision completa no tiene faltantes", () => {
    expect(faltantesRevisionLegal(COMPLETA)).toEqual([]);
  });
  it("una revision vacia lista lo que falta", () => {
    expect(faltantesRevisionLegal({}).length).toBeGreaterThan(0);
  });
  it("persona moral exige razon social, representante y documento de personalidad", () => {
    const f = faltantesRevisionLegal({ ...COMPLETA, tipoPropietario: "moral" });
    expect(f).toEqual(expect.arrayContaining([expect.stringMatching(/representante/i), expect.stringMatching(/personalidad/i)]));
  });
  it("sin acreditar propiedad exige la carta de autorizacion", () => {
    expect(faltantesRevisionLegal({ ...COMPLETA, acreditaPropiedad: false, documentoPropiedad: undefined }).join(" ")).toMatch(/carta de autorizaci/i);
  });
  it("limitacion y condicion de pago exigen su descripcion", () => {
    const f = faltantesRevisionLegal({ ...COMPLETA, hayLimitacion: true, hayCondicionPago: true });
    expect(f.join(" ")).toMatch(/limitaci/i);
    expect(f.join(" ")).toMatch(/condici/i);
  });
  it("tercero exige nombre, acreditacion y la casilla de clausula", () => {
    const f = faltantesRevisionLegal({ ...COMPLETA, escenarioBeneficiario: "tercero" });
    expect(f.length).toBeGreaterThanOrEqual(3);
  });
  it("varios exige minimo 2 beneficiarios con nombre", () => {
    const f = faltantesRevisionLegal({ ...COMPLETA, escenarioBeneficiario: "varios", modalidadVarios: "equitativo", beneficiarios: [{ nombre: "A", porcentaje: 0 }] });
    expect(f.join(" ")).toMatch(/al menos 2/i);
  });
  it("representante comun exige elegirlo, su acreditacion y su carta", () => {
    const f = faltantesRevisionLegal({
      ...COMPLETA, escenarioBeneficiario: "varios", modalidadVarios: "representante",
      beneficiarios: [{ nombre: "A", porcentaje: 0 }, { nombre: "B", porcentaje: 0 }],
    });
    expect(f.length).toBeGreaterThanOrEqual(3);
  });
});

describe("revisionLegalPendiente", () => {
  it("un ticket sin altaArrendador (anterior al cambio) nunca queda pendiente", () => {
    expect(revisionLegalPendiente({})).toEqual([]);
  });
  it("un ticket con altaArrendador y sin revision queda pendiente", () => {
    expect(revisionLegalPendiente({ altaArrendador: {} as never }).length).toBeGreaterThan(0);
  });
});

describe("puedeEditarRevisionLegal", () => {
  const ticket = { abogadoAsignadoId: "a1", estatus: "Proceso en tramite" as const, altaArrendador: {} as never };
  it("admin y abogado asignado si; Mesa de Control y otro abogado no", () => {
    expect(puedeEditarRevisionLegal({ role: "admin", abogadoId: null }, ticket)).toBe(true);
    expect(puedeEditarRevisionLegal({ role: "abogado", abogadoId: "a1" }, ticket)).toBe(true);
    expect(puedeEditarRevisionLegal({ role: "abogado", abogadoId: "a2" }, ticket)).toBe(false);
    expect(puedeEditarRevisionLegal({ role: "mesa_control", abogadoId: null }, ticket)).toBe(false);
  });
  it("no en Pre-Cierre ni sin altaArrendador", () => {
    expect(puedeEditarRevisionLegal({ role: "admin", abogadoId: null }, { ...ticket, estatus: "Pre-Cierre" })).toBe(false);
    expect(puedeEditarRevisionLegal({ role: "admin", abogadoId: null }, { ...ticket, altaArrendador: undefined })).toBe(false);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm test -- src/domain/tickets/revision-legal-rules.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar `src/domain/tickets/revision-legal-rules.ts`**

```ts
import { isAdminRole, type Role } from "@/types/user";
import type { Beneficiario, RevisionLegal, Ticket } from "@/types/ticket";
import { solicitudEditable } from "./etapa-permisos-rules";

const TOTAL = 10000;

export class RevisionLegalIncompletaError extends Error {
  constructor(public faltantes: string[]) {
    super(`Falta completar la revisión legal: ${faltantes.join("; ")}.`);
  }
}

// El ultimo beneficiario absorbe la diferencia para que siempre sume 10000.
export function repartoEquitativo(n: number): number[] {
  const base = Math.floor(TOTAL / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? TOTAL - base * (n - 1) : base));
}

function sinUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

const lleno = (s: string | undefined) => !!s && s.trim().length > 0;

// Deja solo lo que aplica a lo elegido; lo demas se borra para no guardar datos contradictorios.
export function normalizarRevisionLegal(r: RevisionLegal): RevisionLegal {
  const moral = r.tipoPropietario === "moral";
  const escenario = r.escenarioBeneficiario;
  const varios = escenario === "varios";
  const representante = varios && r.modalidadVarios === "representante";

  let beneficiarios: Beneficiario[] | undefined;
  if (varios && r.beneficiarios) {
    const nombres = r.beneficiarios.map((b) => b.nombre);
    if (r.modalidadVarios === "equitativo") {
      const pct = repartoEquitativo(nombres.length);
      beneficiarios = nombres.map((nombre, i) => ({ nombre, porcentaje: pct[i] }));
    } else if (r.modalidadVarios === "representante") {
      beneficiarios = nombres.map((nombre, i) => ({ nombre, porcentaje: i === r.representanteComun ? TOTAL : 0 }));
    } else {
      beneficiarios = r.beneficiarios;
    }
  }

  return sinUndefined({
    tipoPropietario: r.tipoPropietario,
    nombrePropietario: r.nombrePropietario,
    representanteLegal: moral ? r.representanteLegal : undefined,
    documentoPersonalidad: moral ? r.documentoPersonalidad : undefined,
    acreditaPropiedad: r.acreditaPropiedad,
    documentoPropiedad: r.acreditaPropiedad === true ? r.documentoPropiedad : undefined,
    cartaAutorizacion: r.acreditaPropiedad === false ? r.cartaAutorizacion : undefined,
    hayLimitacion: r.hayLimitacion,
    tipoLimitacion: r.hayLimitacion === true ? r.tipoLimitacion : undefined,
    escenarioBeneficiario: escenario,
    beneficiarioNombre: escenario === "tercero" ? r.beneficiarioNombre : undefined,
    documentoBeneficiario: escenario === "tercero" ? r.documentoBeneficiario : undefined,
    clausulaEspecial: escenario === "tercero" ? r.clausulaEspecial : undefined,
    modalidadVarios: varios ? r.modalidadVarios : undefined,
    beneficiarios,
    representanteComun: representante ? r.representanteComun : undefined,
    documentoRepresentante: representante ? r.documentoRepresentante : undefined,
    cartaRepresentante: representante ? r.cartaRepresentante : undefined,
    hayCondicionPago: r.hayCondicionPago,
    condicionPago: r.hayCondicionPago === true ? r.condicionPago : undefined,
  });
}

// Lista, en lenguaje simple, lo que todavia falta para dar por completa la revision legal.
export function faltantesRevisionLegal(r: RevisionLegal): string[] {
  const f: string[] = [];
  if (!r.tipoPropietario) f.push("Indica si el propietario es persona física o moral");
  else if (!lleno(r.nombrePropietario)) f.push(r.tipoPropietario === "moral" ? "Captura la razón social del propietario" : "Captura el nombre completo del propietario");
  if (r.tipoPropietario === "moral") {
    if (!lleno(r.representanteLegal)) f.push("Captura el nombre del representante legal");
    if (!r.documentoPersonalidad) f.push("Sube el documento de personalidad con actos de dominio para arrendar");
  }

  if (r.acreditaPropiedad === undefined) f.push("Indica si se acredita la propiedad");
  else if (r.acreditaPropiedad && !r.documentoPropiedad) f.push("Sube el documento que acredita la propiedad");
  else if (!r.acreditaPropiedad && !r.cartaAutorizacion) f.push("Sube la carta de autorización");

  if (r.hayLimitacion === undefined) f.push("Indica si existe alguna limitación");
  else if (r.hayLimitacion && !lleno(r.tipoLimitacion)) f.push("Captura el tipo de limitación");

  switch (r.escenarioBeneficiario) {
    case undefined: f.push("Elige quién recibe el pago de las rentas"); break;
    case "tercero":
      if (!lleno(r.beneficiarioNombre)) f.push("Captura el nombre del beneficiario");
      if (!r.documentoBeneficiario) f.push("Sube la acreditación del beneficiario");
      if (!r.clausulaEspecial) f.push("Confirma que se redactará la cláusula especial del beneficiario");
      break;
    case "varios": {
      const lista = r.beneficiarios ?? [];
      if (lista.length < 2 || lista.some((b) => !lleno(b.nombre))) f.push("Captura al menos 2 beneficiarios, cada uno con su nombre");
      if (!r.modalidadVarios) f.push("Elige si el pago se reparte en partes iguales o a un representante común");
      if (r.modalidadVarios === "representante") {
        if (r.representanteComun === undefined || r.representanteComun >= lista.length) f.push("Elige quién es el representante común");
        if (!r.documentoRepresentante) f.push("Sube la acreditación del representante común");
        if (!r.cartaRepresentante) f.push("Sube la carta que autoriza al representante común a recibir la renta");
      }
      break;
    }
  }

  if (r.hayCondicionPago === undefined) f.push("Indica si existe condición para el pago");
  else if (r.hayCondicionPago && !lleno(r.condicionPago)) f.push("Captura la condición para el pago");
  return f;
}

// Solo aplica a tickets de Alta con el bloque nuevo; los anteriores nunca quedan pendientes.
export function revisionLegalPendiente(t: Pick<Ticket, "altaArrendador" | "revisionLegal">): string[] {
  return t.altaArrendador ? faltantesRevisionLegal(t.revisionLegal ?? {}) : [];
}

// Admin/Gerente Juridico y el abogado asignado a ESTE ticket (misma condicion que firestore.rules).
// Mesa de Control no. Bloqueada en Pre-Cierre y Cierre.
export function puedeEditarRevisionLegal(
  sesion: { role: Role | null | undefined; abogadoId: string | null | undefined },
  ticket: Pick<Ticket, "abogadoAsignadoId" | "estatus" | "altaArrendador">
): boolean {
  if (!ticket.altaArrendador || !solicitudEditable(ticket.estatus)) return false;
  if (isAdminRole(sesion.role)) return true;
  return sesion.role === "abogado" && !!sesion.abogadoId && sesion.abogadoId === ticket.abogadoAsignadoId;
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm test -- src/domain/tickets/revision-legal-rules.test.ts` → PASS. `pnpm exec tsc --noEmit` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/domain/tickets/revision-legal-rules.ts src/domain/tickets/revision-legal-rules.test.ts
git commit -m "feat: reglas de la revision legal (reparto, normalizacion, faltantes, permisos)"
```

---

### Task 3: Geolocalización opcional en el catálogo de sitios

**Files:**
- Modify: `src/domain/sitios/sitios-rules.ts`
- Test: `src/domain/sitios/sitios-rules.test.ts`

**Interfaces:**
- Produces: `Sitio.geolocalizacion?: string`. `parseFilasSitios` lee la columna `anun_Geolocalizacion` si existe (no falla si falta). Al unir filas duplicadas por (clave, alias) se conserva la primera geolocalización no vacía.

- [ ] **Step 1: Agregar pruebas que fallan** al final de `sitios-rules.test.ts` (dentro de un `describe` nuevo; reutilizar los imports existentes del archivo, agregando `parseFilasSitios` si no está importado):

```ts
describe("parseFilasSitios: geolocalizacion", () => {
  const ENC = ["anun_Clave", "anun_Alias", "anun_Geolocalizacion"];
  it("lee la columna cuando existe", () => {
    expect(parseFilasSitios([ENC, ["C1", "Alias", "20.5,-100.4"]])).toEqual([{ clave: "C1", alias: "Alias", geolocalizacion: "20.5,-100.4" }]);
  });
  it("no falla si la hoja no trae la columna y no agrega la llave", () => {
    expect(parseFilasSitios([["anun_Clave", "anun_Alias"], ["C1", "Alias"]])).toEqual([{ clave: "C1", alias: "Alias" }]);
  });
  it("una celda vacia no agrega la llave", () => {
    expect(parseFilasSitios([ENC, ["C1", "Alias", ""]])).toEqual([{ clave: "C1", alias: "Alias" }]);
  });
  it("al juntar filas del mismo sitio conserva la primera geolocalizacion no vacia", () => {
    expect(parseFilasSitios([ENC, ["C1", "Alias", ""], ["C1", "Alias", "1,2"]])).toEqual([{ clave: "C1", alias: "Alias", geolocalizacion: "1,2" }]);
  });
});
```

Nota: los `toEqual` existentes de otros tests siguen valiendo porque la llave solo se agrega cuando hay valor.

- [ ] **Step 2: Verificar que falla**

Run: `pnpm test -- src/domain/sitios/sitios-rules.test.ts` → FAIL en los casos nuevos.

- [ ] **Step 3: Implementar en `sitios-rules.ts`**

Cambiar `Sitio`:

```ts
export interface Sitio {
  clave: string;
  alias: string;
  // Columna opcional anun_Geolocalizacion (enlace o "lat,lng"); ausente si la hoja no la trae.
  geolocalizacion?: string;
}
```

Agregar junto a `ENCABEZADOS`:

```ts
const ENCABEZADO_GEOLOCALIZACION = "anun_geolocalizacion";
```

En `parseFilasSitios`, después del `for (const campo of CAMPOS)`, agregar `const indiceGeo = encabezados.indexOf(ENCABEZADO_GEOLOCALIZACION);` y reemplazar la construcción de `sitio` dentro del bucle por:

```ts
    const sitio: Sitio = { clave: texto(fila[indice.clave]), alias: texto(fila[indice.alias]) };
    const geo = indiceGeo === -1 ? "" : texto(fila[indiceGeo]);
    if (geo) sitio.geolocalizacion = geo;
    if (sitio.clave && sitio.alias) candidatos.push(sitio);
```

Reemplazar el bloque final de deduplicación (`const vistos = new Set<string>(); return candidatos.filter(...)`) por:

```ts
  // Se junta despues de unificar: dos variantes del mismo alias bajo una clave son un solo sitio.
  const porLlave = new Map<string, Sitio>();
  for (const s of candidatos) {
    const llave = `${s.clave}\u0000${s.alias}`;
    const previo = porLlave.get(llave);
    if (!previo) porLlave.set(llave, s);
    else if (!previo.geolocalizacion && s.geolocalizacion) previo.geolocalizacion = s.geolocalizacion;
  }
  return Array.from(porLlave.values());
```

`aplicarSeleccion` hace `{ ...candidatos[0] }` y devolvería la geolocalización dentro de `SeleccionSitio`; como `SeleccionSitio = Sitio`, es inocuo. Sin embargo, `createTicket` guarda `{ clave, alias }` explícito (no se copia la selección completa), así que no se escribe geolocalización por accidente.

- [ ] **Step 4: Verificar**

Run: `pnpm test -- src/domain/sitios` → todo PASS (incluidos `sitios-cache` y `sitios-sesion`). `pnpm exec tsc --noEmit` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/domain/sitios/sitios-rules.ts src/domain/sitios/sitios-rules.test.ts
git commit -m "feat: leer geolocalizacion opcional de la hoja de sitios"
```

---

### Task 4: Validación del solicitante y construcción del ticket

**Files:**
- Modify: `src/domain/tickets/nuevo-ticket-validacion.ts`, `src/domain/tickets/nuevo-ticket.ts`
- Test: `src/domain/tickets/nuevo-ticket-validacion.test.ts`, `src/domain/tickets/nuevo-ticket.test.ts`

**Interfaces:**
- Consumes: `validarAlta`, `AltaCapturada` (Task 1).
- Produces: `SolicitudCapturada.alta?: AltaCapturada`; `NuevoTicketInput.altaArrendador?: AltaArrendadorInput`.

- [ ] **Step 1: Pruebas que fallan**

Agregar en `nuevo-ticket-validacion.test.ts`, dentro de `describe("validarSolicitud", ...)`:

```ts
  it("con bloque de alta valida tipo, motivo y domicilio desglosado y no marca el domicilio de texto", () => {
    const e = validarSolicitud({
      ...BASE,
      contrato: { ...CONTRATO_OK, domicilio: "" },
      alta: { tipoAlta: "cambio", motivoCambio: "", domicilio: { calle: "", numero: "", interior: "", colonia: "", municipio: "", estado: "", cp: "", entreCalles: "" } },
    });
    expect(e.motivoCambio).toBeTruthy();
    expect(e.calle).toBeTruthy();
    expect(e.domicilio).toBeUndefined();
  });
```

Agregar en `nuevo-ticket.test.ts` (reusar el helper de construcción de entrada que ese archivo ya usa; leer sus primeras líneas para conocer el nombre y reutilizarlo tal cual):

```ts
  it("incluye altaArrendador solo si viene en la entrada", () => {
    const alta = { tipoAlta: "nuevo" as const, domicilio: { calle: "a", numero: "1", interior: "", colonia: "c", municipio: "m", estado: "e", cp: "1", entreCalles: "x" }, documentos: {} };
    expect(buildNuevoTicket({ ...INPUT_BASE, altaArrendador: alta }, SERVICIO, { id: "t", folio: "JUR-1" }, new Date()).altaArrendador).toEqual(alta);
    expect("altaArrendador" in buildNuevoTicket(INPUT_BASE, SERVICIO, { id: "t", folio: "JUR-1" }, new Date())).toBe(false);
  });
```

(`INPUT_BASE` y `SERVICIO` son los nombres de los objetos de entrada/servicio que ya existen en ese test; si se llaman distinto, usar los existentes.)

- [ ] **Step 2: Verificar que fallan**

Run: `pnpm test -- src/domain/tickets/nuevo-ticket` → FAIL en los casos nuevos.

- [ ] **Step 3: Implementar**

`nuevo-ticket-validacion.ts`: agregar import `import { validarAlta, type AltaCapturada } from "./alta-arrendador-rules";`, agregar `alta?: AltaCapturada;` a `SolicitudCapturada`, y reemplazar la última línea de contenido de `validarSolicitud`:

```ts
  if (s.requiereDatosContrato) Object.assign(errores, validarContrato(s.contrato));
  if (s.alta) {
    // El domicilio de texto se arma con los campos desglosados: el error visible es el de cada campo.
    delete errores.domicilio;
    Object.assign(errores, validarAlta(s.alta));
  }
  return errores;
```

`nuevo-ticket.ts`: importar `AltaArrendadorInput`, agregar `altaArrendador?: AltaArrendadorInput;` a `NuevoTicketInput` y, junto a las otras líneas condicionales:

```ts
    ...(input.altaArrendador ? { altaArrendador: input.altaArrendador } : {}),
```

- [ ] **Step 4: Verificar**

Run: `pnpm test -- src/domain/tickets` → PASS. `pnpm exec tsc --noEmit` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/domain/tickets/nuevo-ticket-validacion.ts src/domain/tickets/nuevo-ticket-validacion.test.ts src/domain/tickets/nuevo-ticket.ts src/domain/tickets/nuevo-ticket.test.ts
git commit -m "feat: validar y guardar el bloque de alta de arrendador al crear el ticket"
```

---

### Task 5: Compuerta a Pre-Cierre y guardado de la revisión legal

**Files:**
- Modify: `src/domain/tickets/ticket-service.ts`, `src/lib/tickets.ts`
- Test: `src/domain/tickets/ticket-service.test.ts`

**Interfaces:**
- Consumes: `revisionLegalPendiente`, `RevisionLegalIncompletaError`, `normalizarRevisionLegal`, `puedeEditarRevisionLegal`-equivalente no se usa en el servicio (el permiso lo imponen las reglas de Firestore y la UI).
- Produces: `service.updateTicketRevisionLegal(id: string, revision: RevisionLegal): Promise<void>`; `updateTicketAsignacion` lanza `RevisionLegalIncompletaError` al pasar a Pre-Cierre con la revisión incompleta.

- [ ] **Step 1: Pruebas que fallan** (agregar al final de `ticket-service.test.ts`; usa `montar`, `actor`, `input`, `buildTicket` ya definidos arriba)

```ts
describe("revision legal", () => {
  const alta = { tipoAlta: "nuevo" as const, domicilio: { calle: "a", numero: "1", interior: "", colonia: "c", municipio: "m", estado: "e", cp: "1", entreCalles: "x" }, documentos: {} };
  const COMPLETA = {
    tipoPropietario: "fisica" as const, nombrePropietario: "Juan", acreditaPropiedad: true, documentoPropiedad: "u",
    hayLimitacion: false, escenarioBeneficiario: "propietario" as const, hayCondicionPago: false,
  };

  it("no deja pasar a Pre-Cierre un ticket de Alta con la revision incompleta", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1", altaArrendador: alta }));
    await expect(service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"))).rejects.toThrow(/revisión legal/);
    expect(resumenes.has("t1")).toBe(false);
  });

  it("deja pasar a Pre-Cierre cuando la revision esta completa", async () => {
    const { service } = montar(buildTicket({ id: "t1", altaArrendador: alta, revisionLegal: COMPLETA }));
    await expect(service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"))).resolves.toBeUndefined();
  });

  it("no bloquea tickets sin altaArrendador (anteriores)", async () => {
    const { service } = montar(buildTicket({ id: "t1" }));
    await expect(service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"))).resolves.toBeUndefined();
  });

  it("guardar la revision normaliza y no deja llaves undefined", async () => {
    // El fake aplica el patch de repo.update directamente sobre el ticket que se le pasa.
    const t = buildTicket({ id: "t1", altaArrendador: alta, estatus: "Proceso en tramite" });
    const { service } = montar(t);
    await service.updateTicketRevisionLegal("t1", { ...COMPLETA, tipoLimitacion: "sobra" });
    expect(t.revisionLegal?.tipoLimitacion).toBeUndefined();
    expect(Object.values(t.revisionLegal ?? {}).includes(undefined)).toBe(false);
  });

  it("no guarda la revision en Pre-Cierre", async () => {
    const { service } = montar(buildTicket({ id: "t2", altaArrendador: alta, estatus: "Pre-Cierre" }));
    await expect(service.updateTicketRevisionLegal("t2", COMPLETA)).rejects.toThrow();
  });
});
```

El guardado usa `repo.update` (sin entrada de historial; fuera del alcance del spec).

- [ ] **Step 2: Verificar que fallan**

Run: `pnpm test -- src/domain/tickets/ticket-service.test.ts` → FAIL en los casos nuevos.

- [ ] **Step 3: Implementar en `ticket-service.ts`**

Agregar imports:

```ts
import { normalizarRevisionLegal, revisionLegalPendiente, RevisionLegalIncompletaError } from "./revision-legal-rules";
import type { Estatus, RevisionLegal, SitioArrendamiento, Ticket } from "@/types/ticket";
```

(reemplazar el import existente de `@/types/ticket` para incluir `RevisionLegal`).

Dentro de `updateTicketAsignacion`, justo después de `if (!current) throw new Error("Ticket no encontrado.");`:

```ts
    if (input.estatus === "Pre-Cierre" && current.estatus !== "Pre-Cierre") {
      const faltantes = revisionLegalPendiente(current);
      if (faltantes.length > 0) throw new RevisionLegalIncompletaError(faltantes);
    }
```

Agregar la función nueva antes de `updateTicketExclusion`:

```ts
  async function updateTicketRevisionLegal(id: string, revision: RevisionLegal): Promise<void> {
    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");
    if (!current.altaArrendador) throw new Error("El ticket no es una alta de arrendador.");
    if (bloqueadoPorPreCierre(current.estatus)) throw new Error(MENSAJE_BLOQUEO_PRE_CIERRE);
    await repo.update(id, { revisionLegal: normalizarRevisionLegal(revision) });
  }
```

Y agregar `updateTicketRevisionLegal,` al objeto devuelto. En `src/lib/tickets.ts` agregar:

```ts
export const updateTicketRevisionLegal = ticketService.updateTicketRevisionLegal;
```

- [ ] **Step 4: Verificar**

Run: `pnpm test` → PASS completo. `pnpm exec tsc --noEmit` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/domain/tickets/ticket-service.ts src/domain/tickets/ticket-service.test.ts src/lib/tickets.ts
git commit -m "feat: compuerta de revision legal hacia Pre-Cierre y guardado de la revision"
```

---

### Task 6: Documentos nuevos en el resumen de Pre-Cierre

**Files:**
- Modify: `src/domain/contratos/contrato-rules.ts:55-67`
- Test: `src/domain/contratos/contrato-rules.test.ts`

**Interfaces:**
- Consumes: `DOCUMENTOS_ALTA` (Task 1). Los documentos de `altaArrendador.documentos` salen en el grupo `"arrendamiento"` con su etiqueta.

- [ ] **Step 1: Prueba que falla** (agregar a `contrato-rules.test.ts`; importar `documentosDelResumen` y `buildTicket` si no están ya importados)

```ts
describe("documentosDelResumen: alta de arrendador", () => {
  it("incluye los documentos del bloque altaArrendador con su etiqueta", () => {
    const t = buildTicket({
      altaArrendador: {
        tipoAlta: "cambio",
        domicilio: { calle: "a", numero: "1", interior: "", colonia: "c", municipio: "m", estado: "e", cp: "1", entreCalles: "x" },
        documentos: { predial: "https://x/predial.pdf", contratoAnterior: "https://x/ant.pdf" },
      },
    });
    const docs = documentosDelResumen(t, null);
    expect(docs).toEqual(expect.arrayContaining([
      { etiqueta: "Predial", url: "https://x/predial.pdf", grupo: "arrendamiento" },
      { etiqueta: "Contrato anterior", url: "https://x/ant.pdf", grupo: "arrendamiento" },
    ]));
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm test -- src/domain/contratos/contrato-rules.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

Importar `DOCUMENTOS_ALTA` desde `@/domain/tickets/alta-arrendador-rules` y, justo después de la línea del `for (const d of DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO)`, agregar:

```ts
  for (const d of DOCUMENTOS_ALTA) agregar("arrendamiento", d.label, ticket.altaArrendador?.documentos[d.key]);
```

- [ ] **Step 4: Verificar**

Run: `pnpm test -- src/domain/contratos` → PASS. `pnpm exec tsc --noEmit` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/domain/contratos/contrato-rules.ts src/domain/contratos/contrato-rules.test.ts
git commit -m "feat: documentos de alta de arrendador en el resumen de Pre-Cierre"
```

---

### Task 7: Reglas de Firestore

**Files:**
- Modify: `firestore.rules` (match `/tickets/{folio}`, líneas ~185-204)

**Interfaces:** consume la función existente `esAbogadoAsignado(ticketId)`.

- [ ] **Step 1: Editar `allow create`**

Reemplazar:

```
      allow create: if isSignedIn() && request.resource.data.solicitanteId == request.auth.uid
                    && !("resumenContrato" in request.resource.data);
```

por:

```
      allow create: if isSignedIn() && request.resource.data.solicitanteId == request.auth.uid
                    && !("resumenContrato" in request.resource.data)
                    && !("revisionLegal" in request.resource.data);
```

- [ ] **Step 2: Declarar la función y usarla en `allow update`**

Declarar la función junto a las demás (después de `soloCamposDeProcesoEnPreCierre()`, antes de `match /users/{uid}`; las funciones no se pueden declarar dentro de un `match`):

```
    // revisionLegal: solo admin/gerente juridico y el abogado asignado (Mesa de Control no).
    // Sincronizar con puedeEditarRevisionLegal en src/domain/tickets/revision-legal-rules.ts.
    function revisionLegalPermitida(ticketId) {
      return !request.resource.data.diff(resource.data).affectedKeys().hasAny(["revisionLegal"])
             || isAdmin()
             || (myRole() == "abogado" && esAbogadoAsignado(ticketId));
    }
```

En `match /tickets/{folio}`, agregar la condición a la primera cláusula del `allow update` (Legal/admin), sin tocar las otras dos:

```
      allow update: if ((isAdmin() || isLegalStaff())
                        && (request.resource.data.abogadoAsignadoId == resource.data.abogadoAsignadoId
                            || tiene("asignar_tickets"))
                        && soloCamposDeProcesoEnPreCierre()
                        && revisionLegalPermitida(folio))
                    || ...resto sin cambios...
```

- [ ] **Step 3: Revisión manual**

Releer el bloque editado: paréntesis balanceados, la función declarada fuera de `match`, `folio` usado dentro del match. No hay pruebas automáticas de reglas en el repo (spec). Si `firebase` CLI está instalado, validar sintaxis con `firebase emulators:exec` no es necesario; basta `pnpm exec firebase --version` para saber si existe y, de existir, `firebase deploy --only firestore:rules --dry-run` **solo con permiso del usuario** (no desplegar).

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat: reglas de Firestore para revisionLegal (solo abogado asignado y admin)"
```

---

### Task 8: Formulario del solicitante (UI)

**Files:**
- Create: `src/components/tickets/alta-arrendador-fields.tsx`
- Modify: `src/components/tickets/nuevo-ticket-form.tsx`, `src/components/tickets/datos-contrato-fields.tsx`

**Interfaces:**
- Consumes: Tasks 1, 3, 4. Antes de empezar: revisar `node_modules/next/dist/docs/` (ver Global Constraints).
- Produces: componente `AltaArrendadorFields({ alta, errors, geolocalizacion, onChange })` y prop `ocultarDomicilio?: boolean` en `DatosContratoFields`.

- [ ] **Step 1: `datos-contrato-fields.tsx`** — agregar `ocultarDomicilio?: boolean` a `Props`, desestructurarla en la firma y envolver el `<div className="min-w-0 sm:col-span-2">` del domicilio:

```tsx
      {!ocultarDomicilio && (
        <div className="min-w-0 sm:col-span-2">
          {/* ...bloque de Domicilio del inmueble sin cambios... */}
        </div>
      )}
```

- [ ] **Step 2: Crear `alta-arrendador-fields.tsx`**

```tsx
"use client";

import { ETIQUETAS_DOMICILIO, type AltaCapturada } from "@/domain/tickets/alta-arrendador-rules";
import type { DomicilioDesglosado, TipoAlta } from "@/types/ticket";

interface Props {
  alta: AltaCapturada;
  errors: Record<string, string>;
  geolocalizacion: string | null; // null = el sitio no trae geolocalizacion
  onChange: (alta: AltaCapturada) => void;
}

const CAMPOS_DOMICILIO = Object.keys(ETIQUETAS_DOMICILIO) as (keyof DomicilioDesglosado)[];

function Etiqueta({ children, obligatorio = true }: { children: React.ReactNode; obligatorio?: boolean }) {
  return <label className="field-label">{children} {obligatorio && <span className="text-danger" aria-label="obligatorio">*</span>}</label>;
}

function Error({ mensaje }: { mensaje?: string }) {
  return mensaje ? <p className="text-sm text-danger mt-1.5">{mensaje}</p> : null;
}

export function AltaArrendadorFields({ alta, errors, geolocalizacion, onChange }: Props) {
  const setDomicilio = (campo: keyof DomicilioDesglosado, valor: string) =>
    onChange({ ...alta, domicilio: { ...alta.domicilio, [campo]: valor } });

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
      <div className="min-w-0">
        <Etiqueta>Tipo de alta de arrendador</Etiqueta>
        <select
          value={alta.tipoAlta}
          onChange={(e) => onChange({ ...alta, tipoAlta: e.target.value as TipoAlta | "", motivoCambio: e.target.value === "cambio" ? alta.motivoCambio : "" })}
          className="w-full field"
        >
          <option value="">Selecciona una opción</option>
          <option value="nuevo">Nuevo arrendador</option>
          <option value="cambio">Cambio de arrendador</option>
        </select>
        <Error mensaje={errors.tipoAlta} />
      </div>

      {alta.tipoAlta === "cambio" && (
        <div className="min-w-0 sm:col-span-2">
          <Etiqueta>Motivo del cambio de arrendador</Etiqueta>
          <textarea
            value={alta.motivoCambio}
            onChange={(e) => onChange({ ...alta, motivoCambio: e.target.value })}
            rows={3}
            className="field w-full resize-y"
          />
          <p className="text-xs text-muted mt-1.5">Explica por qué cambia el arrendador.</p>
          <Error mensaje={errors.motivoCambio} />
        </div>
      )}

      {CAMPOS_DOMICILIO.map((campo) => (
        <div key={campo} className={campo === "entreCalles" ? "min-w-0 sm:col-span-2" : "min-w-0"}>
          <Etiqueta obligatorio={campo !== "interior"}>{ETIQUETAS_DOMICILIO[campo]}</Etiqueta>
          <input type="text" value={alta.domicilio[campo]} onChange={(e) => setDomicilio(campo, e.target.value)} className="w-full field" />
          <Error mensaje={errors[campo]} />
        </div>
      ))}

      <div className="min-w-0 sm:col-span-2">
        <Etiqueta obligatorio={false}>Geolocalización del sitio</Etiqueta>
        <p className="text-sm">{geolocalizacion ?? <span className="text-muted">No disponible</span>}</p>
        <p className="text-xs text-muted mt-1.5">Se toma automáticamente del sitio que elegiste.</p>
      </div>
    </div>
  );
}
```

(Las clases `field`, `field-label` y el patrón de `Etiqueta`/`Error` son los mismos de `datos-contrato-fields.tsx`.)

- [ ] **Step 3: Integrar en `nuevo-ticket-form.tsx`**

Cambios, en este orden:

1. Imports: `SERVICIO_ALTA_ARRENDADOR_ID` desde `@/lib/data/arrendamientos-temporal`; `AltaArrendadorFields`; `{ DOMICILIO_VACIO, documentosAltaRequeridos, domicilioTexto, type AltaCapturada }` desde `@/domain/tickets/alta-arrendador-rules`; `useSitios` desde `@/hooks/use-sitios`; `sitioDeSeleccion` junto a `SELECCION_VACIA`; tipos `DocumentoAltaKey`, `AltaArrendadorInput`.
2. Estado y derivados (junto a los demás):

```tsx
const EMPTY_ALTA: AltaCapturada = { tipoAlta: "", motivoCambio: "", domicilio: DOMICILIO_VACIO };
// dentro del componente:
const [alta, setAlta] = useState<AltaCapturada>(EMPTY_ALTA);
const [altaDocsFiles, setAltaDocsFiles] = useState<Partial<Record<DocumentoAltaKey, UploadingFile[]>>>({});
const { sitios } = useSitios();
const esAlta = form.servicioId === SERVICIO_ALTA_ARRENDADOR_ID;
const docsAlta = documentosAltaRequeridos(alta.tipoAlta);
const geolocalizacion = sitioDeSeleccion(sitios, sitio)?.geolocalizacion ?? null;
```

3. Reemplazar `requiereDocumentosIndividuales` para que el flujo viejo no aplique a Alta: `const requiereDocumentosIndividuales = SERVICIOS_CON_DOCUMENTOS_INDIVIDUALES_IDS.includes(form.servicioId) && !esAlta;` y definir `documentacionObligatoria` como `requiereFormato && !requiereDocumentosIndividuales && !esAlta` en `validar()`.
4. Generalizar los manejadores de documento: crear `handleAltaDocSeleccionado(key: DocumentoAltaKey, selected: File[])` y `handleRemoveAltaDoc(key, id)` copiando **exactamente** `handleDocumentoSeleccionado` / `handleRemoveDocumento` pero con `setAltaDocsFiles` y `altaDocsFiles[key]?.[0]` (mismo `uploadTicketFile(`tickets-drafts/${draftId}`, ...)` y mismo borrado del archivo anterior).
5. En `validar()`: al armar la entrada de `validarSolicitud`, cuando `esAlta`:
   - `contrato: { ...contrato, domicilio: domicilioTexto(alta.domicilio) }`
   - `alta`
   - `documentosFaltantes: docsAlta.filter((d) => altaDocsFiles[d.key]?.[0]?.status !== "done")`
   - `requiereDatosContrato` sin cambio.
   Para no-Alta se mantiene la rama existente.
6. `documentosUploading`: incluir `Object.values(altaDocsFiles).some((fs) => fs?.some((f) => f.status === "uploading"))`.
7. En `handleSubmit`, cuando `esAlta`, construir:

```tsx
const altaArrendador: AltaArrendadorInput | undefined = esAlta
  ? {
      tipoAlta: alta.tipoAlta as "nuevo" | "cambio",
      ...(alta.tipoAlta === "cambio" ? { motivoCambio: alta.motivoCambio.trim() } : {}),
      domicilio: alta.domicilio,
      ...(geolocalizacion ? { geolocalizacion } : {}),
      documentos: Object.fromEntries(
        docsAlta.map((d) => [d.key, altaDocsFiles[d.key]?.[0]?.url ?? ""]).filter(([, url]) => url)
      ),
    }
  : undefined;
```

   usar `domicilio: esAlta ? domicilioTexto(alta.domicilio) : contrato.domicilio` en `contratoArrendamiento`, y pasar `altaArrendador` a `createTicket`.
8. `reiniciar()`: `setAlta(EMPTY_ALTA); setAltaDocsFiles({});`.
9. JSX: dentro de la sección "Datos del contrato / convenio", cuando `esAlta` renderizar `<AltaArrendadorFields alta={alta} errors={errors} geolocalizacion={geolocalizacion} onChange={(a) => { setAlta(a); setErrors({}); }} />` encima de `<DatosContratoFields ... ocultarDomicilio={esAlta} />`. En el aside de documentos, cuando `esAlta`, renderizar la cuadrícula de `docsAlta` (mismo marcado que el bloque `requiereDocumentosIndividuales`, usando `altaDocsFiles`, `handleAltaDocSeleccionado`, `handleRemoveAltaDoc` y `errors[doc.key]`), y excluir el bloque de "Documentación adjunta" obligatoria como ya ocurre con `requiereDocumentosIndividuales`.

- [ ] **Step 4: Verificar**

Run: `pnpm exec tsc --noEmit` y `pnpm lint` → sin errores; `pnpm test` → PASS.
Manual (`pnpm dev`, sesión de solicitante): elegir "Alta de Arrendadores"; ver selector de tipo; elegir "Cambio" → aparece motivo y "Contrato anterior"; enviar vacío → errores en lenguaje simple por campo; completar y crear → el ticket guarda `altaArrendador` y `contratoArrendamiento.domicilio` con el texto armado; elegir otro servicio (C073) → el formulario no cambia.

- [ ] **Step 5: Commit**

```bash
git add src/components/tickets/alta-arrendador-fields.tsx src/components/tickets/nuevo-ticket-form.tsx src/components/tickets/datos-contrato-fields.tsx
git commit -m "feat: formulario de alta de arrendador con tipo, domicilio desglosado y documentos nuevos"
```

---

### Task 9: Panel de revisión legal y detalle del ticket (UI)

**Files:**
- Create: `src/components/tickets/revision-legal-panel.tsx`
- Modify: `src/components/tickets/ticket-detail.tsx`

**Interfaces:**
- Consumes: Tasks 1, 2, 5. `uploadTicketFile`, `deleteTicketDocument`, `FileDropzone`, `EnlaceDocumento` (este último vive en `ticket-detail.tsx`; el panel recibe los documentos ya subidos como URLs y muestra el nombre con un enlace simple, ver abajo).
- Produces: `RevisionLegalPanel({ ticketId, revision, editable, onGuardar })`.

- [ ] **Step 1: Crear `revision-legal-panel.tsx`**

Estructura (un componente cliente; el estado local es `RevisionLegal`; cada paso aparece cuando el anterior está contestado):

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDropzone, type UploadingFile } from "@/components/ui/file-dropzone";
import { uploadTicketFile, deleteTicketDocument } from "@/lib/storage";
import { faltantesRevisionLegal, normalizarRevisionLegal } from "@/domain/tickets/revision-legal-rules";
import type { RevisionLegal } from "@/types/ticket";

interface Props {
  ticketId: string;
  revision: RevisionLegal | undefined;
  editable: boolean;
  onGuardar: (revision: RevisionLegal) => Promise<void>;
}

type CampoDoc =
  | "documentoPersonalidad" | "documentoPropiedad" | "cartaAutorizacion"
  | "documentoBeneficiario" | "documentoRepresentante" | "cartaRepresentante";

function SiNo({ valor, onChange, disabled }: { valor: boolean | undefined; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <div className="flex gap-4">
      {[true, false].map((v) => (
        <label key={String(v)} className="inline-flex items-center gap-2 text-sm">
          <input type="radio" checked={valor === v} onChange={() => onChange(v)} disabled={disabled} />
          {v ? "Sí" : "No"}
        </label>
      ))}
    </div>
  );
}

export function RevisionLegalPanel({ ticketId, revision, editable, onGuardar }: Props) {
  const [r, setR] = useState<RevisionLegal>(revision ?? {});
  const [archivos, setArchivos] = useState<Partial<Record<CampoDoc, UploadingFile[]>>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setR(revision ?? {}); }, [revision]);

  const set = <K extends keyof RevisionLegal>(k: K, v: RevisionLegal[K]) => setR((prev) => ({ ...prev, [k]: v }));
  const faltantes = faltantesRevisionLegal(normalizarRevisionLegal(r));
  const subiendo = Object.values(archivos).some((fs) => fs?.some((f) => f.status === "uploading"));

  // Un solo archivo por documento; el nuevo reemplaza al anterior (se borra de Storage).
  function subir(campo: CampoDoc, selected: File[]) {
    const file = selected[0];
    if (!file) return;
    const anterior = r[campo];
    const entry: UploadingFile = { id: crypto.randomUUID(), name: file.name, size: file.size, progress: 0, status: "uploading" };
    setArchivos((p) => ({ ...p, [campo]: [entry] }));
    uploadTicketFile(`tickets/${ticketId}`, file, (pct) =>
      setArchivos((p) => ({ ...p, [campo]: p[campo]?.map((f) => (f.id === entry.id ? { ...f, progress: pct } : f)) }))
    )
      .then(({ url, path }) => {
        setArchivos((p) => ({ ...p, [campo]: [{ ...entry, status: "done", progress: 100, url, path }] }));
        set(campo, url);
        if (anterior) deleteTicketDocument(anterior).catch(() => {});
      })
      .catch((err) => setArchivos((p) => ({ ...p, [campo]: [{ ...entry, status: "error", error: err?.message }] })));
  }

  function quitar(campo: CampoDoc) {
    setArchivos((p) => ({ ...p, [campo]: [] }));
    setR((prev) => { const { [campo]: _omitido, ...resto } = prev; return resto; });
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try { await onGuardar(normalizarRevisionLegal(r)); }
    catch { setError("No se pudo guardar. Intenta de nuevo."); }
    finally { setGuardando(false); }
  }

  const documento = (campo: CampoDoc, etiqueta: string) => (
    <div>
      <label className="field-label">{etiqueta} <span className="text-danger">*</span></label>
      {editable ? (
        <FileDropzone files={archivos[campo] ?? []} onFilesSelected={(f) => subir(campo, f)} onRemove={() => quitar(campo)} multiple={false} />
      ) : null}
      {r[campo] && (
        <a href={r[campo]} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Ver documento subido</a>
      )}
      {!r[campo] && !editable && <p className="text-sm text-muted">Sin adjuntar</p>}
    </div>
  );

  // ...JSX de los 5 pasos (ver Step 2)
}
```

- [ ] **Step 2: Completar el JSX del panel** (reemplaza el comentario final). Cada bloque se renderiza solo si el anterior está contestado, y todos los controles reciben `disabled={!editable}`:

1. **Propietario:** `<select>` "Tipo de propietario" (`fisica`/`moral`) → input "Nombre completo del propietario" (o "Razón social") → si `moral`: input "Nombre del representante legal" y `documento("documentoPersonalidad", "Personalidad con actos de dominio para arrendar el inmueble")`.
2. **Propiedad:** `<SiNo>` "¿Se acredita la propiedad?" → `true`: `documento("documentoPropiedad", "Documento que acredita la propiedad")`; `false`: `documento("cartaAutorizacion", "Carta de autorización")`.
3. **Limitación:** `<SiNo>` "¿Existe alguna limitación sobre el inmueble?" → `true`: input texto "Tipo de limitación" (`tipoLimitacion`). Aislar la edición en una constante `TIPO_LIMITACION_LIBRE = true` comentada ("por ahora campo libre; pasará a lista desplegable") para localizar el cambio futuro.
4. **Beneficiarios:** `<select>` "¿Quién recibe el pago de las rentas?" con `propietario` ("El propietario"), `tercero` ("Una persona o empresa distinta al propietario"), `varios` ("Varios beneficiarios").
   - `tercero`: input `beneficiarioNombre`, `documento("documentoBeneficiario", "Acreditación del beneficiario")`, casilla `clausulaEspecial` con texto "Se redactará una cláusula especial que nombre al beneficiario".
   - `varios`: lista editable de `beneficiarios` (input nombre + botón "Quitar"; botón "Agregar beneficiario" añade `{ nombre: "", porcentaje: 0 }`; iniciar con 2 filas vacías al elegir `varios`), `<select>` `modalidadVarios` ("Partes iguales" / "Un representante común"); en `equitativo` mostrar los porcentajes calculados con `normalizarRevisionLegal(r).beneficiarios` formateados como `(p / 100).toFixed(2) + " %"`; en `representante` un `<select>` "Representante común" con los nombres de la lista (`representanteComun` = índice), `documento("documentoRepresentante", "Acreditación del representante común")` y `documento("cartaRepresentante", "Carta que autoriza al representante a recibir la renta")`.
5. **Condición de pago:** `<SiNo>` "¿Existe condición para el pago del arrendamiento?" → `true`: input `condicionPago` "¿Cuál?".

Al final: si `faltantes.length > 0` mostrar la lista "Falta por completar:" en texto simple; si `editable`, botón `Button variant="success"` "Guardar revisión legal" deshabilitado con `guardando || subiendo`, y el `error`.

- [ ] **Step 3: Integrar en `ticket-detail.tsx`**

1. Imports: `RevisionLegalPanel`, `puedeEditarRevisionLegal` / `revisionLegalPendiente` / `RevisionLegalIncompletaError` desde `@/domain/tickets/revision-legal-rules`, `updateTicketRevisionLegal` desde `@/lib/tickets`, `DOCUMENTOS_ALTA` desde `@/domain/tickets/alta-arrendador-rules`.
2. Derivados (junto a `puedeEditarDatosContrato`):

```tsx
const puedeEditarRevision = puedeEditarRevisionLegal({ role, abogadoId }, ticket);
const verRevisionLegal = !!ticket.altaArrendador && (puedeEditar || esDueno);
```

   Mostrar la revisión al solicitante dueño es solo lectura (`editable={false}`); si no se quiere exponerla al solicitante, usar solo `puedeEditar` (decisión por defecto: **solo `puedeEditar`**, es información legal interna).
3. `todaLaDocumentacion`: agregar `...(ticket.altaArrendador ? Object.values(ticket.altaArrendador.documentos).filter((u): u is string => !!u) : []),`.
4. Bloque "Documentos de arrendamiento" (línea ~623): cambiar la condición a `(!ticket.altaArrendador && (ticket.documentosArrendamiento || pideDocumentosIndividuales))` y, después, agregar un bloque equivalente para `ticket.altaArrendador` que liste `DOCUMENTOS_ALTA` con `EnlaceDocumento` y "sin adjuntar" (omitiendo `contratoAnterior` si `tipoAlta === "nuevo"`).
5. En la sección de datos, cuando `ticket.altaArrendador`: `<dl>` con Tipo de alta ("Nuevo arrendador"/"Cambio de arrendador"), Motivo del cambio (si aplica), cada campo del domicilio con `ETIQUETAS_DOMICILIO`, y Geolocalización (`datoContrato(ticket.altaArrendador.geolocalizacion)`). En `DatosContratoFields` de la edición del contrato pasar `ocultarDomicilio={!!ticket.altaArrendador}`.
6. Insertar, antes de la sección "Asignación y estatus" (línea ~693):

```tsx
{verRevisionLegal && (
  <section className="section-card p-6 space-y-4">
    <h2 className="eyebrow">Revisión legal</h2>
    <RevisionLegalPanel
      ticketId={id}
      revision={ticket.revisionLegal}
      editable={puedeEditarRevision}
      onGuardar={(rev) => updateTicketRevisionLegal(id, rev)}
    />
  </section>
)}
```

7. `handleGuardar` (estatus): en el `catch`, mostrar el motivo cuando es la compuerta:

```tsx
    } catch (err) {
      setSaveError(err instanceof RevisionLegalIncompletaError ? err.message : "No se pudo guardar. Intenta de nuevo.");
    }
```

- [ ] **Step 4: Verificar**

Run: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` → todo en verde.
Manual (`pnpm dev`):
- Como abogado asignado, abrir un ticket de Alta nuevo: ver la sección "Revisión legal" editable, con la lista "Falta por completar". Recorrer persona moral → acreditación Sí/No → limitación → los tres escenarios de beneficiarios (en "varios/equitativo" ver 33.33 / 33.33 / 33.34 con 3 nombres) → condición de pago. Guardar a medias, recargar y comprobar que se conserva. Cambiar de moral a física y de escenario, guardar, y comprobar que los datos del escenario anterior desaparecen.
- Intentar pasar a Pre-Cierre con la revisión incompleta: se rechaza y se ve qué falta; completarla y reintentar: pasa.
- Como Mesa de Control: la sección no es editable (no aparece el botón). Un ticket de Alta anterior (sin `altaArrendador`) pasa a Pre-Cierre sin bloqueo y no muestra la sección.
- Con el ticket en Pre-Cierre: el panel queda de solo lectura.

- [ ] **Step 5: Commit**

```bash
git add src/components/tickets/revision-legal-panel.tsx src/components/tickets/ticket-detail.tsx
git commit -m "feat: panel de revision legal y datos de alta de arrendador en el detalle del ticket"
```

---

### Task 10: Verificación final

- [ ] **Step 1:** `pnpm exec tsc --noEmit` → sin errores.
- [ ] **Step 2:** `pnpm lint` → sin errores nuevos.
- [ ] **Step 3:** `pnpm test` → todas las pruebas en PASS (reportar el conteo real).
- [ ] **Step 4:** Recorrer el flujo completo en el navegador con un solicitante (crear alta) y un abogado (revisión legal → Pre-Cierre) y confirmar cada criterio del spec: tipo de alta, motivo del cambio, domicilio desglosado, geolocalización ("No disponible" si la celda viene vacía), documentos condicionales, las tres rutas de beneficiarios, compuerta, bloqueo en Pre-Cierre, Mesa de Control sin edición, C072 sin cambios.
- [ ] **Step 5:** Si algún punto falla, corregir antes de dar por terminado; reportar lo que no se pudo verificar tal cual.

---

## Cobertura del spec

| Requisito del spec | Task |
|---|---|
| Tipo de alta, motivo del cambio, domicilio desglosado | 1, 4, 8 |
| Geolocalización opcional desde `anun_Geolocalizacion` | 3, 8 |
| Documentos nuevos (contrato anterior solo en cambio) | 1, 8, 9 |
| Revisión legal (propietario, acreditación, limitación, condición) | 2, 9 |
| Beneficiarios A/B/C con porcentajes y limpieza de ramas | 2, 9 |
| Compuerta hacia Pre-Cierre sin bloquear tickets anteriores | 2, 5 |
| Reglas de Firestore (abogado asignado + admin; create; Pre-Cierre) | 7 |
| Documentos nuevos en el resumen de Pre-Cierre | 6 |
| Storage sin cambios | — (no requiere tarea) |
| C072 intacto | restricción global, verificado en 10 |

**No cubierto (fuera del spec escrito):** mostrar los datos de la revisión legal (propietario, beneficiarios, etc.) dentro del resumen de Pre-Cierre/Cierre. En la conversación se mencionó, pero el spec guardado no lo incluye; se agrega como tarea aparte si se confirma.
