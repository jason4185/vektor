import { Check, Circle, Loader2, TriangleAlert, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TxState } from "@/lib/vektor/types";

const steps = [
  ["preparing", "Preparing"],
  ["wallet_confirmation", "Awaiting wallet"],
  ["submitted", "Submitted"],
  ["processing", "Processing"],
  ["completed", "Completed"],
] as const;

export function TransactionModal({
  open,
  title,
  description,
  state,
  successMessage,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  state: TxState;
  successMessage: string | undefined;
  onClose: () => void;
}) {
  const failed =
    state.phase === "failed" || state.phase === "cancelled" || state.phase === "uncertain";
  const terminal = state.phase === "completed" || failed;
  const success = state.phase === "completed";
  const currentIndex = steps.findIndex(([phase]) => phase === state.phase);
  const displayMessage =
    state.phase === "cancelled"
      ? "Transaction cancelled. You cancelled the request in your wallet."
      : state.phase === "uncertain"
        ? "Still confirming. Your transaction was submitted, but Vektor has not confirmed the accepted state yet."
        : state.message;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md border-border bg-surface p-0 shadow-2xl shadow-black/40">
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              {failed ? (
                <TriangleAlert className="h-5 w-5" />
              ) : (
                <span className="num text-sm font-bold">V</span>
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base text-foreground">{title}</DialogTitle>
              <DialogDescription className="mt-1.5 text-xs leading-relaxed">
                {failed ? displayMessage : description}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="space-y-2 px-6 py-5">
          {steps.map(([phase, label], index) => {
            const complete = success || (!failed && currentIndex > index);
            const active = !failed && !success && state.phase === phase;
            return (
              <div
                key={phase}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${active ? "border-primary/45 bg-primary/[0.08]" : complete ? "border-up/25 bg-up/[0.05]" : "border-border bg-background/50"}`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${active ? "border-primary bg-primary/15 text-primary" : complete ? "border-up/40 bg-up/10 text-up" : "border-border-strong text-muted-foreground/60"}`}
                >
                  {complete ? (
                    <Check className="h-4 w-4" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                </span>
                <span
                  className={`text-sm font-medium ${active || complete ? "text-foreground" : "text-muted-foreground/60"}`}
                >
                  {label}
                </span>
              </div>
            );
          })}
          {state.hash && (
            <div className="num pt-2 text-[11px] text-muted-foreground">
              Transaction {state.hash.slice(0, 10)}…{state.hash.slice(-6)}
            </div>
          )}
          {state.phase === "completed" && successMessage && (
            <p className="rounded-lg border border-up/25 bg-up/10 px-3 py-2 text-xs text-up">
              {successMessage}
            </p>
          )}
        </div>

        {terminal && (
          <DialogFooter className="border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {state.phase === "completed" ? "Done" : "Close"}
              {state.phase !== "completed" && <X className="h-4 w-4" />}
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
