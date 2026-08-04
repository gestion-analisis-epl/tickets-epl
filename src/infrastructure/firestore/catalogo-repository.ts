import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CatalogoRepository } from "@/domain/catalogo/catalogo-repository";
import type { CatalogoServicio } from "@/types/catalogo";

export const firestoreCatalogoRepository: CatalogoRepository = {
  subscribe(callback) {
    return onSnapshot(collection(db, "catalogoServicios"), (snap) => {
      const servicios = snap.docs
        .map((d) => ({ ...d.data(), id: d.id }) as CatalogoServicio)
        .sort((a, b) => a.id.localeCompare(b.id));
      callback(servicios);
    });
  },

  async create(id, input) {
    await setDoc(doc(db, "catalogoServicios", id), input);
  },

  async update(id, input) {
    await updateDoc(doc(db, "catalogoServicios", id), { ...input });
  },

  async delete(id) {
    await deleteDoc(doc(db, "catalogoServicios", id));
  },

  async listIds() {
    const snap = await getDocs(collection(db, "catalogoServicios"));
    return snap.docs.map((d) => d.id);
  },
};
