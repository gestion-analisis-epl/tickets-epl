import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/firebase";
import { requireAdmin, ApiAuthError } from "@/lib/api-auth";
import { STAFF_ROLES, type Role } from "@/types/user";

export const runtime = "nodejs";

// Crea una cuenta de staff (reemplaza el alta manual en Firebase Console).
// La contrasena es aleatoria y nunca se expone: se manda el correo nativo de
// Firebase para que la persona fije la suya (ver sendPasswordResetEmail abajo).
export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const nombre = String(body.nombre ?? "").trim();
    const role = body.role as Role;

    if (!email || !nombre) {
      return NextResponse.json({ error: "Nombre y correo son obligatorios." }, { status: 400 });
    }
    if (!STAFF_ROLES.includes(role)) {
      return NextResponse.json({ error: "Rol invalido para una cuenta de staff." }, { status: 400 });
    }

    const passwordTemporal = crypto.randomUUID() + crypto.randomUUID();

    let uid: string;
    try {
      const userRecord = await adminAuth.createUser({
        email,
        password: passwordTemporal,
        displayName: nombre,
      });
      uid = userRecord.uid;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-exists") {
        return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
      }
      if (code === "auth/invalid-email") {
        return NextResponse.json({ error: "El correo no es valido." }, { status: 400 });
      }
      throw err;
    }

    await adminDb.collection("users").doc(uid).set({
      nombre,
      email,
      role,
      activo: true,
      creadoEn: FieldValue.serverTimestamp(),
    });

    // Si el correo falla, la cuenta ya quedo creada y utilizable — se reporta
    // para que el admin comparta el acceso por otro medio, sin revertir el alta.
    let correoEnviado = true;
    try {
      await sendPasswordResetEmail(auth, email);
    } catch {
      correoEnviado = false;
    }

    return NextResponse.json({ uid, correoEnviado }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/usuarios", err);
    return NextResponse.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
  }
}
