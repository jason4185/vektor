import type { Instrument } from "@/lib/vektor/types";

const SCALE = 1_000_000_000_000n;
const PAIR_META: Record<Instrument, { currency: string; reciprocal: boolean; decimals: number }> = {
  "GBP/USD": { currency: "GBP", reciprocal: true, decimals: 5 },
  "USD/JPY": { currency: "JPY", reciprocal: false, decimals: 3 },
  "XAU/USD": { currency: "XAU", reciprocal: true, decimals: 2 },
  "XAG/USD": { currency: "XAG", reciprocal: true, decimals: 3 },
};

function expandExponent(value: string) {
  const match = value.trim().match(/^([+-]?)(\d+(?:\.\d+)?)(?:e([+-]?\d+))?$/i);
  if (!match) return null;
  const sign = (match[1] ?? "") === "-" ? "-" : "";
  const [whole = "", fraction = ""] = (match[2] ?? "").split(".");
  const exponent = Number(match[3] ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 18) return null;
  const digits = `${whole}${fraction}`;
  const decimalIndex = whole.length + exponent;
  if (decimalIndex <= 0) return `${sign}0.${"0".repeat(-decimalIndex)}${digits}`;
  if (decimalIndex >= digits.length)
    return `${sign}${digits}${"0".repeat(decimalIndex - digits.length)}`;
  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

export function decimalToScaled(value: unknown) {
  const expanded = expandExponent(String(value ?? ""));
  if (!expanded || expanded.startsWith("-")) return null;
  const [whole = "", fraction = ""] = expanded.split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) return null;
  const digits = `${whole}${fraction}`;
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(digits || "0");
  const scaled = (numerator * SCALE) / denominator;
  return scaled > 0n ? scaled : null;
}

export function normalizeRate(instrument: Instrument, providerValue: unknown) {
  const provider = decimalToScaled(providerValue);
  if (provider === null) return null;
  const meta = PAIR_META[instrument];
  const canonical = meta.reciprocal ? (SCALE * SCALE) / provider : provider;
  return canonical > 0n ? canonical : null;
}

export function scaledToNumber(value: bigint) {
  return Number(value) / Number(SCALE);
}

export function formatMarketDataPrice(instrument: Instrument, value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: PAIR_META[instrument].decimals,
    maximumFractionDigits: PAIR_META[instrument].decimals,
  });
}

export function marketDataDecimals(instrument: Instrument) {
  return PAIR_META[instrument].decimals;
}

export function providerCurrency(instrument: Instrument) {
  return PAIR_META[instrument].currency;
}
