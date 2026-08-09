import { Link } from "@tanstack/react-router";
import { Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { INSTRUMENTS, PROTOCOL_CONFIG } from "@/lib/vektor/mock-data";
import type { Instrument } from "@/lib/vektor/types";

export type SortKey = "volume" | "newest" | "closing" | "activity";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "volume", label: "Largest pool" },
  { key: "activity", label: "Most traders" },
  { key: "closing", label: "Closing soonest" },
  { key: "newest", label: "Newest" },
];

export function FilterRail({
  selected,
  onToggle,
  sort,
  onSort,
  onReset,
  className,
}: {
  selected: Instrument[];
  onToggle: (symbol: Instrument) => void;
  sort: SortKey;
  onSort: (key: SortKey) => void;
  onReset: () => void;
  className?: string;
}) {
  return (
    <aside className={cn("space-y-4", className)}>
      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <span className="label-xs">Instruments</span>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-primary hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="mt-3 space-y-1">
          {INSTRUMENTS.map((i) => (
            <label
              key={i.symbol}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-raised"
            >
              <Checkbox
                checked={selected.includes(i.symbol)}
                onCheckedChange={() => onToggle(i.symbol)}
              />
              <span className="min-w-0 flex-1">
                <span className="num block text-sm font-semibold text-foreground">{i.symbol}</span>
                <span className="block truncate text-xs text-muted-foreground">{i.name}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="panel p-4">
        <span className="label-xs">Sort</span>
        <div className="mt-3 space-y-1">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onSort(s.key)}
              className={cn(
                "w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                sort === s.key
                  ? "bg-primary/12 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-surface-raised hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel p-4">
        <span className="label-xs">Protocol limits</span>
        <dl className="mt-3 space-y-2.5 text-sm">
          <Row label="Min stake" value={`${PROTOCOL_CONFIG.minStake} GEN`} />
          <Row label="Max per wallet" value={`${PROTOCOL_CONFIG.maxStakePerWallet} GEN`} />
          <Row label="Protocol fee" value={`${PROTOCOL_CONFIG.protocolFeeBps / 100}%`} />
          <Separator className="bg-border" />
          <Row label="Chain" value={PROTOCOL_CONFIG.chain} />
        </dl>
      </div>

      <div className="panel overflow-hidden">
        <div className="hairline-grid p-4">
          <Zap className="h-4 w-4 text-primary" />
          <h4 className="mt-2 text-sm font-semibold text-foreground">Open your own line</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Any wallet can list a daily directional market. Pick an instrument and a session date —
            the contract derives the reference close.
          </p>
          <Button asChild size="sm" className="mt-3 w-full gap-1.5">
            <Link to="/create">
              <Plus className="h-4 w-4" /> Create market
            </Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="num text-xs font-semibold text-foreground">{value}</dd>
    </div>
  );
}
