import type { Position } from "./types";

export type ActivityKind =
  "prediction" | "live" | "ready" | "payout" | "refund" | "claimed" | "lost" | "won";
export type ActivityFilter = "all" | "needs" | "live" | "open" | "finished";

export interface ActivityItem {
  marketId: string;
  kind: ActivityKind;
  group: Exclude<ActivityFilter, "all">;
  title: string;
  instrument: Position["market"]["instrument"];
  side: "UP" | "DOWN";
  stake: number;
  claimable: number;
  targetDate: string;
  action: "view" | "settle" | "claim" | null;
}

const kindPriority: Record<ActivityKind, number> = {
  refund: 0,
  payout: 1,
  ready: 2,
  live: 3,
  prediction: 4,
  claimed: 5,
  won: 6,
  lost: 7,
};

function participated(position: Position) {
  return position.bet.stake > 0 && position.bet.side !== "NONE";
}

export function deriveActivityItem(position: Position): ActivityItem | null {
  if (!participated(position)) return null;
  const { market, bet, status, claimable } = position;
  const side = bet.side as "UP" | "DOWN";
  let kind: ActivityKind;
  if (status === "REFUND_AVAILABLE" && !bet.claimed) kind = "refund";
  else if (status === "WON" && !bet.claimed && claimable > 0) kind = "payout";
  else if (market.displayStatus === "READY_FOR_SETTLEMENT") kind = "ready";
  else if (market.displayStatus === "OBSERVATION_ACTIVE") kind = "live";
  else if (market.displayStatus === "BETTING_OPEN") kind = "prediction";
  else if (bet.claimed || status === "CLAIMED") kind = "claimed";
  else if (status === "LOST") kind = "lost";
  else if (status === "WON") kind = "won";
  else kind = "prediction";

  const group: ActivityItem["group"] =
    kind === "payout" || kind === "refund" || kind === "ready"
      ? "needs"
      : kind === "live"
        ? "live"
        : kind === "prediction"
          ? "open"
          : "finished";
  const title: Record<ActivityKind, string> = {
    prediction: "Prediction",
    live: "Target day live",
    ready: "Ready to settle",
    payout: "Payout available",
    refund: "Refund available",
    claimed: "Claimed",
    lost: "Lost",
    won: "Won",
  };
  return {
    marketId: market.id,
    kind,
    group,
    title: title[kind],
    instrument: market.instrument,
    side,
    stake: bet.stake,
    claimable,
    targetDate: market.targetDate,
    action: kind === "ready" ? "settle" : kind === "payout" || kind === "refund" ? "claim" : "view",
  };
}

export function activityPriority(item: ActivityItem) {
  return kindPriority[item.kind];
}

export function activityMatches(item: ActivityItem, filter: ActivityFilter) {
  return filter === "all" || item.group === filter;
}
