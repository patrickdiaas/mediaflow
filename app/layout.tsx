import type { Metadata } from "next";
import "./globals.css";
import { DashboardProvider } from "@/lib/dashboard-context";

export const metadata: Metadata = {
  title: "MediaFlow – Dashboard de Performance",
  description: "Dashboard de mídia paga com Meta Ads e Google Ads",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-bg text-text-primary font-sans antialiased">
        <DashboardProvider>{children}</DashboardProvider>
      </body>
    </html>
  );
}
