# Alta de Arrendador: formulario del solicitante y revisión legal

Fecha: 2026-10-27. Estado: diseño aprobado en conversación, pendiente de revisión del spec.

## Alcance

- Aplica **solo** al servicio Alta de Arrendadores (`JUR-C071`).
- `JUR-C072` (Cambio de Arrendador) **no se toca**; tendrá su propia lógica después.
- El selector "Tipo de alta" (nuevo arrendador / cambio de arrendador) vive dentro de C071.
- Tickets de C071 anteriores a este cambio no tienen los campos nuevos y no se bloquean por ellos.

## 1. Solicitante (formulario de Alta)

Se conservan todos los campos actuales (clave, alias, vigencia inicio/fin, monto, condiciones de pago, motivo, solicitante, etc.) y se agrega:

1. **Tipo de alta** (obligatorio): "Nuevo arrendador" | "Cambio de arrendador".
2. **Motivo del cambio**: texto, obligatorio solo si el tipo es cambio.
3. **Domicilio desglosado**: calle, número, interior (opcional), colonia, municipio, estado, CP, entre calles. Reemplaza al domicilio de texto único; el texto único se arma a partir de estos campos para no romper resúmenes ni correos que lo usan.
4. **Geolocalización**: solo lectura, tomada de la columna `anun_Geolocalizacion` de la hoja de sitios al elegir el sitio. Si falta, se muestra "No disponible" y no bloquea el envío. La columna es **opcional** en el lector de la hoja (hoy el lector falla si falta una columna requerida).
5. **Documentos** (un campo por documento, como hoy): identificaciones, personalidad legal, acreditación de propiedad (es el actual "escrituras", renombrado), predial, comprobante de domicilio (se conserva) y contrato anterior (solo si es cambio).

## 2. Revisión legal (abogado)

Sección "Revisión legal" en el detalle del ticket, editable por el abogado asignado y los roles tipo admin. Se puede guardar a medias. Cada paso aparece cuando el anterior está contestado:

1. **Tipo de propietario**: física | moral.
   - Física: nombre completo.
   - Moral: razón social, nombre del representante legal y documento de personalidad con actos de dominio para arrendar el inmueble (obligatorio).
2. **¿Se acredita la propiedad?** Sí → documento que acredita la propiedad. No → carta de autorización.
3. **¿Existe limitación?** Sí → tipo de limitación (texto libre; se aísla en un solo lugar para convertirlo después en lista desplegable). No → nada.
4. **Beneficiario del pago** (sección 3).
5. **¿Existe condición para el pago?** Sí → cuál (texto libre). No → nada.

Al guardar se borran los datos y documentos de las ramas que dejan de aplicar. Los documentos se suben con el mismo mecanismo y reglas de formato y tamaño que los del solicitante.

## 3. Beneficiarios del pago de rentas

Se elige un escenario:

- **A. Beneficiario = propietario**: sin captura adicional; 100 %.
- **B. Beneficiario distinto**: nombre completo o razón social, documento de acreditación, casilla "se redactará cláusula especial" (recordatorio, el sistema no redacta); 100 %.
- **C. Varios beneficiarios**: lista de mínimo 2 (nombre completo o razón social), con dos modalidades:
  - **Equitativo**: porcentaje calculado (100 ÷ n); el último absorbe la diferencia (33.33 / 33.33 / 33.34). Sin acreditación por beneficiario.
  - **Representante común**: se elige a uno de la lista; se sube su acreditación y una carta de autorización para recibir la renta; recibe 100 %, los demás 0 %.

Los porcentajes se guardan como enteros en centésimas de por ciento (10000 = 100 %) y siempre suman 10000.

## 4. Validaciones, seguridad y pruebas

**Modelo.** Dos bloques nuevos en el ticket: `altaArrendador` (solicitante) y `revisionLegal` (abogado).

**Validaciones** (funciones puras en `src/domain/tickets/`, probadas por separado): ampliar la validación del solicitante; validar la revisión legal devolviendo qué falta en lenguaje simple; limpiar ramas que no aplican; calcular reparto equitativo; compuerta hacia Pre-Cierre.

**Compuerta.** Un ticket de C071 con tipo de alta capturado no pasa a Pre-Cierre con la revisión legal incompleta. Tickets de C071 sin estos campos no se bloquean.

**Reglas de Firestore.**
- `revisionLegal` solo la escribe el abogado asignado (`esAbogadoAsignado`) o un rol tipo admin. **Mesa de Control queda sin acceso de escritura** (confirmado).
- En la creación del ticket, el solicitante no puede incluir `revisionLegal` (igual que `resumenContrato`).
- En Pre-Cierre queda bloqueada porque no está en `camposProcesoPreCierre`; para corregirla se regresa el ticket de etapa.
- Actualizar los comentarios "Sincronizar a mano" entre reglas y código.

**Storage.** Sin cambios; los documentos van en `tickets/{folio}/...`. La regla actual (cualquier usuario con sesión) es permisiva; ajustarla queda fuera de alcance.

**Pruebas.** Pruebas unitarias de las funciones puras, escritas antes del código, en el estilo de los `*.test.ts` existentes. No se agregan pruebas de reglas de Firestore (no existen en el repo); se revisan a mano y el flujo se prueba en el navegador con solicitante y abogado. Al final: `tsc`, lint y suite de pruebas.

## Fuera de alcance

- Cambio de Arrendador (C072).
- Convertir "tipo de limitación" en lista desplegable.
- Endurecer las reglas de Storage.
- Redacción automática de la cláusula especial.

## Nota para la implementación

`AGENTS.md` indica que esta versión de Next tiene cambios que rompen convenciones y pide leer `node_modules/next/dist/docs/` antes de escribir código; esa carpeta no se encontró (posiblemente faltan dependencias). Resolverlo antes de tocar código de pantalla.
