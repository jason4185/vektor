import type { Instrument, InstrumentMeta } from "./types";
import { formatUnits } from "viem";

const META: Record<
  Instrument,
  { decimals: number; name: string; klass: "fx" | "metals"; blurb: string }
> = {
  "GBP/USD": {
    decimals: 6,
    name: "Sterling / Dollar",
    klass: "fx",
    blurb: "A daily GBP/USD market.",
  },
  "USD/JPY": {
    decimals: 3,
    name: "Dollar / Yen",
    klass: "fx",
    blurb: "A daily USD/JPY market.",
  },
  "XAU/USD": {
    decimals: 6,
    name: "Gold / Dollar",
    klass: "metals",
    blurb: "A daily gold market.",
  },
  "XAG/USD": {
    decimals: 6,
    name: "Silver / Dollar",
    klass: "metals",
    blurb: "A daily silver market.",
  },
};
export function instrumentMeta(symbol: Instrument, supported?: InstrumentMeta[]) {
  const found = supported?.find((m) => m.instrument === symbol);
  return {
    ...META[symbol],
    ...(found ?? {}),
    klass:
      found?.category === "METAL" ? "metals" : found?.category === "FX" ? "fx" : META[symbol].klass,
  };
}
export function formatPrice(symbol: Instrument, value: number | null | undefined) {
  return value == null ? "—" : value.toFixed(META[symbol].decimals);
}
export function formatGen(value: number, digits = 2) {
  return `${value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
export function bpsToPct(bps: number, digits = 1) {
  return `${(bps / 100).toFixed(digits)}%`;
}
export function formatDate(iso: string) {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
}
export function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
}
export function formatGenUnits(value: bigint, digits = 2) {
  return formatFixedUnits(value, 18, digits);
}
export function formatMultipleUnits(value: bigint, digits = 2) {
  return formatFixedUnits(value, 2, digits);
}
function formatFixedUnits(value: bigint, decimals: number, digits: number) {
  const raw = formatUnits(value, decimals);
  const parts = raw.split(".");
  const integer = parts[0] ?? "0";
  const fraction = parts[1] ?? "";
  const rounded = `${fraction}${"0".repeat(digits)}`.slice(0, digits);
  return `${BigInt(integer).toLocaleString("en-US")}.${rounded}`;
}
export function relativeTime(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Math.abs(mins) < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
export function toIsoDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
