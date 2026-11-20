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
