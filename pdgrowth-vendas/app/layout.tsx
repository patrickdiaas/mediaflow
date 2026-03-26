import type { Metadata } from "next";
import "./globals.css";
import { DashboardProvider } from "@/lib/dashboard-context";

export const metadata: Metadata = {
  title: "PD Growth — Vendas",
  description: "Dashboard de performance de vendas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <DashboardProvider>
          {children}
        </DashboardProvider>
      </body>
    </html>
  );
}
