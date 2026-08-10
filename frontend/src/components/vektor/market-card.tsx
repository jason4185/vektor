import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Market } from "@/lib/vektor/types";
import { bpsToPct, formatDate, formatGen, formatPrice, instrumentMeta } from "@/lib/vektor/format";
import { OutcomeChip, StatusChip } from "./status-chip";
import { formatUtcDateOnly, statusLabel, timingCopy } from "@/lib/vektor/timing";
import { useMarketTiming } from "@/lib/vektor/use-market-timing";
import { ProbabilityBar } from "./probability";
import { LivePrice } from "./live-price";

export function MarketCard({ market }: { market: Market }) {
  const meta = instrumentMeta(market.instrument);
  const pool = market.upPool + market.downPool;
  const timing = useMarketTiming(market);

  return (
    <Link
      to="/market/$id"
      params={{ id: market.id }}
      className="group panel block p-4 transition-all duration-200 hover:border-border-strong hover:bg-surface-raised sm:p-5"
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num text-sm font-bold tracking-tight text-foreground">
              {market.instrument}
            </span>
            <span className="label-xs">{meta.klass === "fx" ? "FX" : "Metals"}</span>
            <StatusChip status={market.status} displayStatus={timing.status} />
            {market.outcome !== "NONE" && <OutcomeChip outcome={market.outcome} />}
          </div>

          <h3 className="mt-2 line-clamp-2 text-[0.95rem] font-medium leading-snug text-foreground/95 transition-colors group-hover:text-foreground">
            {market.question}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{timingCopy(timing.status, timing.countdown)}</span>
            {timing.status === "BETTING_OPEN" && (
              <span>
                Prediction day starts{" "}
                {formatUtcDateOnly(Date.parse(`${market.targetDate}T00:00:00Z`))} · 00:00 UTC
              </span>
            )}
          </div>
          <div className="mt-3 sm:hidden">
            <LivePrice instrument={market.instrument} />
          </div>
        </div>
        <div className="hidden shrink-0 sm:block">
          <LivePrice instrument={market.instrument} />
        </div>
      </div>

      <div className="mt-4">
        <ProbabilityBar upBps={market.upBps} downBps={market.downBps} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
        <Cell label="Total pool" value={`${formatGen(pool)} GEN`} />
        <Cell label="Previous trading day" value={formatDate(market.referenceDate)} />
        <Cell label="Prediction day" value={formatDate(market.targetDate)} />
        <Cell label="Status" value={statusLabel(market.status, timing.status)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SideAffordance side="UP" bps={market.upBps} disabled={!timing.bettingOpen} />
        <SideAffordance side="DOWN" bps={market.downBps} disabled={!timing.bettingOpen} />
      </div>
    </Link>
  );
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="label-xs truncate">{label}</div>
      <div className="num mt-0.5 truncate text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function SideAffordance({
  side,
  bps,
  disabled,
}: {
  side: "UP" | "DOWN";
  bps: number;
  disabled: boolean;
}) {
  const Icon = side === "UP" ? ArrowUpRight : ArrowDownRight;
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
        side === "UP"
          ? "border-up/25 bg-up/[0.07] text-up group-hover:border-up/50 group-hover:bg-up/[0.12]"
          : "border-down/25 bg-down/[0.07] text-down group-hover:border-down/50 group-hover:bg-down/[0.12]",
        disabled && "opacity-50",
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon className="h-4 w-4" />
        {side}
      </span>
      <span className="num">{bps === 0 ? "—" : bpsToPct(bps, 0)}</span>
    </div>
  );
}
