# Jefe de Zona, etapa Pre-Cierre y resumen de contratos con Gemini

Fecha: 2026-10-08 · Rama: `catalogos-pruebas`

## Objetivo

1. Nuevo rol `jefe_zona` con acceso de solo consulta a tickets en **Pre-Cierre** y **Cierre**, con información restringida.
2. Nueva etapa **Pre-Cierre** entre "Validacion y presentacion de requerimiento" y "Cierre".
3. Resumen automático del contrato de arrendamiento con Gemini (Google AI Studio), con detección de discrepancias contra los datos del ticket.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Alcance del jefe de zona | Todos los tickets en Pre-Cierre y Cierre (sin filtro por zona) |
| Acciones | Lectura + registrar visto bueno en Pre-Cierre. **No** mueve la etapa; el abogado/admin pasa a Cierre. El visto bueno no bloquea el cierre |
| Información visible | Resumen del contrato + descarga del contrato original. Nada más del ticket |
| Contrato | Archivo `.docx` ya existente en `ticket.documentacion` cuyo nombre coincide con `/CONTRATO_ARRENDAMIENTO/i`. No se agrega campo al formulario |
| Momento del resumen | Al crear el ticket (asíncrono). Backfill para tickets existentes |
| Campos con Gemini | Extrae los 8 puntos y marca discrepancias contra el ticket |
| Aviso | Correo a todos los jefes de zona activos al entrar a Pre-Cierre, con preferencia por usuario |
| Proveedor IA | Google AI Studio, llave `GEMINI_API_KEY` solo de servidor |

## 1. Rol y etapa

- `src/types/user.ts`: agregar `jefe_zona` a `Role`. No pertenece a `STAFF_ROLES` ni `LEGAL_STAFF_ROLES`. Agregar helper `esJefeZona`.
- `src/types/ticket.ts`: agregar `"Pre-Cierre"` a `ESTATUS_VALUES` antes de `"Cierre"`. Ajustar badge (`ui/badge.tsx`), kanban, `dashboard-stats.ts` (`porEstatus`; Pre-Cierre cuenta como activo), `asignacion-rules.ts`.
- `firestore.rules`: función `isJefeZona()`; el rol no tiene lectura sobre `tickets`.
- Panel admin (`usuarios-panel.tsx`) y sidebar: permitir asignar el rol; el sidebar del jefe de zona solo muestra su vista.
- Dominios de correo y `api-auth.ts` sin cambios salvo reconocer el rol.

## 2. Visibilidad restringida: colección `resumenesContrato`

Las reglas de Firestore no ocultan campos, así que el jefe de zona **no lee `tickets`**. Lee `resumenesContrato/{ticketId}`:

```
folio, estatus, sitio {clave, alias}, domicilio, solicitante,
periodoInicio, periodoFin, altaArrendador,
condicionesPago, montoPagoAnual, formaPago,
discrepancias[], contratoUrl, contratoNombre,
estadoResumen: pendiente | listo | error | sin_contrato,
vistoBueno?: { uid, nombre, fecha }, actualizadoEn
```

- Regla de lectura: `isJefeZona() && estatus in ['Pre-Cierre','Cierre']`; staff legal y admin leen todo.
- Escritura: solo servidor (Admin SDK) y, para `vistoBueno`, el jefe de zona únicamente sobre ese campo y solo en Pre-Cierre.
- Sincronización: al cambiar `estatus`, el servicio de tickets actualiza `estatus` del resumen. Las etapas anteriores a Pre-Cierre existen en el resumen, pero el jefe no puede leerlas.
- `storage.rules`: la lectura del contrato por jefe de zona se sirve por API (`/api/contratos/[ticketId]/descargar`) que valida rol y etapa; no se abre Storage a este rol.
- UI: página `/pre-cierre` (lista) y detalle de solo lectura con botón "Dar visto bueno".

## 3. Gemini

- Dependencia: `@google/genai`. Variables: `GEMINI_API_KEY`, `GEMINI_MODEL` (en `.env.example`).
- `POST /api/contratos/resumir` (protegido con `api-auth.ts`): descarga el docx, extrae texto con `lib/docx-texto.ts`, llama a Gemini con salida JSON estructurada (schema fijo) y escribe `resumenesContrato`.
- Prompt: extraer sitio/código, domicilio, alta arrendador, solicitante, periodo, condiciones de pago, monto anual y forma de pago (mensual, bimestral, trimestral, semestral, anual, bianual, otra); devolver `null` cuando no conste en el contrato, sin inventar.
- Discrepancias (regla pura): comparar domicilio, periodo y arrendador extraídos contra el ticket con normalización de texto/fechas; registrar `{campo, valorTicket, valorContrato}`.
- Disparo: tras crear el ticket, sin bloquear la creación; fallo de Gemini = `estadoResumen: error`.
- Sin archivo coincidente: `sin_contrato`, sin llamar a Gemini. Abogado/admin pueden elegir otro archivo del ticket y regenerar.
- Backfill en Configuración > Mantenimiento para tickets existentes.
- Privacidad: el texto del contrato sale hacia Google AI Studio; no registrar el contenido en logs.

## 4. Correos

Tipo `pre_cierre` en `email-template.ts` y `ticket-notifier.ts`: destinatarios = jefes de zona activos con preferencia habilitada (`preferencias-rules.ts`). El correo no incluye datos del contrato, solo folio, sitio y enlace.

## 5. Pruebas (vitest)

- `visibilidad-rules`: jefe de zona solo ve Pre-Cierre/Cierre.
- `encontrarContrato`: coincidencias, mayúsculas, sin archivo, varios archivos.
- Parseo/validación de la respuesta de Gemini (campos nulos, forma de pago inválida).
- Comparación de discrepancias.
- Estadísticas del dashboard con Pre-Cierre.
- `user.test.ts` con el rol nuevo. Las reglas de Firestore y las rutas API no tienen pruebas hoy; se verifican manualmente.

## Riesgos y puntos abiertos

- **Convención de nombre:** se asume que los tickets traen el docx `*_CONTRATO_ARRENDAMIENTO_*`. Verificar con tickets reales antes de implementar; el estado `sin_contrato` cubre las excepciones.
- **Precisión de la IA:** el resumen es apoyo, no sustituye la revisión legal; la UI lo indica.
- **`firestore.rules` se sincroniza a mano** con `user.ts`; incluir ambos en el mismo cambio.
- **Costo/latencia:** una llamada por contrato; reintentos manuales, no automáticos.
