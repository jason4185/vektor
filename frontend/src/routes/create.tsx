import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, CheckCircle2, Info, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { vektorContract } from "@/lib/vektor/contract";
import {
  protocolConfigQuery,
  supportedMarketsQuery,
  validateCreationQuery,
} from "@/lib/vektor/queries";
import { formatDate, toIsoDate } from "@/lib/vektor/format";
import { formatValidationReason, formatWalletError } from "@/lib/vektor/errors";
import type { Instrument, TxState } from "@/lib/vektor/types";
import { useWallet } from "@/lib/vektor/wallet";
import { TransactionModal } from "@/components/vektor/transaction-modal";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create a market — Vektor" },
      {
        name: "description",
        content: "Create a Vektor market by choosing an instrument and a target date.",
      },
      { property: "og:title", content: "Create a market — Vektor" },
      {
        property: "og:description",
        content: "Choose an instrument and target date for a daily UP/DOWN market.",
      },
    ],
  }),
  component: CreateMarket,
});

function CreateMarket() {
  const { address, connect, status: walletStatus } = useWallet();
  const queryClient = useQueryClient();
  const [instrument, setInstrument] = useState<Instrument>("GBP/USD");
  const [date, setDate] = useState<Date | undefined>();
  const [tx, setTx] = useState<TxState>({ phase: "idle" });
  const [modalOpen, setModalOpen] = useState(false);
  const [debouncedTarget, setDebouncedTarget] = useState("");
  const { data: instruments = [] } = useQuery(supportedMarketsQuery());
  const { data: protocol } = useQuery(protocolConfigQuery());

  const targetDate = date ? toIsoDate(date) : "";
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTarget(targetDate), 400);
    return () => window.clearTimeout(timer);
  }, [targetDate]);
  const { data: validation, isFetching } = useQuery(
    validateCreationQuery(instrument, debouncedTarget),
  );

  const ready = Boolean(validation?.valid && debouncedTarget === targetDate);
  const busy =
    tx.phase === "preparing" ||
    tx.phase === "wallet_confirmation" ||
    tx.phase === "submitted" ||
    tx.phase === "processing";

  const errors = useMemo(
    () => (validation && !validation.valid ? [formatValidationReason(validation.reason)] : []),
    [validation],
  );

  async function submit() {
    if (!ready || busy) return;
    if (!address) {
      void connect();
      return;
    }
    setTx({ phase: "preparing" });
    setModalOpen(true);
    try {
      setTx({ phase: "wallet_confirmation" });
      const result = await vektorContract.create_market(instrument, targetDate, {
        onProgress: ({ phase, hash }) => setTx((current) => ({ ...current, phase, hash })),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vektor", "markets"] }),
        queryClient.invalidateQueries({ queryKey: ["vektor", "protocol"] }),
      ]);
      let visible = false;
      if (result.confirmed) {
        for (let attempt = 0; attempt < 10 && !visible; attempt += 1) {
          const check = await queryClient.fetchQuery({
            ...validateCreationQuery(instrument, targetDate),
            staleTime: 0,
          });
          visible = check.reason === "DUPLICATE_MARKET" || Boolean(check.duplicate_market_id);
          if (!visible) await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
      }
      setTx({
        phase: result.confirmed && visible ? "completed" : "uncertain",
        hash: result.hash,
        message:
          result.confirmed && visible
            ? `Market created for ${instrument} on ${formatDate(targetDate)}.`
            : "Market submitted. Vektor is still confirming it.",
      });
    } catch (error) {
      setTx({
        phase: /Transaction cancelled\./.test(formatWalletError(error)) ? "cancelled" : "failed",
        message: formatWalletError(error),
      });
    }
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="label-xs text-primary">Create a market</div>
      <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-foreground sm:text-3xl">
        Create a daily market
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Choose an instrument and date. Vektor uses the previous weekday for comparison.
      </p>

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="panel p-5 sm:p-6">
            <span className="label-xs">1 · Instrument</span>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {instruments.map((i) => (
                <button
                  key={i.instrument}
                  type="button"
                  onClick={() => {
                    setInstrument(i.instrument);
                    setTx({ phase: "idle" });
                  }}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all duration-150",
                    instrument === i.instrument
                      ? "border-primary/60 bg-primary/[0.08] glow-primary"
                      : "border-border bg-surface hover:border-border-strong hover:bg-surface-raised",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="num text-base font-bold text-foreground">{i.instrument}</span>
                    <span className="label-xs">{i.category === "FX" ? "FX" : "Metals"}</span>
                  </div>
                  <div className="mt-1 text-sm text-foreground/80">{i.display_symbol}</div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {i.category === "METAL" ? "Gold or silver market" : "Foreign exchange market"}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <span className="label-xs">2 · Target date</span>
            <div className="mt-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="surface"
                    className={cn(
                      "h-11 w-full justify-start gap-2 text-left font-normal sm:w-72",
                      !date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {date ? format(date, "PPP") : "Pick a target date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(next) => {
                      setDate(next);
                      setTx({ phase: "idle" });
                    }}
                    initialFocus
                    className={cn("pointer-events-auto p-3")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <span className="label-xs">3 · Market preview</span>
            <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-background">
              <PreviewRow
                label="Previous weekday"
                value={validation?.reference_date ? formatDate(validation.reference_date) : "—"}
              />
              <PreviewRow label="Target date" value={targetDate ? formatDate(targetDate) : "—"} />
              <PreviewRow
                label="Ready to settle"
                value={
                  validation?.settlement_eligible ? formatDate(validation.settlement_eligible) : "—"
                }
              />
              <div className="p-4">
                <div className="label-xs">Market question</div>
                <p className="mt-2 text-sm font-medium leading-snug text-foreground">
                  {validation?.question ||
                    "Select an instrument and a valid weekday to preview the market question."}
                </p>
              </div>
            </div>
          </section>

          {errors.length > 0 && (
            <ul className="space-y-1.5">
              {errors.map((e) => (
                <li key={e} className="flex items-start gap-2 text-xs text-down">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {e}
                </li>
              ))}
            </ul>
          )}

          {tx.phase === "completed" && (
            <div className="flex items-start gap-2 rounded-xl border border-up/30 bg-up/10 px-4 py-3 text-sm text-up">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {tx.message} Reference: {tx.hash?.slice(0, 10)}…
              </span>
            </div>
          )}
          {(tx.phase === "failed" || tx.phase === "cancelled") && (
            <p className="text-sm text-down">{tx.message}</p>
          )}

          <Button
            className="h-11 w-full font-bold uppercase tracking-[0.06em] sm:w-auto sm:px-8"
            disabled={!ready || busy || isFetching}
            onClick={() => void submit()}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {!address && walletStatus !== "connecting"
              ? "Connect wallet to list"
              : busy
                ? tx.phase === "wallet_confirmation"
                  ? "Awaiting wallet"
                  : tx.phase === "preparing"
                    ? "Preparing"
                    : tx.phase === "submitted"
                      ? "Submitted"
                      : "Processing"
                : "Create market"}
          </Button>
        </div>

        <aside className="space-y-4">
          <div className="panel p-5 lg:sticky lg:top-20">
            <div className="label-xs text-primary">Market preview</div>
            <div className="mt-4 border-b border-border pb-5">
              <div className="num text-sm font-semibold text-foreground">{instrument}</div>
              <div className="mt-2 text-lg font-semibold leading-snug text-foreground">
                {validation?.question || "Select a valid target date"}
              </div>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <PreviewRow label="Instrument" value={instrument} />
              <PreviewRow
                label="Reference"
                value={validation?.reference_date ? formatDate(validation.reference_date) : "—"}
              />
              <PreviewRow label="Target" value={targetDate ? formatDate(targetDate) : "—"} />
              <PreviewRow label="Type" value="Daily directional" />
            </div>
            <div
              className={cn(
                "mt-5 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                ready ? "border-up/30 bg-up/10 text-up" : "border-border text-muted-foreground",
              )}
            >
              {ready ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              {ready ? "Valid market" : "Choose a valid date to continue"}
            </div>
          </div>

          <div className="panel p-4">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <span className="label-xs">Market rules</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>Target date must be a future weekday within the allowed date range.</li>
              <li>Only one market can exist for each instrument and date.</li>
              <li>Vektor uses the previous weekday for comparison.</li>
              <li>
                Creating a market has no extra fee. The creator has no special rights over it.
              </li>
            </ul>
          </div>

          <div className="panel p-4">
            <span className="label-xs">Stake limits</span>
            <div className="num mt-3 space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Min</span>
                <span className="text-foreground">{protocol?.minStake ?? 1} GEN</span>
              </div>
              <div className="flex justify-between">
                <span>Max per wallet</span>
                <span className="text-foreground">{protocol?.maxStakePerWallet ?? 10} GEN</span>
              </div>
            </div>
            <Link
              to="/how-it-works"
              className="mt-4 inline-block text-xs font-semibold text-primary hover:underline"
            >
              See how Vektor works →
            </Link>
          </div>
        </aside>
      </div>
      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Creating market"
        description="Keep this window open while your market is submitted."
        state={tx}
        successMessage={tx.message}
      />
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="label-xs">{label}</span>
      <span className="num text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
