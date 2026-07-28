"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, ClipboardList, PlusCircle, BookOpen, BarChart2,
  Settings, LogOut, ChevronLeft, ChevronRight, Sun, Moon, Scale,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAuthStore, type Role } from "@/stores/auth";
import { signOutUser } from "@/lib/auth-actions";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
  roles?: Role[]; // undefined = visible para todos los roles
}

const NAV_ITEMS: NavItem[] = [
  { label: "Inicio",              href: "/",              icon: Home,          exact: true },
  { label: "Dashboard",           href: "/dashboard",      icon: BarChart2 },
  { label: "Tickets",             href: "/tickets",        icon: ClipboardList },
  { label: "Nuevo ticket",        href: "/tickets/nuevo",  icon: PlusCircle },
  { label: "Catalogo de servicios", href: "/catalogo",     icon: BookOpen,     roles: ["mesa_control", "abogado", "gerente_juridico", "admin"] },
];

/*
 * "Tickets" (/tickets) y "Nuevo ticket" (/tickets/nuevo) comparten prefijo, asi
 * que hay que elegir solo UNA coincidencia por pathname (la mas especifica),
 * si no ambas quedan iluminadas a la vez en /tickets/nuevo.
 */
function pickActiveHref(pathname: string, candidates: { href: string; exact?: boolean }[]): string | null {
  let best: string | null = null;
  for (const { href, exact } of candidates) {
    const matches = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { role, nombre } = useAuthStore();

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  const toggle = () =>
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  const activeHref = pickActiveHref(pathname, [
    ...visibleItems.map(({ href, exact }) => ({ href, exact })),
    { href: "/configuracion" },
  ]);

  return (
    <aside
      className={cn(
        "relative flex flex-col min-h-screen shrink-0 bg-sidebar text-sidebar-foreground",
        "transition-[width] duration-200 ease-in-out overflow-hidden",
        collapsed ? "w-[56px]" : "w-64"
      )}
    >
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border">
        {collapsed ? (
          <div className="flex w-full items-center justify-between px-3">
            <Scale className="h-5 w-5 text-primary-hover shrink-0" />
            <button onClick={toggle} title="Expandir"
              className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-sidebar-hover transition-colors"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex w-full items-center gap-2 px-4">
            <Scale className="h-5 w-5 text-primary-hover shrink-0" />
            <span className="text-[15px] font-semibold tracking-tight">Legal EPL</span>
            <button onClick={toggle} title="Colapsar"
              className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-sidebar-hover transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 py-3 space-y-0.5 overflow-y-auto transition-[padding] duration-200", collapsed ? "px-1.5" : "px-2.5")}>
        {visibleItems.map((item) => {
          const active = item.href === activeHref;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center rounded-lg text-[13px] font-medium transition-colors duration-100",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                active ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-hover"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className={cn("space-y-0.5 border-t border-sidebar-border py-3 transition-[padding] duration-200", collapsed ? "px-1.5" : "px-2.5")}>
        {role === "admin" && (
          <Link
            href="/configuracion"
            title="Configuracion"
            className={cn(
              "flex items-center rounded-lg text-[13px] font-medium hover:bg-sidebar-hover transition-colors duration-100",
              collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
              activeHref === "/configuracion" && "bg-sidebar-hover"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Configuracion</span>}
          </Link>
        )}

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={mounted && theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className={cn(
            "w-full flex items-center rounded-lg text-[13px] font-medium hover:bg-sidebar-hover transition-colors duration-100",
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
          )}
        >
          {mounted && theme === "dark"
            ? <Sun className="h-4 w-4 shrink-0" />
            : <Moon className="h-4 w-4 shrink-0" />}
          {!collapsed && <span>{mounted && theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>}
        </button>

        {!collapsed && (
          <div className="px-3 py-1.5 text-[11px] opacity-80 truncate">{nombre}</div>
        )}

        <button
          onClick={() => signOutUser()}
          title="Cerrar sesion"
          className={cn(
            "w-full flex items-center rounded-lg text-[13px] font-medium hover:bg-danger/20 hover:text-danger-hover transition-colors duration-100",
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Cerrar sesion</span>}
        </button>
      </div>
    </aside>
  );
}
