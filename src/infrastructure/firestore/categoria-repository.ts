import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CategoriaRepository } from "@/domain/catalogo/categoria-repository";
import type { CategoriaCatalogo } from "@/domain/catalogo/categoria";

// El doc id es el nombre de la categoria (no un id autogenerado) — asi
// renombrar no aplica (se borra y se crea de nuevo) pero de paso Firestore
// evita por si solo crear dos categorias con el mismo nombre.
export const firestoreCategoriaRepository: CategoriaRepository = {
  subscribe(callback) {
    return onSnapshot(collection(db, "categorias"), (snap) => {
      const categorias = snap.docs
        .map((d) => ({ ...d.data(), id: d.id }) as CategoriaCatalogo)
        .sort((a, b) => a.orden - b.orden);
      callback(categorias);
    });
  },

  async create(input, orden) {
    await setDoc(doc(db, "categorias", input.nombre), { ...input, orden });
  },

  async update(id, input) {
    await updateDoc(doc(db, "categorias", id), { ...input });
  },

  async delete(id) {
    await deleteDoc(doc(db, "categorias", id));
  },

  async list() {
    const snap = await getDocs(collection(db, "categorias"));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as CategoriaCatalogo);
  },
};
