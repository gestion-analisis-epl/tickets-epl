"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CatalogoProvider } from "@/components/providers/catalogo-provider";
import { useAuthStore } from "@/stores/auth";
import { esRolSoloResumen } from "@/types/user";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.role);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
  }, [status, router]);

  // Comodidad de UI: la seguridad real son las reglas de Firestore.
  useEffect(() => {
    if (status === "signed-in" && esRolSoloResumen(role) && !pathname.startsWith("/pre-cierre")) router.replace("/pre-cierre");
  }, [status, role, pathname, router]);

  // Cierra el drawer movil al navegar (Link no dispara un unmount de este
  // layout, asi que sin esto se queda abierto al cambiar de pantalla).
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const redirigiendoJefe = status === "signed-in" && esRolSoloResumen(role) && !pathname.startsWith("/pre-cierre");

  if (status !== "signed-in" || redirigiendoJefe) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <CatalogoProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
          <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </CatalogoProvider>
  );
}
