import type { DisplayStatus, Market, MarketStatus } from "@/lib/vektor/types";

export function presentationStatus(market: Market, now: number): DisplayStatus {
  if (market.status === "CLOSED") {
    return market.displayStatus === "INCONCLUSIVE" ? "INCONCLUSIVE" : "SETTLED";
  }
  const target = Date.parse(`${market.targetDate}T00:00:00Z`);
  const end = Date.parse(market.targetEnd);
  if (Number.isFinite(target) && now < target) return "BETTING_OPEN";
  if (Number.isFinite(end) && now < end) return "OBSERVATION_ACTIVE";
  return "READY_FOR_SETTLEMENT";
}

export function formatCountdown(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  if (totalMinutes < 1) return "less than 1m";
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function timingCopy(status: DisplayStatus, countdown: string | null) {
  if (status === "BETTING_OPEN")
    return countdown ? `Betting closes in ${countdown}` : "Betting open";
  if (status === "OBSERVATION_ACTIVE")
    return countdown ? `Prediction day ends in ${countdown}` : "Prediction day live";
  if (status === "READY_FOR_SETTLEMENT") return "Prediction day ended";
  return null;
}

export function formatUtcDateOnly(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function statusLabel(status: MarketStatus, displayStatus?: DisplayStatus) {
  return displayStatus === "OBSERVATION_ACTIVE"
    ? "Prediction day live"
    : displayStatus === "READY_FOR_SETTLEMENT"
      ? "Ready to settle"
      : displayStatus === "INCONCLUSIVE"
        ? "Refund"
        : displayStatus === "SETTLED" || status === "CLOSED"
          ? "Settled"
          : "Betting open";
}
