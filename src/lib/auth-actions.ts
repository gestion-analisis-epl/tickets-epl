import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";
import { dominioPermitido } from "./data/dominios-permitidos";
import { ensureSolicitanteDoc, getUserDoc } from "./users";

export class AuthActionError extends Error {}

const googleProvider = new GoogleAuthProvider();

/*
 * Login de solicitantes: cualquiera con un correo de Google Workspace de uno
 * de los dominios del grupo (ver data/dominios-permitidos.ts). Como son varios
 * dominios, el filtro no se puede hacer con el parametro "hd" de Google — se
 * valida el dominio DESPUES de autenticar, y si no es valido se cierra la
 * sesion de inmediato.
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const email = result.user.email;

  if (!email || !dominioPermitido(email)) {
    await signOut(auth);
    throw new AuthActionError(
      "Tu correo no pertenece a un dominio autorizado del grupo. Contacta a Mesa de Control si esto es un error."
    );
  }

  await ensureSolicitanteDoc(result.user);
}

/*
 * Login de staff interno: area Legal (Mesa de Control / abogados / gerente
 * juridico) y admin (gestion tecnica del sistema — usuarios, catalogo, etc.).
 * Cuenta de correo y contraseña, creada a mano (Firebase Console) por quien
 * administre el sistema — no hay autoservicio para este grupo, son ~10
 * personas conocidas de antemano.
 */
export async function signInStaff(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getUserDoc(result.user.uid);

  if (!userDoc || userDoc.role === "solicitante") {
    await signOut(auth);
    throw new AuthActionError(
      "Esta cuenta no tiene un rol de Legal ni de admin asignado. Pide que te lo configuren antes de intentar de nuevo."
    );
  }
}

export async function signOutUser() {
  await signOut(auth);
}
