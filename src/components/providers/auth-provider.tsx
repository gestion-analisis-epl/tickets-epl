"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserDoc } from "@/lib/users";
import { useAuthStore } from "@/stores/auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, clearUser } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        clearUser();
        return;
      }
      const userDoc = await getUserDoc(firebaseUser.uid);
      setUser({
        uid: firebaseUser.uid,
        nombre: userDoc?.nombre ?? firebaseUser.displayName ?? "Sin nombre",
        email: firebaseUser.email ?? "",
        role: userDoc?.role ?? "solicitante",
      });
    });
    return unsubscribe;
  }, [setUser, clearUser]);

  return <>{children}</>;
}
