import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, CheckCircle2, Info, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { INSTRUMENTS, PROTOCOL_CONFIG } from "@/lib/vektor/mock-data";
import { getVektorContract } from "@/lib/vektor/contract";
import { validateCreationQuery } from "@/lib/vektor/queries";
import { formatDate, toIsoDate } from "@/lib/vektor/format";
import type { Instrument, TxState } from "@/lib/vektor/types";
import { useWallet } from "@/lib/vektor/wallet";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create a market — Vektor" },
      {
        name: "description",
        content:
          "List a permissionless daily directional market on Vektor. Pick an instrument and target session; the contract derives the reference date.",
      },
      { property: "og:title", content: "Create a market — Vektor" },
      {
        property: "og:description",
        content:
          "Pick an instrument and target session to list a daily UP/DOWN market on GenLayer.",
      },
    ],
  }),
  component: CreateMarket,
});

function CreateMarket() {
  const { address, connect, status: walletStatus } = useWallet();
  const [instrument, setInstrument] = useState<Instrument>("GBP/USD");
  const [date, setDate] = useState<Date | undefined>();
  const [tx, setTx] = useState<TxState>({ phase: "idle" });

  const targetDate = date ? toIsoDate(date) : "";
  const { data: validation, isFetching } = useQuery(validateCreationQuery(instrument, targetDate));

  const ready = Boolean(validation?.valid);
  const busy = tx.phase === "signing" || tx.phase === "pending";

  const errors = useMemo(() => validation?.errors ?? [], [validation]);

  async function submit() {
    if (!address) {
      void connect();
      return;
    }
    setTx({ phase: "signing" });
    try {
      const intent = await getVektorContract().create_market(instrument, targetDate);
      setTx({ phase: "pending", hash: intent.method });
      await new Promise((r) => setTimeout(r, 900));
      setTx({ phase: "success", hash: intent.method });
    } catch {
      setTx({ phase: "error", message: "Could not prepare the create_market call." });
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">
        List a new session
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Anyone can open a market. Choose the instrument and the trading session you want priced —
        Vektor derives the reference close from the previous weekday and writes the question
        on-chain.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section>
            <span className="label-xs">1 · Instrument</span>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {INSTRUMENTS.map((i) => (
                <button
                  key={i.symbol}
                  type="button"
                  onClick={() => setInstrument(i.symbol)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all duration-150",
                    instrument === i.symbol
                      ? "border-primary/60 bg-primary/[0.08] glow-primary"
                      : "border-border bg-surface hover:border-border-strong hover:bg-surface-raised",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="num text-base font-bold text-foreground">{i.symbol}</span>
                    <span className="label-xs">{i.klass === "fx" ? "FX" : "Metals"}</span>
                  </div>
                  <div className="mt-1 text-sm text-foreground/80">{i.name}</div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{i.blurb}</p>
                </button>
              ))}
            </div>
          </section>

          <section>
            <span className="label-xs">2 · Target session</span>
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
                    onSelect={setDate}
                    initialFocus
                    className={cn("pointer-events-auto p-3")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </section>

          <section>
            <span className="label-xs">3 · Derived preview</span>
            <div className="panel mt-3 divide-y divide-border">
              <PreviewRow
                label="Reference date (derived)"
                value={validation?.referenceDate ? formatDate(validation.referenceDate) : "—"}
              />
              <PreviewRow label="Target date" value={targetDate ? formatDate(targetDate) : "—"} />
              <PreviewRow
                label="Settlement opens"
                value={targetDate ? `${formatDate(targetDate)} · 22:00 UTC` : "—"}
              />
              <div className="p-4">
                <div className="label-xs">Generated question</div>
                <p className="mt-2 text-sm font-medium leading-snug text-foreground">
                  {validation?.question ??
                    "Select an instrument and a valid weekday session to preview the on-chain question."}
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

          {tx.phase === "success" && (
            <div className="flex items-start gap-2 rounded-xl border border-up/30 bg-up/10 px-4 py-3 text-sm text-up">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Listing prepared for <span className="num">{instrument}</span> on{" "}
                <span className="num">{formatDate(targetDate)}</span>. Broadcasting is disabled
                until the GenLayer client is connected.
              </span>
            </div>
          )}
          {tx.phase === "error" && <p className="text-sm text-down">{tx.message}</p>}

          <Button
            className="h-11 w-full font-bold uppercase tracking-[0.06em] sm:w-auto sm:px-8"
            disabled={!ready || busy || isFetching}
            onClick={() => void submit()}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {!address && walletStatus !== "connecting"
              ? "Connect wallet to list"
              : busy
                ? "Preparing listing"
                : "List market"}
          </Button>
        </div>

        <aside className="space-y-4">
          <div className="panel p-4">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <span className="label-xs">Listing rules</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>Target date must be a future weekday session within the contract window.</li>
              <li>One market per instrument per session — duplicates are rejected on-chain.</li>
              <li>The reference date is derived by the contract, never chosen by the creator.</li>
              <li>
                Listing costs gas only. There is no listing fee and the creator has no special
                rights over the market.
              </li>
            </ul>
          </div>

          <div className="panel p-4">
            <span className="label-xs">Stake limits</span>
            <div className="num mt-3 space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Min</span>
                <span className="text-foreground">{PROTOCOL_CONFIG.minStake} GEN</span>
              </div>
              <div className="flex justify-between">
                <span>Max per wallet</span>
                <span className="text-foreground">{PROTOCOL_CONFIG.maxStakePerWallet} GEN</span>
              </div>
            </div>
            <Link
              to="/how-it-works"
              className="mt-4 inline-block text-xs font-semibold text-primary hover:underline"
            >
              Read the settlement model →
            </Link>
          </div>
        </aside>
      </div>
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
