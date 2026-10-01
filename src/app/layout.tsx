import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import "./globals.css";

const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "500", "600", "700"] });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", axes: ["opsz"] });

export const metadata: Metadata = {
  title: "Tickets Legal EPL",
  description: "Sistema de tickets para el area juridica de EPL",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${sans.variable} ${display.variable} font-sans`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
