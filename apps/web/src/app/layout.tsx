import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./admin-control-center.css";

export const metadata: Metadata = {
  title: "TMS — Gestão de Fretes",
  description: "Plataforma de gestão e operação de fretes.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
