import type { Instrument } from "@/lib/vektor/types";
import { normalizeRate, providerCurrency, scaledToNumber } from "./normalize";
import type { LivePrices, PriceSample, TargetDaySeries } from "./types";

const API_BASE = "https://api.fxratesapi.com";
const CURRENCIES = ["GBP", "JPY", "XAU", "XAG"] as const;

type JsonObject = Record<string, unknown>;

async function getJson(url: URL, signal?: AbortSignal): Promise<JsonObject> {
  const response = await fetch(url, {
    signal: signal ?? null,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Forex data request failed (${response.status}).`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Forex data returned an invalid response.");
  }
  return body as JsonObject;
}

function isoTimestamp(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function requireRates(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Forex data returned an invalid rate map.");
  }
  return value as JsonObject;
}

function assertBaseAndSuccess(data: JsonObject) {
  if (data["success"] !== true || data["base"] !== "USD") {
    throw new Error("Forex data could not be verified.");
  }
}

export async function fetchLivePrices(signal?: AbortSignal): Promise<LivePrices> {
  const url = new URL(`${API_BASE}/latest`);
  url.searchParams.set("base", "USD");
  url.searchParams.set("currencies", CURRENCIES.join(","));
  url.searchParams.set("resolution", "1m");
  url.searchParams.set("places", "12");
  url.searchParams.set("format", "json");
  const data = await getJson(url, signal);
  assertBaseAndSuccess(data);
  const rates = requireRates(data["rates"]);
  const updatedAt = isoTimestamp(data["date"]) ?? new Date().toISOString();
  const result: LivePrices = {};
  for (const instrument of ["GBP/USD", "USD/JPY", "XAU/USD", "XAG/USD"] as Instrument[]) {
    const scaled = normalizeRate(instrument, rates[providerCurrency(instrument)]);
    if (scaled !== null) {
      result[instrument] = { price: scaledToNumber(scaled), raw: scaled.toString(), updatedAt };
    }
  }
  if (Object.keys(result).length === 0)
    throw new Error("Forex data did not include Vektor markets.");
  return result;
}

function apiDate(date: Date) {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

const HISTORY_CONCURRENCY = 4;
const CHUNK_MS = 5 * 60 * 60_000;
const RECENT_CACHE_MS = 60_000;
const chunkCache = new Map<string, { fetchedAt: number; points: PriceSample[] }>();
const inFlightChunks = new Map<string, Promise<PriceSample[]>>();

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function fetchPriceChunk(
  instrument: Instrument,
  from: number,
  to: number,
  signal?: AbortSignal,
): Promise<PriceSample[]> {
  const key = `${instrument}:${from}:${to}`;
  const now = Date.now();
  const cached = chunkCache.get(key);
  const isRecent = to > now - CHUNK_MS;
  if (cached && (!isRecent || now - cached.fetchedAt < RECENT_CACHE_MS)) return cached.points;
  const existing = inFlightChunks.get(key);
  if (existing) return existing;
  const request = (async () => {
    const url = new URL(`${API_BASE}/timeseries`);
    url.searchParams.set("start_date", apiDate(new Date(from)));
    url.searchParams.set("end_date", apiDate(new Date(to)));
    url.searchParams.set("base", "USD");
    url.searchParams.set("currencies", providerCurrency(instrument));
    url.searchParams.set("accuracy", "1m");
    url.searchParams.set("places", "12");
    url.searchParams.set("format", "json");
    const data = await getJson(url, signal);
    assertBaseAndSuccess(data);
    const rates = requireRates(data["rates"]);
    const points: PriceSample[] = [];
    for (const [timestamp, rawRates] of Object.entries(rates)) {
      const time = new Date(timestamp).getTime();
      if (!Number.isFinite(time) || time < from || time >= to) continue;
      const nested = requireRates(rawRates);
      const scaled = normalizeRate(instrument, nested[providerCurrency(instrument)]);
      if (scaled !== null)
        points.push({ timestamp: time, price: scaledToNumber(scaled), raw: scaled.toString() });
    }
    points.sort((a, b) => a.timestamp - b.timestamp);
    chunkCache.set(key, { fetchedAt: Date.now(), points });
    return points;
  })();
  inFlightChunks.set(key, request);
  try {
    return await request;
  } finally {
    inFlightChunks.delete(key);
  }
}

export async function fetchTargetDaySeries(
  instrument: Instrument,
  target: Date,
  targetEnd: Date,
  signal?: AbortSignal,
): Promise<TargetDaySeries> {
  const end = new Date(Math.min(Date.now(), targetEnd.getTime()));
  const points = await fetchPriceSeries(instrument, target, end, signal);
  return {
    instrument,
    targetDate: target.toISOString().slice(0, 10),
    points,
    dayStart: points[0] ?? null,
    dayEnd: points.at(-1) ?? null,
  };
}

export async function fetchReferencePrice(
  instrument: Instrument,
  referenceDate: string,
  signal?: AbortSignal,
): Promise<PriceSample | null> {
  const start = new Date(`${referenceDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  const points = await fetchPriceSeries(instrument, start, end, signal);
  return points.filter((point) => point.timestamp < end.getTime()).at(-1) ?? null;
}

export async function fetchPriceSeries(
  instrument: Instrument,
  start: Date,
  end: Date,
  signal?: AbortSignal,
): Promise<PriceSample[]> {
  if (end.getTime() <= start.getTime()) return [];
  // FXRatesAPI permits at most roughly six hours for 1-minute accuracy.
  // Keep each request comfortably inside that limit, then merge by timestamp.
  const chunks: Array<[number, number]> = [];
  for (let cursor = start.getTime(); cursor < end.getTime(); cursor += CHUNK_MS) {
    chunks.push([cursor, Math.min(cursor + CHUNK_MS, end.getTime())]);
  }
  const responses = await mapWithConcurrency(chunks, HISTORY_CONCURRENCY, ([from, to]) =>
    fetchPriceChunk(instrument, from, to, signal),
  );
  const byTimestamp = new Map<number, PriceSample>();
  for (const points of responses) {
    for (const point of points) byTimestamp.set(point.timestamp, point);
  }
  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
}
