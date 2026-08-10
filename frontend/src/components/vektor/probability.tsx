import { cn } from "@/lib/utils";
import { bpsToPct } from "@/lib/vektor/format";

export function ProbabilityBar({
  upBps,
  downBps,
  className,
  showLabels = true,
}: {
  upBps: number;
  downBps: number;
  className?: string;
  showLabels?: boolean;
}) {
  const up = Math.min(100, Math.max(0, upBps / 100));
  const down = Math.min(100, Math.max(0, downBps / 100));
  const noPool = upBps === 0 && downBps === 0;
  return (
    <div className={cn("space-y-1.5", className)}>
      {showLabels && (
        <div className="flex items-baseline justify-between">
          <span className="num text-sm font-semibold text-up">
            {noPool ? "—" : bpsToPct(upBps)} UP
          </span>
          <span className="num text-sm font-semibold text-down">
            {noPool ? "—" : bpsToPct(downBps)} DOWN
          </span>
        </div>
      )}
      <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-l-full bg-up transition-[width] duration-500 ease-out"
          style={{ width: `${up}%` }}
        />
        <div
          className="h-full rounded-r-full bg-down/80 transition-[width] duration-500 ease-out"
          style={{ width: `${down}%` }}
        />
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "up" | "down" | "muted";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="label-xs truncate">{label}</div>
      <div
        className={cn(
          "num mt-1 truncate text-sm font-semibold",
          tone === "up" && "text-up",
          tone === "down" && "text-down",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
