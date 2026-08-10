import type { DisplayStatus, Market } from "@/lib/vektor/types";

export function LifecycleTimeline({ status }: { status: DisplayStatus }) {
  const current = status === "BETTING_OPEN" ? 0 : status === "OBSERVATION_ACTIVE" ? 1 : 2;
  const steps = ["Betting now", "Prediction day", "Settlement"];
  return (
    <div className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {steps.map((step, index) => (
        <div key={step} className="flex min-w-0 items-center gap-2">
          <span
            className={
              index === current ? "text-primary" : index < current ? "text-foreground" : ""
            }
          >
            {step}
          </span>
          {index < steps.length - 1 && <span className="text-border-strong">—</span>}
        </div>
      ))}
    </div>
  );
}
