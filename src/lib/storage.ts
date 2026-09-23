import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";

export interface UploadedDocument {
  name: string;
  url: string;
  path: string; // ruta dentro del bucket, necesaria para poder borrarlo despues
  size: number;
}

// 20 MB. Se valida aqui, del lado del cliente, en vez de en storage.rules via
// request.resource.size — esa condicion demostro ser poco confiable contra
// subidas resumibles (uploadBytesResumable) en pruebas reales, rechazando
// archivos legitimos bien por debajo del limite.
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/*
 * `basePath` cambia segun el contexto: mientras se llena el formulario de
 * Nuevo Ticket todavia no hay un id real, asi que se usa
 * `tickets-drafts/{draftId}` (ver nuevo-ticket-form.tsx); al editar un ticket
 * que ya existe, se usa `tickets/{id}` directo (ver ticket-detail.tsx).
 */
export function uploadTicketFile(
  basePath: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadedDocument> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return Promise.reject(new Error("El archivo pesa mas de 20 MB."));
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${basePath}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(pct);
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({ name: file.name, url, path, size: file.size });
      }
    );
  });
}

export async function deleteTicketDocument(path: string): Promise<void> {
  await deleteObject(ref(storage, path));
}

// Igual que deleteTicketDocument pero para documentos ya guardados en
// `ticket.documentacion`, que solo trae la URL de descarga (no el path del
// bucket) — el SDK puede construir la referencia directo desde la URL.
export async function deleteTicketDocumentByUrl(url: string): Promise<void> {
  await deleteObject(ref(storage, url));
}

/*
 * Se usa al borrar un ticket completo (ver lib/tickets.ts deleteTicket).
 * `documentacion` solo guarda URLs de descarga, no el `path` del bucket, pero
 * el SDK de Storage puede construir una referencia directo desde esa URL. Si
 * un archivo ya no existe (o la URL quedo invalida en tickets viejos) se
 * ignora — no debe bloquear el borrado del ticket.
 */
export async function deleteTicketDocuments(urls: string[]): Promise<void> {
  await Promise.all(urls.map((url) => deleteObject(ref(storage, url)).catch(() => {})));
}
