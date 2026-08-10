import { useEffect, useState } from "react";
import type { Market } from "@/lib/vektor/types";
import { formatCountdown, presentationStatus } from "./timing";

export function useMarketTiming(market: Market | null) {
  const [now, setNow] = useState(() => Date.now());
  const target = market ? Date.parse(`${market.targetDate}T00:00:00Z`) : Number.NaN;
  const end = market ? Date.parse(market.targetEnd) : Number.NaN;

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 15_000);
    const boundaries = [target, end].filter(
      (value) => Number.isFinite(value) && value > Date.now(),
    );
    const next = boundaries.length > 0 ? Math.min(...boundaries) : null;
    const wake = next === null ? undefined : window.setTimeout(tick, next - Date.now() + 100);
    return () => {
      window.clearInterval(interval);
      if (wake !== undefined) window.clearTimeout(wake);
    };
  }, [end, target]);

  const status = market ? presentationStatus(market, now) : "BETTING_OPEN";
  const until = status === "BETTING_OPEN" ? target : status === "OBSERVATION_ACTIVE" ? end : null;
  return {
    now,
    status,
    bettingOpen: status === "BETTING_OPEN",
    until,
    countdown: until === null ? null : formatCountdown(until - now),
  };
}
