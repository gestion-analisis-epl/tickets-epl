# Tickets Legal EPL

Sistema de gestión de solicitudes (tickets) para el área Legal de EPL. Reemplaza el flujo manual en Excel: los solicitantes abren tickets contra un catálogo de servicios estandarizados, y Legal les da seguimiento con SLA en días hábiles hasta el cierre.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **Firebase**: Auth, Firestore, Storage, Admin SDK
- **Zustand** (estado de auth), **TanStack Table** y **dnd-kit** (vista de tickets en tabla/kanban)

### Proyecto Firebase compartido con KRONOS

Este sistema vive en el mismo proyecto Firebase que KRONOS (`kronos-7ebd7`) — comparte Auth — pero está aislado a nivel de datos:

- Firestore: base de datos nombrada `epl-tickets` (no la `(default)`, esa es de KRONOS). Ver `src/lib/firebase-config.ts`.
- Storage: bucket propio `tickets-epl-legal` (no el bucket default del proyecto).

## Primeros pasos

```bash
pnpm install
cp .env.example .env.local   # llenar con los valores de Firebase (ver comentarios en el archivo)
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Roles

| Rol | Puede |
| --- | --- |
| `solicitante` | Crear tickets y ver los propios |
| `mesa_control` | Asignar abogado responsable, dar seguimiento |
| `abogado` | Trabajar los tickets asignados |
| `gerente_juridico` | Visibilidad completa del área |
| `admin` | Gestionar usuarios y catálogo de servicios |

La asignación de roles (excepto `solicitante`, que se autoasigna al primer login) se hace desde Configuración → Usuarios, y requiere rol `admin` (ver `firestore.rules`).

## Reglas de seguridad

`firestore.rules` y `storage.rules` no se versionan en este repo — se despliegan directo con:

```bash
firebase deploy --only firestore:rules,storage:rules
```

## Estructura

- `src/app/(app)/` — páginas: dashboard, tickets (lista/kanban/detalle), catálogo, configuración
- `src/lib/tickets.ts`, `src/lib/ticket-derived.ts` — lógica de tickets y campos calculados (SLA, nivel de servicio)
- `src/lib/business-days.ts` — cálculo de días hábiles
- `src/types/` — modelos (`Ticket`, `CatalogoServicio`, `AppUser`)
