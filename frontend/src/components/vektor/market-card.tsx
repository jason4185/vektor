import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Market } from "@/lib/vektor/types";
import { bpsToPct, formatDate, formatGen, formatPrice, instrumentMeta } from "@/lib/vektor/format";
import { OutcomeChip, StatusChip } from "./status-chip";
import { ProbabilityBar } from "./probability";
import { Sparkline } from "./sparkline";

export function MarketCard({ market }: { market: Market }) {
  const meta = instrumentMeta(market.instrument);
  const pool = market.upPool + market.downPool;
  const closed = market.status === "CLOSED";

  return (
    <Link
      to="/market/$id"
      params={{ id: market.id }}
      className="group panel block p-4 transition-all duration-200 hover:border-border-strong hover:bg-surface-raised"
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num text-sm font-bold tracking-tight text-foreground">
              {market.instrument}
            </span>
            <span className="label-xs">{meta.klass === "fx" ? "FX" : "Metals"}</span>
            <StatusChip status={market.status} />
            {market.outcome && <OutcomeChip outcome={market.outcome} />}
          </div>

          <h3 className="mt-2 line-clamp-2 text-[0.95rem] font-medium leading-snug text-foreground/95 transition-colors group-hover:text-foreground">
            {market.question}
          </h3>
        </div>

        <div className="hidden w-28 shrink-0 sm:block">
          <Sparkline
            data={market.series}
            tone={market.lastPrice >= (market.referencePrice ?? 0) ? "up" : "down"}
          />
        </div>
      </div>

      <div className="mt-4">
        <ProbabilityBar upBps={market.upBps} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
        <Cell label="Pool" value={`${formatGen(pool)} GEN`} />
        <Cell label="Reference" value={formatPrice(market.instrument, market.referencePrice)} />
        <Cell label="Target date" value={formatDate(market.targetDate)} />
        <Cell
          label="Traders"
          value={
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {market.bettors}
            </span>
          }
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SideAffordance side="UP" bps={market.upBps} disabled={closed} />
        <SideAffordance side="DOWN" bps={10000 - market.upBps} disabled={closed} />
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
      <span className="num">{bpsToPct(bps, 0)}</span>
    </div>
  );
}
