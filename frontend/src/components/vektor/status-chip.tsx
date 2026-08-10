import { cn } from "@/lib/utils";
import type { DisplayStatus, MarketStatus, Outcome, UserResult } from "@/lib/vektor/types";
import { statusLabel } from "@/lib/vektor/timing";

const base =
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]";

const statusStyles: Record<MarketStatus, string> = {
  OPEN: "border-border-strong bg-surface-raised text-muted-foreground",
  CLOSED: "border-border bg-muted text-muted-foreground",
};

export function StatusChip({
  status,
  displayStatus,
  className,
}: {
  status: MarketStatus;
  displayStatus?: DisplayStatus;
  className?: string;
}) {
  const label = statusLabel(status, displayStatus);
  return (
    <span className={cn(base, statusStyles[status], className)}>
      {status === "OPEN" &&
        (displayStatus === "BETTING_OPEN" || displayStatus === "OBSERVATION_ACTIVE") && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
        )}
      {label}
    </span>
  );
}

const outcomeStyles: Record<Outcome, string> = {
  NONE: "border-border bg-muted text-muted-foreground",
  UP: "border-up/40 bg-up/10 text-up",
  DOWN: "border-down/40 bg-down/10 text-down",
  INCONCLUSIVE: "border-border-strong bg-surface-raised text-muted-foreground",
};

export function OutcomeChip({ outcome, className }: { outcome: Outcome; className?: string }) {
  return (
    <span className={cn(base, outcomeStyles[outcome], className)}>
      {outcome === "INCONCLUSIVE" ? "Refund" : outcome}
    </span>
  );
}

const positionStyles: Record<UserResult, string> = {
  NOT_PARTICIPATED: "border-border bg-muted text-muted-foreground",
  PENDING: "border-primary/40 bg-primary/10 text-primary",
  WON: "border-up/40 bg-up/10 text-up",
  LOST: "border-down/35 bg-down/10 text-down",
  REFUND_AVAILABLE: "border-warn/40 bg-warn/10 text-warn",
  CLAIMED: "border-border bg-muted text-muted-foreground",
};

const positionLabels: Record<UserResult, string> = {
  NOT_PARTICIPATED: "Not participated",
  PENDING: "Pending",
  WON: "Won",
  LOST: "Lost",
  REFUND_AVAILABLE: "Refund available",
  CLAIMED: "Claimed",
};

export function PositionChip({ status, className }: { status: UserResult; className?: string }) {
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
