# Historial de cambios y conversación de Pre-Cierre

Fecha: 2026-10-09 · Rama: `feature/jefe-zona-pre-cierre` · Continúa la especificación `2026-10-08-jefe-zona-pre-cierre-gemini-design.md`.

## Objetivo

1. **Historial de cambios** del ticket: registro de auditoría con valor anterior y nuevo, visible solo para Admin, Gerente Jurídico y el abogado asignado.
2. **Conversación** estilo Jira desde Pre-Cierre: jefe de zona, solicitante, abogado asignado, Gerente Jurídico y admin comentan y hacen observaciones sobre el ticket o el contrato. La solicitud queda bloqueada y toda corrección se discute en el hilo. El jefe de zona puede **pedir cambios**, que regresa el ticket al abogado.

Se construye en dos planes: **Plan C (historial)** y **Plan D (conversación)**. D depende de C.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Qué registra el historial | Todo cambio del ticket con antes/después: estatus, asignación y reasignación, edición de la solicitud, documentos, sitio, exclusión del pipeline, notas de cierre, vistos buenos, cambios pedidos, ediciones y borrados de comentarios |
| Dónde se escribe | Desde la app, en el mismo lote (`writeBatch`) que el cambio del ticket; reglas de solo agregar. Excepción: "Pedir cambios" va por ruta de servidor (Admin SDK) |
| Quién ve el historial | Admin, Gerente Jurídico (hoy `isAdmin()` lo incluye) y el abogado asignado a ese ticket. No lo ven Mesa de Control, otros abogados, solicitante ni jefe de zona |
| Participantes del hilo | Solicitante dueño, abogado asignado, Gerente Jurídico, admin y jefes de zona activos. No participan Mesa de Control ni otros abogados |
| Cuándo se escribe | Desde que el ticket entra a Pre-Cierre. Si regresa a una etapa anterior el hilo se conserva y se sigue escribiendo. En Cierre es de solo lectura |
| Comentarios | Solo texto; el autor edita y borra los suyos. Borrar es lógico ("comentario eliminado"); cada edición/borrado guarda el texto anterior en el historial |
| Bloqueo en Pre-Cierre | Solicitud, documentos y sitio bloqueados para todos (también admin). Corregir implica regresar la etapa. Se permiten solo campos de proceso |
| Regresar de Pre-Cierre | Quien ya cambia estatus hoy, más el jefe de zona con "Pedir cambios" |
| "Pedir cambios" | Regresa siempre a **"Proceso en tramite"**, exige un comentario, borra el visto bueno y avisa al abogado y al solicitante |
| Admin en Pre-Cierre | Puede reasignar el abogado (cambio de proceso, permitido) |
| Avisos | Correo + campana a los demás participantes, con interruptor de correo por usuario. El correo **no incluye el texto** del comentario |
| Diseño de pantalla | El resumen del contrato va en una columna derecha, en el detalle del ticket y en `/pre-cierre/[id]`; la conversación ocupará la columna izquierda del jefe de zona |

## Parte 1 — Historial de cambios (Plan C)

### Modelo
Subcolección `tickets/{ticketId}/historial/{entradaId}`:

```
fecha: string ISO
actorUid, actorNombre, actorRol
tipo: "estatus" | "asignacion" | "solicitud" | "documentos" | "sitio" | "exclusion"
    | "notas_cierre" | "visto_bueno" | "cambios_solicitados"
    | "comentario_editado" | "comentario_eliminado"
cambios: [{ campo: string, etiqueta: string, antes: string | null, despues: string | null }]
```
Los valores se guardan como texto legible: los documentos se listan por nombre de archivo (no por URL), las fechas en ISO, los booleanos como "sí/no". Un cambio de estatus conserva además el `historialEstatus` existente del ticket, del que depende el SLA; no se reemplaza.

