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
    <div className="border-b border-border/80 bg-surface/20 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-0 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            className={cn(
              "relative shrink-0 border-b-2 border-transparent px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.13em] transition-colors",
              value === c.key
                ? "border-primary text-primary"
                : "text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
