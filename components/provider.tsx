"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/lib/domain";
import { useAlertNotifications } from "./use-alert-notifications";

interface AppState {
  data: Snapshot | null;
  loading: boolean;
  error: string;
  online: boolean;
  responder: boolean;
  demoLogin: boolean;
  authMode: "local" | "supabase";
  region: string;
  setRegion: (region: string) => void;
  refresh: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  lastSynced: string | null;
  notifications: ReturnType<typeof useAlertNotifications>;
}
const Context = createContext<AppState | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(true);
  const [responder, setResponder] = useState(false);
  const [demoLogin, setDemoLogin] = useState(false);
  const [authMode, setAuthMode] = useState<"local" | "supabase">("local");
  const [region, setRegion] = useState("All districts");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const notifications = useAlertNotifications(data, region);
  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const response = await fetch("/api/snapshot", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load the shared incident data.");
      const next: Snapshot = await response.json();
      if (sequence !== requestSequence.current) return;
      setData(next);
      setError("");
      setLastSynced(new Date().toISOString());
    } catch (error) {
      if (sequence === requestSequence.current)
        setError(error instanceof Error ? error.message : "Connection unavailable.");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);
  const refreshAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/auth", { cache: "no-store" });
      const auth = await response.json();
      setResponder(auth.responder === true);
      setDemoLogin(auth.demoLogin === true);
      setAuthMode(auth.authMode === "supabase" ? "supabase" : "local");
    } catch {
      setResponder(false);
    }
  }, []);
  useEffect(() => {
    const updateOnline = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) {
        void refresh();
        void refreshAuth();
      }
    };
    updateOnline();
    const interval = setInterval(() => {
      if (navigator.onLine) void refresh();
    }, 15000);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [refresh, refreshAuth]);
  return (
    <Context.Provider
      value={{
        data,
        loading,
        error,
        online,
        responder,
        demoLogin,
        authMode,
        region,
        setRegion,
        refresh,
        refreshAuth,
        lastSynced,
        notifications,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing AppProvider");
  return value;
}
