import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireAdmin, ApiAuthError } from "@/lib/api-auth";
import type { Role } from "@/types/user";

export const runtime = "nodejs";

interface Params {
  params: { uid: string };
}

// El correo solo se deja editar para staff — el de un solicitante es su
// identidad de Google. "activo" tambien se refleja en Auth.disabled, que es
// lo que de verdad bloquea el login (Firestore por si solo no lo hace).
export async function PATCH(request: Request, { params }: Params) {
  try {
    const callerUid = await requireAdmin(request);
    const { uid } = params;

    if (uid === callerUid) {
      return NextResponse.json({ error: "No puedes editar tu propia cuenta desde aqui." }, { status: 400 });
    }

    const docRef = adminDb.collection("users").doc(uid);
    const current = await docRef.get();
    if (!current.exists) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    const body = await request.json();
    const patchFirestore: Record<string, unknown> = {};
    const patchAuth: Record<string, unknown> = {};

    if (typeof body.nombre === "string" && body.nombre.trim()) {
      patchFirestore.nombre = body.nombre.trim();
      patchAuth.displayName = body.nombre.trim();
    }

    if (typeof body.email === "string" && body.email.trim()) {
      if (current.data()?.role === "solicitante") {
        return NextResponse.json(
          { error: "El correo de un solicitante se administra desde su cuenta de Google, no se puede editar aqui." },
          { status: 400 }
        );
      }
      patchFirestore.email = body.email.trim().toLowerCase();
      patchAuth.email = body.email.trim().toLowerCase();
    }

    if (typeof body.role === "string") {
      patchFirestore.role = body.role as Role;
    }

    if (typeof body.activo === "boolean") {
      patchFirestore.activo = body.activo;
      patchAuth.disabled = !body.activo;
    }

    if (Object.keys(patchAuth).length > 0) {
      try {
        await adminAuth.updateUser(uid, patchAuth);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "auth/email-already-exists") {
          return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
        }
        throw err;
      }
    }

    if (Object.keys(patchFirestore).length > 0) {
      await docRef.update(patchFirestore);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/usuarios/[uid]", err);
    return NextResponse.json({ error: "No se pudo actualizar el usuario." }, { status: 500 });
  }
}

// Borrado definitivo: cuenta de Auth + doc de Firestore. No hay soft-delete
// aqui (para eso esta "activo", ver PATCH arriba).
export async function DELETE(request: Request, { params }: Params) {
  try {
    const callerUid = await requireAdmin(request);
    const { uid } = params;

    if (uid === callerUid) {
      return NextResponse.json({ error: "No puedes eliminar tu propia cuenta." }, { status: 400 });
    }

    try {
      await adminAuth.deleteUser(uid);
    } catch (err) {
      // Si la cuenta de Auth ya no existia (borrada a mano antes, etc.) no
      // bloqueamos el borrado del doc huerfano de Firestore por esto.
      if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
    }

    await adminDb.collection("users").doc(uid).delete();

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("DELETE /api/usuarios/[uid]", err);
    return NextResponse.json({ error: "No se pudo eliminar el usuario." }, { status: 500 });
  }
}
