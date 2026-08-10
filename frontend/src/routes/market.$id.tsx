import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TradeTicket } from "@/components/vektor/trade-ticket";
import { Disclosure } from "@/components/vektor/disclosure";
import { OutcomeChip, StatusChip } from "@/components/vektor/status-chip";
import { ProbabilityBar } from "@/components/vektor/probability";
import { TargetDayChart } from "@/components/vektor/target-day-chart";
import { LoadingBlock, ErrorState } from "@/components/vektor/states";
import { marketQuery, protocolConfigQuery } from "@/lib/vektor/queries";
import { userStatusQuery } from "@/lib/vektor/queries";
import { vektorContract } from "@/lib/vektor/contract";
import { useWallet } from "@/lib/vektor/wallet";
import { formatWalletError } from "@/lib/vektor/errors";
import type { WriteResult } from "@/lib/vektor/types";
import {
  bpsToPct,
  formatDate,
  formatDateTime,
  formatGen,
  formatPrice,
  instrumentMeta,
} from "@/lib/vektor/format";

export const Route = createFileRoute("/market/$id")({
  head: () => {
    const title = "Market — Vektor";
    return {
      meta: [
        { title },
        { name: "description", content: "Vektor daily directional market" },
        { property: "og:title", content: title },
        { property: "og:description", content: "Vektor daily directional market" },
      ],
    };
  },
  component: MarketDetail,
});

