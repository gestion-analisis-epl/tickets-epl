import type { UserRepository } from "./user-repository";
import type { UserDoc } from "./user";

export interface AuthenticatedIdentity {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export function createUserService(repo: UserRepository) {
  async function getUserDoc(uid: string): Promise<UserDoc | null> {
    return repo.getById(uid);
  }

  // Un uid nuevo (cuenta borrada y recreada) puede tener un doc huerfano con el mismo correo — se hereda su rol.
  async function ensureSolicitanteDoc(user: AuthenticatedIdentity): Promise<UserDoc> {
    const existing = await repo.getById(user.uid);
    if (existing) return existing;

    if (user.email) {
      const huerfano = await repo.findByEmail(user.email);
      if (huerfano) {
        await repo.create(user.uid, huerfano.data);
        await repo.delete(huerfano.uid).catch(() => {});
        return huerfano.data;
      }
    }

    const nuevo: UserDoc = {
      nombre: user.displayName ?? user.email ?? "Sin nombre",
      email: user.email ?? "",
      role: "solicitante",
      activo: true,
    };
    await repo.create(user.uid, nuevo);
    return nuevo;
  }

  async function listUsers() {
    return repo.listAll();
  }

  return { getUserDoc, ensureSolicitanteDoc, listUsers };
}
