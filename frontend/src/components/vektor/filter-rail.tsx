import { Link } from "@tanstack/react-router";
import { Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Instrument } from "@/lib/vektor/types";
import { useQuery } from "@tanstack/react-query";
import { supportedMarketsQuery } from "@/lib/vektor/queries";

export type SortKey = "volume" | "newest" | "closing";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "volume", label: "Largest pool" },
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
  const { data: instruments = [] } = useQuery(supportedMarketsQuery());
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
          {instruments.map((i) => (
            <label
              key={i.instrument}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-raised"
            >
              <Checkbox
                checked={selected.includes(i.instrument)}
                onCheckedChange={() => onToggle(i.instrument)}
              />
              <span className="min-w-0 flex-1">
                <span className="num block text-sm font-semibold text-foreground">
                  {i.instrument}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {i.category === "METAL" ? "Metals" : "FX"}
                </span>
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

      <div className="panel overflow-hidden">
        <div className="hairline-grid p-4">
          <Zap className="h-4 w-4 text-primary" />
          <h4 className="mt-2 text-sm font-semibold text-foreground">Create a market</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Choose an instrument and prediction day. Vektor uses the previous trading day for
            comparison.
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