### Cálculo y escritura
- Función pura `calcularCambios(antes: Ticket, despues: Partial<Ticket>, campos: CampoVigilado[]): CambioCampo[]` (con pruebas) que compara solo los campos vigilados y omite los que no cambian. Los campos derivados (categoría, SLA, fecha compromiso) se registran dentro de la entrada `solicitud` solo si cambian.
- Los métodos de `ticket-service.ts` que modifican el ticket (`updateTicketAsignacion`, `updateTicketSolicitud`, `updateTicketSitio`, `updateTicketExclusion`, y la subida/baja de documentos) construyen la entrada y la escriben en el **mismo `writeBatch`** que el cambio. Un puerto `HistorialRepository` en el dominio y su implementación en `infrastructure/firestore`, siguiendo el patrón de `ResumenContratoRepository`.
- Si no hay cambios efectivos no se crea entrada.

### Reglas de Firestore
- **read:** `isAdmin()` o abogado asignado: `get(users/$(uid)).data.abogadoId == get(tickets/$(ticketId)).data.abogadoAsignadoId`.
- **create:** usuario autenticado cuyo `request.resource.data.actorUid == request.auth.uid` y que sea Legal o admin; el solicitante dueño solo para los tipos `solicitud` y `documentos`.
- **update y delete:** denegados (solo agregar).

### Pantalla
Pestaña o sección "Historial" en el detalle del ticket, visible solo con el rol/abogado de la regla. Línea de tiempo en orden descendente: fecha, quién, tipo y cada cambio con antes → después. Para tickets previos al despliegue se muestran, al final, las entradas de `historialEstatus` como cambios de estatus sin detalle de campos. No hay migración.

### Límite conocido
Un administrador técnico que escriba directo a Firestore, sin pasar por la app, puede modificar un ticket sin dejar entrada. Endurecimiento posible: exigir en las reglas, con `getAfter()`, que cada actualización traiga su entrada de historial.

## Parte 2 — Conversación (Plan D)

### Habilitación
- Al entrar por primera vez a Pre-Cierre, el servicio fija `conversacionAbiertaEn` (ISO) en el ticket, dentro de `updateTicketAsignacion`.
- Se puede escribir si `conversacionAbiertaEn` existe **o** el estatus actual es Pre-Cierre (cubre tickets que ya estaban ahí al desplegar), y el estatus no es Cierre.
- Lectura: participantes mientras el hilo exista; el jefe de zona solo cuando `resumenesContrato/{id}.estatus` sea Pre-Cierre o Cierre (misma visibilidad que su resumen).

### Modelo
Subcolección `tickets/{ticketId}/comentarios/{comentarioId}`:

```
autorUid, autorNombre, autorRol
texto: string | null          // null cuando está eliminado
tipo: "comentario" | "cambios_solicitados"
creadoEn: string ISO
editadoEn?: string ISO
eliminado: boolean
```
Longitud máxima del texto: 4000 caracteres (validada en reglas y en la pantalla).

### Reglas de Firestore (esquema)
- **Participante:** solicitante dueño (`ticket.solicitanteId == uid`), abogado asignado, `gerente_juridico`, `admin` o `jefe_zona`.
- **create:** participante, hilo habilitado, `autorUid == request.auth.uid`, `eliminado == false`, `tipo == "comentario"` (el tipo `cambios_solicitados` solo lo crea el servidor).
- **update:** solo el autor, solo los campos `texto`, `editadoEn` y `eliminado`, hilo habilitado, y el documento no puede volver de eliminado a no eliminado.
- **delete:** denegado.
- Las lecturas de documentos por regla (`users`, `tickets`, `resumenesContrato`) quedan dentro del límite de Firestore para una sola solicitud.

### Edición y borrado
Editar y borrar son actualizaciones del comentario; al hacerlo, el servicio escribe en el mismo lote una entrada de historial `comentario_editado` o `comentario_eliminado` con el texto anterior.

### "Pedir cambios"
Ruta de servidor `POST /api/tickets/[id]/pedir-cambios` con `{ texto }`:
1. Verifica el token y que el rol sea `jefe_zona`, que el ticket esté en Pre-Cierre y que `texto` no esté vacío.
2. En una sola operación con Admin SDK: pasa el ticket a **"Proceso en tramite"** con su entrada en `historialEstatus` (el SLA del abogado se reanuda solo, por la regla de pausa existente); limpia `vistoBueno` y actualiza `estatus` en `resumenesContrato`; crea el comentario `cambios_solicitados`; escribe la entrada de historial `cambios_solicitados`.
3. Envía aviso (campana y correo) al abogado asignado y al solicitante.
Errores al jefe de zona con mensajes genéricos; el detalle va al log del servidor.

