import { cn } from "@/lib/utils";
import type { MarketStatus, Outcome, PositionStatus } from "@/lib/vektor/types";

const base =
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]";

const statusStyles: Record<MarketStatus, string> = {
  OPEN: "border-border-strong bg-surface-raised text-muted-foreground",
  CLOSED: "border-border bg-muted text-muted-foreground",
};

export function StatusChip({ status, className }: { status: MarketStatus; className?: string }) {
  return (
    <span className={cn(base, statusStyles[status], className)}>
      {status === "OPEN" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
      )}
      {status}
    </span>
  );
}

const outcomeStyles: Record<Outcome, string> = {
  UP: "border-up/40 bg-up/10 text-up",
  DOWN: "border-down/40 bg-down/10 text-down",
  INCONCLUSIVE: "border-border-strong bg-surface-raised text-muted-foreground",
};

export function OutcomeChip({ outcome, className }: { outcome: Outcome; className?: string }) {
  return <span className={cn(base, outcomeStyles[outcome], className)}>{outcome}</span>;
}

const positionStyles: Record<PositionStatus, string> = {
  ACTIVE: "border-primary/40 bg-primary/10 text-primary",
  WON: "border-up/40 bg-up/10 text-up",
  LOST: "border-down/35 bg-down/10 text-down",
  REFUND_AVAILABLE: "border-warn/40 bg-warn/10 text-warn",
  CLAIMED: "border-border bg-muted text-muted-foreground",
};

const positionLabels: Record<PositionStatus, string> = {
  ACTIVE: "Active",
  WON: "Won",
  LOST: "Lost",
  REFUND_AVAILABLE: "Refund available",
  CLAIMED: "Claimed",
};

export function PositionChip({
  status,
  className,
}: {
  status: PositionStatus;
  className?: string;
}) {
  return (
    <span className={cn(base, positionStyles[status], className)}>{positionLabels[status]}</span>
  );
}

export function SideChip({ side, className }: { side: "UP" | "DOWN"; className?: string }) {
  return (
    <span
      className={cn(
        base,
        side === "UP" ? "border-up/40 bg-up/10 text-up" : "border-down/40 bg-down/10 text-down",
        className,
      )}
    >
      {side}
    </span>
  );
}
