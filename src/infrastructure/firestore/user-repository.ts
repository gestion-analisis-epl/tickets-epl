import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserRepository } from "@/domain/users/user-repository";
import type { UserDoc } from "@/domain/users/user";

export const firestoreUserRepository: UserRepository = {
  async getById(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data() as UserDoc) : null;
  },

  async findByEmail(email) {
    const snap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
    if (snap.empty) return null;
    const docSnap = snap.docs[0];
    return { uid: docSnap.id, data: docSnap.data() as UserDoc };
  },

  async create(uid, data) {
    await setDoc(doc(db, "users", uid), { ...data, creadoEn: serverTimestamp() });
  },

  async delete(uid) {
    await deleteDoc(doc(db, "users", uid));
  },

  async listAll() {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as UserDoc) }));
  },
};
