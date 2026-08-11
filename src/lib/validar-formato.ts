import { auth } from "./firebase";

export type ResultadoValidacionFormato = "valido" | "invalido" | "error";

// Falla de red/auth se reporta como "error", no "invalido", para no confundir a quien subio el archivo correcto.
export async function validarFormatoArrendamiento(url: string): Promise<ResultadoValidacionFormato> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) return "error";

  try {
    const res = await fetch("/api/validar-formato-arrendamiento", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return "error";
    const data = await res.json();
    return data.valido ? "valido" : "invalido";
  } catch {
    return "error";
  }
}
