import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Semantica tipo Bootstrap: verde = aceptar/confirmar, rojo = cancelar/eliminar,
 * azul = accion neutra/primaria, ambar = advertencia/pendiente. Los 4 colores
 * solidos cumplen 10:1 de contraste con su texto (ver globals.css).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        success: "bg-success text-success-foreground hover:bg-success-hover",
        danger:  "bg-danger text-danger-foreground hover:bg-danger-hover",
        warning: "bg-warning text-warning-foreground hover:bg-warning-hover",
        outline: "border border-border bg-transparent text-foreground hover:bg-surface",
        ghost:   "bg-transparent text-foreground hover:bg-surface",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-4",
        lg: "h-10 px-5",
        icon: "h-9 w-9 shrink-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);
Button.displayName = "Button";
