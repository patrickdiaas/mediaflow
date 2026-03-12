"use client";
import React, { createContext, useContext, useState } from "react";
import type { Mode, Platform } from "./mock-data";
import { clients, periods } from "./mock-data";

interface DashboardContextType {
  mode: Mode;
  setMode: (m: Mode) => void;
  platform: Platform;
  setPlatform: (p: Platform) => void;
  client: string;
  setClient: (c: string) => void;
  campaign: string;
  setCampaign: (c: string) => void;
  product: string;
  setProduct: (p: string) => void;
  period: string;
  setPeriod: (p: string) => void;
}

const DashboardContext = createContext<DashboardContextType>({} as DashboardContextType);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("lead-gen");
  const [platform, setPlatform] = useState<Platform>("meta");
  const [client, setClient] = useState(clients[0]);
  const [campaign, setCampaign] = useState("Todas");
  const [product, setProduct] = useState("Todos");
  const [period, setPeriod] = useState(periods[2]);

  return (
    <DashboardContext.Provider value={{
      mode, setMode,
      platform, setPlatform,
      client, setClient,
      campaign, setCampaign,
      product, setProduct,
      period, setPeriod,
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export const useDashboard = () => useContext(DashboardContext);
