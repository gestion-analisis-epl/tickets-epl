import { Menu } from "lucide-react";
import { NotificationBell } from "./notification-bell";

interface TopbarProps {
  onOpenMobileNav: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  return (
    <header className="flex items-center justify-between h-14 px-4 sm:px-6 border-b border-border bg-card shrink-0">
      <button
        type="button"
        onClick={onOpenMobileNav}
        title="Abrir menu"
        className="flex md:hidden items-center justify-center h-9 w-9 rounded-lg text-foreground/60 hover:text-foreground hover:bg-surface transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1" />
      <NotificationBell />
    </header>
  );
}
