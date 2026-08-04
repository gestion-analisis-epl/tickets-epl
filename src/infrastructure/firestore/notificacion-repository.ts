import { collection, addDoc, doc, updateDoc, arrayUnion, onSnapshot, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LEGAL_STAFF_ROLES } from "@/types/user";
import type { NotificacionRepository } from "@/domain/notificaciones/notificacion-repository";
import type { Notificacion } from "@/domain/notificaciones/notificacion";

export const firestoreNotificacionRepository: NotificacionRepository = {
  async crear(input) {
    await addDoc(collection(db, "notificaciones"), { ...input, fecha: new Date().toISOString(), leidoPor: [] });
  },

  // Dos listeners por separado (uno por paraUid, otro por paraRoles) en vez de
  // un OR compuesto — evita depender de un indice compuesto; se combinan y
  // ordenan en JS.
  subscribeMany({ uid, role }, callback) {
    let porUid: Notificacion[] = [];
    let porRol: Notificacion[] = [];

    function emit() {
      const combinadas = [...porUid, ...porRol];
      combinadas.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      callback(combinadas);
    }

    const unsubUid = onSnapshot(query(collection(db, "notificaciones"), where("paraUid", "==", uid)), (snap) => {
      porUid = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Notificacion);
      emit();
    });

    // admin no forma parte de LEGAL_STAFF_ROLES (no atiende tickets) — las
    // reglas de Firestore solo autorizan este query para Legal staff, asi
    // que ni se intenta para otros roles (evita un permission-denied).
    if (!LEGAL_STAFF_ROLES.includes(role)) {
      return unsubUid;
    }

    const unsubRol = onSnapshot(query(collection(db, "notificaciones"), where("paraRoles", "array-contains", role)), (snap) => {
      porRol = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Notificacion);
      emit();
    });

    return () => { unsubUid(); unsubRol(); };
  },

  async marcarLeida(id, uid) {
    await updateDoc(doc(db, "notificaciones", id), { leidoPor: arrayUnion(uid) });
  },

  async findUidPorAbogado(abogadoId) {
    const snap = await getDocs(query(collection(db, "users"), where("abogadoId", "==", abogadoId), limit(1)));
    return snap.empty ? null : snap.docs[0].id;
  },
};
