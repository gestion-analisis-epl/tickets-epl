# Trazabilidad de archivos por ticket

Fecha: 2026-11-20

## Problema

El historial de cambios del ticket no dice quién subió cada archivo. `ticket.documentacion` es un `string[]` de URLs
sin autor. El historial solo registra quién editó la documentación cuando se hace desde el detalle del ticket; las subidas al
crear el ticket (Nuevo ticket, Alta, Alta retroactiva) y los anexos de la revisión legal no dejan registro.
Se necesita saber con exactitud qué archivos subió el solicitante, cuáles el abogado, cuáles el gerente jurídico, etc.

## Decisiones

- **Enfoque A:** registro aparte por archivo, subcolección `tickets/{id}/archivos`. No cambia la forma de las URLs en el ticket
  (no se rompen ZIP, resúmenes ni Gemini).
- **Alcance:** todos los caminos de subida (ver tabla). Los comentarios de la conversación no llevan adjuntos, no aplican.
- **Dónde se ve:** junto a cada archivo y como entradas del Historial de cambios.
- **Quién lo ve:** quien puede leer el ticket: solicitante dueño, gerente de área o de sitios que lo supervisa, Legal
  (mesa de control, abogado, gerente jurídico) y admin.
- **Tickets existentes:** sus archivos muestran "Origen no registrado". No se reconstruye.

## Modelo de datos

Documento `tickets/{ticketId}/archivos/{archivoId}`:

| Campo | Descripción |
|---|---|
| `nombre` | Nombre original del archivo. |
| `ruta` | Ruta en Storage (`tickets/{id}/...`). Llave para unir con la URL (`rutaDeUrlStorage`). |
| `origen` | De dónde viene: `documentacion`, `formato_arrendamiento`, `documento_arrendamiento`, `alta`, `revision_legal`. |
| `campo` | Campo concreto cuando aplica (p. ej. la clave del documento de Alta). Se omite si no aplica. |
| `accion` | `subido` o `eliminado`. |
| `fecha` | ISO. |
| `actorUid`, `actorNombre`, `actorRol` | Quién hizo la acción. |

Solo se agregan documentos. Borrar un archivo agrega un registro `eliminado`; el `subido` original no se toca.
Nunca se guarda la URL de descarga (lleva token), igual que el historial actual.

Las entradas del Historial (`tickets/{id}/historial`) se amplían con dos tipos: `archivo_subido` y `archivo_eliminado`.
Se escriben en el mismo lote que el registro del archivo.

## Dónde se escribe

Un servicio de dominio único (`domain/archivos/`) arma el registro y su entrada de historial. Los formularios lo llaman, no
repiten la lógica.

| Camino | Componente | Momento |
|---|---|---|
| Nuevo ticket y Alta | `nuevo-ticket-form.tsx` | Los archivos suben primero a `tickets-drafts/`. Los registros se escriben en el mismo lote que crea el ticket, con la ruta ya conocida. |
| Alta retroactiva | `alta-retroactiva-form.tsx` | Actualiza un ticket que ya existe: los registros van en el mismo lote que guarda los datos de alta. |
| Detalle del ticket | `ticket-detail.tsx` | Al agregar o quitar documentación, junto con el cambio que ya se guarda. |
| Revisión legal | `revision-legal-panel.tsx` | Al subir o quitar un anexo del abogado. |

El contrato no tiene un camino de subida propio: es un archivo más de `documentacion`, por eso no hay origen `contrato`.
Las entradas del Historial de los archivos subidos al crear el ticket se escriben justo después de crearlo (las reglas
necesitan que el ticket exista); el registro de cada archivo sí se guarda atómicamente con el ticket.
Los dos tipos de historial nuevos son "de proceso": el solicitante y los abogados ven todas las subidas, sin importar quién las haga.

Los archivos en `tickets-drafts/` conservan su ruta de borrador; el registro guarda esa ruta real.

## Reglas de Firestore

`tickets/{ticketId}/archivos/{archivoId}`:
- `read`: quien puede leer el ticket (`resource` del ticket: dueño, `supervisaA`, `isLegalStaff()`, `isAdmin()`).
- `create`: usuario autenticado con `actorUid == request.auth.uid` y `actorRol == myRole()`, y que ya pueda escribir esa
  parte del ticket (dueño, Legal o admin). Campos exactos con `hasOnly`.
- `update`, `delete`: `false`.

Las reglas del historial se amplían para aceptar `archivo_subido` y `archivo_eliminado` con los mismos permisos de creación que ya
tienen `solicitud` y `documentos` (dueño) y Legal/admin.

## Interfaz

- Junto a cada archivo del ticket: "Subido por Ana, Solicitante, 3 oct 2026". Si no hay registro: "Origen no registrado".
- Historial de cambios: entradas "Subió X" y "Eliminó X" con actor, rol y fecha, usando el color por rol existente.
- Lenguaje simple, sin textos cortados, un dato por campo.

## Fuera de alcance

- Jefe de zona y Sitios leen el resumen del contrato, no el ticket: **no** ven el "subido por". Si se quiere después, se copian
  los registros al resumen.
- No se reconstruye el autor de archivos de tickets anteriores.
- No se valida en Storage quién sube (las reglas de Storage no cambian).

## Pruebas

- Servicio de dominio: registro y entrada de historial correctos por rol (solicitante, abogado, gerente jurídico, mesa de control, admin).
- Unión de registros con URLs por `ruta`; "Origen no registrado" cuando no hay registro.
- Un archivo eliminado muestra su `subido` y su `eliminado`.
- Un test por cada camino de subida.
- Reglas: ninguna persona puede registrar con el uid o el rol de otra.