function MarketDetail() {
  const { id } = Route.useParams();
  const { data: market, isPending, isError, refetch } = useQuery(marketQuery(id));
  const { data: protocol } = useQuery(protocolConfigQuery());

  if (isPending) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <LoadingBlock label="Loading market" />
      </div>
    );
  }
  if (isError || !market) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  const meta = instrumentMeta(market.instrument);
  const pool = market.upPool + market.downPool;

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All markets
      </Link>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ------------------------------------------------------- left col */}
        <div className="min-w-0 space-y-4">
          <div className="panel p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-sm font-bold text-foreground">{market.instrument}</span>
              <span className="label-xs">{meta.klass === "fx" ? "FX" : "Metals"}</span>
              <StatusChip status={market.status} displayStatus={market.displayStatus} />
              {market.outcome !== "NONE" && <OutcomeChip outcome={market.outcome} />}
              <span className="num ml-auto text-xs text-muted-foreground">{market.id}</span>
            </div>

            <h1 className="mt-4 max-w-3xl text-xl font-bold leading-snug tracking-[-0.03em] text-foreground sm:text-[1.65rem]">
              {market.question}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{meta.blurb}</p>

            <div className="mt-6">
              <ProbabilityBar upBps={market.upBps} downBps={market.downBps} />
            </div>
          </div>

          <TargetDayChart market={market} />

          {/* Snapshot rows */}
          <div className="panel divide-y divide-border">
            <div className="px-5 py-3.5">
              <span className="label-xs">Market details</span>
            </div>
            <SnapshotRow
              label="UP share"
              value={`${bpsToPct(market.upBps)} · ${formatGen(market.upPool)} GEN`}
              tone="up"
            />
            <SnapshotRow
              label="DOWN share"
              value={`${market.downBps === 0 && market.upBps === 0 ? "—" : bpsToPct(market.downBps)} · ${formatGen(market.downPool)} GEN`}
              tone="down"
            />
            <SnapshotRow label="Total pool" value={`${formatGen(pool)} GEN`} />
            <SnapshotRow
              label="Previous weekday"
              value={`${formatDate(market.referenceDate)} · ${formatPrice(market.instrument, market.referencePrice)}`}
            />
            <SnapshotRow
              label="Target date"
              value={`${formatDate(market.targetDate)} · ${formatPrice(market.instrument, market.targetPrice)}`}
            />
            <SnapshotRow
              label="Ready to settle"
              value={formatDateTime(market.settlementEligibleAt)}
            />
            <SnapshotRow label="Created by" value={market.creator} />
          </div>

          {/* Disclosures */}
          <div className="space-y-3">
            <Disclosure title="Market rules" eyebrow="How it works" defaultOpen>
              <p>
                This market compares {market.instrument} on the target date with the previous
                weekday, {formatDate(market.referenceDate)}. That comparison date is set when the
                market is created and cannot be changed.
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>UP wins if the target price is higher than the previous weekday.</li>
                <li>DOWN wins if the target price is lower than the previous weekday.</li>
                <li>
                  Stake GEN, minimum {protocol?.minStake ?? 1} and maximum{" "}
                  {protocol?.maxStakePerWallet ?? 10} per wallet per market.
                </li>
                <li>You can add more GEN to the same side. You cannot choose both sides.</li>
              </ul>
            </Disclosure>

            <Disclosure title="How the result is decided" eyebrow="Market result">
              <p>
                After {formatDateTime(market.settlementEligibleAt)}, anyone can settle this market.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <SourceCard
                  name="FXRatesAPI"
                  detail="Checks the previous weekday and target date, then compares the two prices."
                />
                <SourceCard
                  name="Fawaz Currency API"
                  detail="Independently fetches its own historical values for the same two sessions and produces its own direction from its own data."
                />
              </div>
              <p>
                Each source checks its own prices for both dates. GenLayer helps verify the result
                using more than one source, so no single person decides the outcome. Both sources
                must agree on UP or DOWN.
              </p>
              {market.evidence && <EvidenceBlock evidence={market.evidence} />}
              <p className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/[0.07] px-3 py-2 text-primary">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                If the sources disagree or a price is missing, the result is INCONCLUSIVE instead of
                a guess.
              </p>
            </Disclosure>

            <Disclosure title="Timeline & payout" eyebrow="Lifecycle">
              <ol className="space-y-3">
                <TimelineStep
                  step="01"
                  title="Listed"
                  detail={`${formatDateTime(market.createdAt)} — compared with the previous weekday, ${formatDate(market.referenceDate)}.`}
                />
                <TimelineStep
                  step="02"
                  title="Choose a side"
                  detail="Stake GEN on UP or DOWN until the target date begins."
                />
                <TimelineStep
                  step="03"
                  title="Target date ends"
                  detail={formatDateTime(market.targetEnd)}
                />
                <TimelineStep
                  step="04"
                  title="Ready to settle"
                  detail={`${formatDateTime(market.settlementEligibleAt)} — anyone can settle the market.`}
                />
                <TimelineStep
                  step="05"
                  title="Claim"
                  detail="Winners receive their stake plus a share of the other side's pool."
                />
              </ol>
            </Disclosure>

            <Disclosure title="Risks & inconclusive conditions" eyebrow="Read before staking">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  A market is INCONCLUSIVE when the sources disagree, a price is missing, or the
                  result cannot be confirmed.
                </li>
                <li>
                  INCONCLUSIVE refunds every original stake in full. Nobody wins and nobody loses.
                </li>
                <li>
                  An exact flat close (target equal to reference) is not a directional outcome and
                  resolves INCONCLUSIVE.
                </li>
                <li>
                  Payouts change as the pool fills. Any amount shown before the result is an
                  estimate.
                </li>
                <li>
                  Someone must settle the market before payouts are available. If settlement is
                  delayed, your stake remains in the market.
                </li>
              </ul>
            </Disclosure>
          </div>
        </div>

        {/* ------------------------------------------------------ right col */}
        <div className="min-w-0">
          <div className="lg:sticky lg:top-20 lg:space-y-4">
            <TradeTicket market={market} className="hidden lg:block" />
            <MarketActions market={market} />
            <div className="panel hidden p-4 lg:block">
              <span className="label-xs">Market details</span>
              <div className="num mt-2 break-all text-xs text-muted-foreground">
                {protocol?.contractAddress}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <ExternalLink className="h-3.5 w-3.5" />
                {protocol?.chain}
              </div>
            </div>
            <div className="lg:hidden">
              <TradeTicket market={market} />
              <MarketActions market={market} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="label-xs truncate">
              {market.instrument} · {formatDate(market.targetDate)}
            </div>
            <div className="num text-sm font-semibold text-foreground">
              <span className="text-up">{bpsToPct(market.upBps, 0)}</span>
              {" / "}
              <span className="text-down">
                {market.downBps === 0 && market.upBps === 0 ? "—" : bpsToPct(market.downBps, 0)}
              </span>
            </div>
          </div>
          <Button
            className="shrink-0 font-semibold"
            onClick={() =>
              document.getElementById("mobile-ticket")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Trade
          </Button>
        </div>
      </div>
      <div id="mobile-ticket" />
    </div>
  );
}

function SnapshotRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <span className="label-xs">{label}</span>
      <span
        className={`num text-sm font-semibold ${
          tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function MarketActions({ market }: { market: import("@/lib/vektor/types").Market }) {
  const { address, connect } = useWallet();
  const queryClient = useQueryClient();
  const { data: user } = useQuery(userStatusQuery(market.id, address));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canClaim = Boolean(user?.can_claim);
  async function run(action: () => Promise<WriteResult>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vektor", "market", market.id] }),
        queryClient.invalidateQueries({ queryKey: ["vektor", "user-status", market.id, address] }),
        queryClient.invalidateQueries({ queryKey: ["vektor", "due-markets"] }),
        queryClient.invalidateQueries({ queryKey: ["vektor", "portfolio", address] }),
      ]);
      let reconciled = false;
      if (result.confirmed) {
        for (let attempt = 0; attempt < 10 && !reconciled; attempt += 1) {
          if (success === "Market settled.") {
            reconciled = (await queryClient.fetchQuery(marketQuery(market.id))).status === "CLOSED";
          } else if (address) {
            reconciled = (await queryClient.fetchQuery(userStatusQuery(market.id, address)))
              .claimed;
          }
          if (!reconciled) await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
      }
      setMessage(
        result.confirmed && reconciled
          ? `${success} Reference: ${result.hash.slice(0, 10)}…`
          : "Submitted. Vektor is still confirming the transaction.",
      );
    } catch (error) {
      setMessage(formatWalletError(error));
    } finally {
      setBusy(false);
    }
  }
  if (!market.settlementReady && !canClaim) return null;
  return (
    <div className="panel mt-4 space-y-3 p-4">
      {market.settlementReady && (
        <Button
          className="w-full"
          disabled={busy}
          onClick={() =>
            address
              ? void run(() => vektorContract.settle_market(market.id), "Market settled.")
              : void connect()
          }
        >
          {busy ? "Processing…" : "Settle market"}
        </Button>
      )}
      {canClaim && (
        <Button
          className="w-full"
          disabled={busy}
          onClick={() =>
            void run(
              () => vektorContract.claim_payout(market.id),
              user?.claim_type === "REFUND" ? "Refund ready." : "Payout ready.",
            )
          }
        >
          {busy ? "Claiming…" : user?.claim_type === "REFUND" ? "Claim refund" : "Claim payout"}
        </Button>
      )}
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}

function SourceCard({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="num text-sm font-semibold text-foreground">{name}</div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

function EvidenceBlock({
  evidence,
}: {
  evidence: NonNullable<import("@/lib/vektor/types").Market["evidence"]>;
}) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-background p-4">
      <span className="label-xs">Result details</span>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs font-semibold text-foreground">FXRatesAPI</div>
          <div className="num mt-2 text-xs text-muted-foreground">
            Reference: {evidence.ar} · Target: {evidence.at}
          </div>
          <div className="mt-1 text-xs text-foreground">
            {evidence.av ? evidence.ad : "INVALID"}
          </div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs font-semibold text-foreground">Fawaz</div>
          <div className="num mt-2 text-xs text-muted-foreground">
            Reference: {evidence.br} · Target: {evidence.bt}
          </div>
          <div className="mt-1 text-xs text-foreground">
            {evidence.bv ? evidence.bd : "INVALID"}
          </div>
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        Sources agree on: <span className="font-semibold text-foreground">{evidence.outcome}</span>
      </div>
    </div>
  );
}

function TimelineStep({ step, title, detail }: { step: string; title: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span className="num mt-0.5 shrink-0 text-xs font-bold text-primary">{step}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}
