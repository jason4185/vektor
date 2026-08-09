import type { Instrument } from "./types";
import { INSTRUMENTS } from "./mock-data";

export function instrumentMeta(symbol: Instrument) {
  return INSTRUMENTS.find((i) => i.symbol === symbol)!;
}

export function formatPrice(symbol: Instrument, value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return value.toFixed(instrumentMeta(symbol).decimals);
}

export function formatGen(value: number, digits = 2) {
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function bpsToPct(bps: number, digits = 1) {
  return `${(bps / 100).toFixed(digits)}%`;
}

export function formatDate(iso: string) {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  })} · ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

export function relativeTime(iso: string, now = new Date("2026-08-11T09:00:00Z")) {
  const diff = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Pari-mutuel projection: winners split the entire pool pro-rata.
 * Returns the gross payout for `stake` on `side` given current pools.
 */
export function projectPayout(
  upPool: number,
  downPool: number,
  side: "UP" | "DOWN",
  stake: number,
) {
  if (stake <= 0) return 0;
  const sidePool = (side === "UP" ? upPool : downPool) + stake;
  const total = upPool + downPool + stake;
  return (stake / sidePool) * total;
}

export function toIsoDate(d: Date) {
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
