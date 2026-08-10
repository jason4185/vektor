import type { Candle, PriceSample } from "./types";

export function aggregateCandles(points: PriceSample[], bucketMinutes: number): Candle[] {
  const bucketMs = bucketMinutes * 60_000;
  const buckets = new Map<number, Candle>();
  for (const point of points) {
    const timestamp = Math.floor(point.timestamp / bucketMs) * bucketMs;
    const existing = buckets.get(timestamp);
    if (!existing) {
      buckets.set(timestamp, {
        timestamp,
        open: point.price,
        high: point.price,
        low: point.price,
        close: point.price,
      });
      continue;
    }
    existing.high = Math.max(existing.high, point.price);
    existing.low = Math.min(existing.low, point.price);
    existing.close = point.price;
  }
  return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export function bucketMinutesForRange(range: "1H" | "3H" | "6H" | "1D") {
  if (range === "1D") return 15;
  if (range === "6H") return 5;
  if (range === "3H") return 3;
  return 1;
}
