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
