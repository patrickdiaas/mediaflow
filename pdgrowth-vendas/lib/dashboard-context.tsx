"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import type { Platform } from "./types";

interface DashboardState {
  client: string;
  setClient: (v: string) => void;
  platform: Platform | "all";
  setPlatform: (v: Platform | "all") => void;
  period: string;
  setPeriod: (v: string) => void;
  campaign: string;
  setCampaign: (v: string) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (v: boolean) => void;
}

const DashboardContext = createContext<DashboardState | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [client,             setClient]             = useState("all");
  const [platform,           setPlatform]           = useState<Platform | "all">("all");
  const [period,             setPeriod]             = useState("last30");
  const [campaign,           setCampaign]           = useState("all");
  const [mobileSidebarOpen,  setMobileSidebarOpen]  = useState(false);

  return (
    <DashboardContext.Provider value={{
      client, setClient,
      platform, setPlatform,
      period, setPeriod,
      campaign, setCampaign,
      mobileSidebarOpen, setMobileSidebarOpen,
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
