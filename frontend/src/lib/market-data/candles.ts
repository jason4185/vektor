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
