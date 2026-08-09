import { cn } from "@/lib/utils";

export type CategoryKey = "all" | "fx" | "metals" | "live" | "settling" | "resolved";

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "fx", label: "FX" },
  { key: "metals", label: "Metals" },
  { key: "live", label: "Live" },
  { key: "settling", label: "Settling" },
  { key: "resolved", label: "Resolved" },
];

export function CategoryNav({
  value,
  onChange,
}: {
  value: CategoryKey;
  onChange: (key: CategoryKey) => void;
}) {
  return (
    <div className="border-b border-border bg-background/70 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            className={cn(
              "relative shrink-0 rounded-lg px-3 py-1.5 text-[0.8125rem] font-semibold uppercase tracking-[0.06em] transition-colors",
              value === c.key
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
