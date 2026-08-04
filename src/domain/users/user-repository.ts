import type { UserDoc, UserRow } from "./user";

export interface UserRepository {
  getById(uid: string): Promise<UserDoc | null>;
  findByEmail(email: string): Promise<{ uid: string; data: UserDoc } | null>;
  create(uid: string, data: UserDoc): Promise<void>;
  delete(uid: string): Promise<void>;
  listAll(): Promise<UserRow[]>;
}