### Bloqueo de la solicitud en Pre-Cierre
- **Solicitante:** en la regla de `tickets`, la edición de su solicitud pasa de `estatus != "Cierre"` a `estatus not in ["Pre-Cierre", "Cierre"]`.
- **Legal y admin:** con el ticket en Pre-Cierre, `update` solo puede tocar campos de proceso: `estatus`, `historialEstatus`, `abogadoAsignadoId`, `fechaAsignacion`, `fechaCompromiso`, `notasCierre`, `fechaCierre`, `diasPipeline`, `diasHabilesTranscurridos`, `nivelServicio`, `tokenCalificacion`, `conversacionAbiertaEn`, `excluidoDelPipeline` y `resumenContrato`. No pueden cambiar descripción, servicio, área, sitio, documentos ni datos del contrato.
- La interfaz oculta o deshabilita los controles de edición correspondientes (`puedeEditarSolicitud`, `puedeEditarDocumentos`, edición de sitio) cuando el estatus es Pre-Cierre.
- Una función pura `camposPermitidosPorEtapa(estatus, rol)` documenta y prueba la misma tabla que las reglas.

### Avisos
- Tipos nuevos de notificación: `comentario_ticket` y `cambios_solicitados`.
- Destinatarios de un comentario: solicitante dueño, abogado asignado, Gerente Jurídico y admin activos, y jefes de zona activos, menos el autor. Filtro por preferencia con `filtrarDestinatarios`.
- `preferencias-rules.ts`: ambos tipos entran en `CORREOS_POR_ROL` de los roles participantes para poder apagarlos desde el panel de admin.
- Correo con folio, autor y enlace (`/tickets/{id}` para solicitante y Legal, `/pre-cierre/{id}` para jefes de zona). **No incluye el texto** del comentario.
- Campana en la app mediante `crearNotificacion`, igual que los avisos actuales.

### Pantalla
- Panel "Conversación" (lista cronológica, caja para escribir, editar/eliminar lo propio, marca "editado") en el detalle del ticket para los participantes, y en `/pre-cierre/[id]` para el jefe de zona (columna izquierda; el resumen queda a la derecha).
- Los comentarios `cambios_solicitados` se destacan visualmente.
- En el hilo cerrado (Cierre) los controles de escritura se ocultan.
- En `/pre-cierre/[id]`, botón "Pedir cambios" junto al visto bueno, con caja de texto obligatoria.

## Pruebas
- **Unitarias (vitest):** `calcularCambios`; construcción de entradas de historial por tipo; destinatarios de un comentario (sin autor, con preferencias, con roles); `camposPermitidosPorEtapa`; validación y límites del texto; reglas de quién edita/borra un comentario; el servicio escribe cambio e historial en el mismo lote (repositorios falsos); "Pedir cambios" (validaciones y resultado esperado con dependencias inyectadas).
- **Reglas de Firestore y pantallas:** no hay emulador ni pruebas de componentes en el repo; se entregan listas de verificación manual, como en los planes anteriores.

## Partición en planes
1. **Plan C — Historial:** puerto, repositorio, `calcularCambios`, integración en el servicio, reglas, pestaña "Historial".
2. **Plan D — Conversación:** `conversacionAbiertaEn`, comentarios, reglas, bloqueo en Pre-Cierre, ruta "Pedir cambios", avisos, panel y pantallas.

## Riesgos y puntos abiertos
- El historial no es evidencia ante escrituras directas a Firestore (ver "Límite conocido").
- Las reglas de Firestore y de Storage siguen ignoradas en git: los cambios de `firestore.rules` viven solo en el disco del equipo y deben desplegarse a mano tras probarse.
- Mesa de Control, que hoy puede modificar tickets, queda fuera del hilo y del historial; si se necesita que lea ambos, se agrega después.
- `gerente_area` (supervisor de áreas) no participa; si se necesita, es un cambio posterior.
- Confirmados por el usuario y fijados aquí: "Pedir cambios" regresa a "Proceso en tramite" y el admin puede reasignar durante Pre-Cierre.
