import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DEMO_WALLET } from "./mock-data";

/**
 * Wallet layer — intentionally a UI-only preview stub.
 * When a GenLayer wallet SDK is added, replace `connect`/`disconnect`
 * with the real provider calls; the rest of the app reads this context only.
 */

interface WalletState {
  address: string | null;
  balance: number;
  status: "disconnected" | "connecting" | "connected";
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletState["status"]>("disconnected");
  const [address, setAddress] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");
    await new Promise((r) => setTimeout(r, 700));
    setAddress(DEMO_WALLET);
    setStatus("connected");
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setStatus("disconnected");
  }, []);

  const value = useMemo<WalletState>(
    () => ({ address, balance: 128.4, status, connect, disconnect }),
    [address, status, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
