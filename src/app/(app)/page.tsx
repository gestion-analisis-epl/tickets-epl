"use client";

import Link from "next/link";
import { ClipboardList, PlusCircle, BarChart2, BookOpen } from "lucide-react";
import { useAuthStore } from "@/stores/auth";

const ACCIONES = [
  { label: "Nuevo ticket", desc: "Levanta una solicitud para el area Legal.", href: "/tickets/nuevo", icon: PlusCircle },
  { label: "Ver tickets", desc: "Consulta el estatus de las solicitudes.", href: "/tickets", icon: ClipboardList },
  { label: "Dashboard", desc: "KPIs de estatus, SLA y satisfaccion.", href: "/dashboard", icon: BarChart2 },
  { label: "Catalogo de servicios", desc: "Los 70 servicios estandarizados.", href: "/catalogo", icon: BookOpen, roles: ["mesa_control", "abogado", "gerente_juridico", "admin"] },
];

export default function InicioPage() {
  const { nombre, role } = useAuthStore();
  const accesibles = ACCIONES.filter((a) => !a.roles || a.roles.includes(role));

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hola, {nombre?.split(" ")[0] ?? "bienvenido"}</h1>
        <p className="text-sm mt-1 opacity-70">Sistema de tickets del area Legal de EPL.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {accesibles.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-lg border border-border bg-card p-5 hover:border-primary/40 hover:bg-surface transition-colors"
            >
              <Icon className="h-5 w-5 text-primary" />
              <p className="text-sm font-semibold mt-3">{a.label}</p>
              <p className="text-xs opacity-60 mt-1">{a.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
