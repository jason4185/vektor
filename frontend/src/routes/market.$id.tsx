import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceChart } from "@/components/vektor/price-chart";
import { TradeTicket } from "@/components/vektor/trade-ticket";
import { Disclosure } from "@/components/vektor/disclosure";
import { OutcomeChip, StatusChip } from "@/components/vektor/status-chip";
import { ProbabilityBar } from "@/components/vektor/probability";
import { LoadingBlock, ErrorState } from "@/components/vektor/states";
import { marketQuery } from "@/lib/vektor/queries";
import { MARKETS, PROTOCOL_CONFIG } from "@/lib/vektor/mock-data";
import {
  bpsToPct,
  formatDate,
  formatDateTime,
  formatGen,
  formatPrice,
  instrumentMeta,
} from "@/lib/vektor/format";

export const Route = createFileRoute("/market/$id")({
  loader: ({ params }) => {
    const market = MARKETS.find((m) => m.id === params.id);
    if (!market) throw notFound();
    return { instrument: market.instrument, question: market.question };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Market unavailable — Vektor" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.instrument} daily market — Vektor`;
    return {
      meta: [
        { title },
        { name: "description", content: loaderData.question },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.question },
      ],
    };
  },
  component: MarketDetail,
});

function MarketDetail() {
  const { id } = Route.useParams();
  const { data: market, isPending, isError, refetch } = useQuery(marketQuery(id));

  if (isPending) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <LoadingBlock label="Reading market state" />
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
    <div className="mx-auto max-w-[1600px] px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All markets
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ------------------------------------------------------- left col */}
        <div className="min-w-0 space-y-4">
          <div className="panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-sm font-bold text-foreground">{market.instrument}</span>
              <span className="label-xs">{meta.klass === "fx" ? "FX" : "Metals"}</span>
              <StatusChip status={market.status} />
              {market.outcome && <OutcomeChip outcome={market.outcome} />}
              <span className="num ml-auto text-xs text-muted-foreground">{market.id}</span>
            </div>

            <h1 className="mt-3 text-xl font-bold leading-snug tracking-[-0.02em] text-foreground sm:text-2xl">
              {market.question}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{meta.blurb}</p>

            <div className="mt-5">
              <ProbabilityBar upBps={market.upBps} />
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <span className="label-xs">Session track</span>
                <div className="num mt-1 text-2xl font-bold text-foreground">
                  {formatPrice(market.instrument, market.lastPrice)}
                </div>
              </div>
              <div className="text-right">
                <span className="label-xs">vs reference</span>
                <div
                  className={`num mt-1 text-sm font-semibold ${
                    market.referencePrice !== null && market.lastPrice >= market.referencePrice
                      ? "text-up"
                      : "text-down"
                  }`}
                >
                  {market.referencePrice !== null
                    ? `${market.lastPrice >= market.referencePrice ? "+" : ""}${(
                        ((market.lastPrice - market.referencePrice) / market.referencePrice) *
                        100
                      ).toFixed(2)}%`
                    : "—"}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <PriceChart
                instrument={market.instrument}
                series={market.series}
                referencePrice={market.referencePrice}
              />
            </div>
          </div>

          {/* Snapshot rows */}
          <div className="panel divide-y divide-border">
            <div className="px-5 py-3">
              <span className="label-xs">Market snapshot</span>
            </div>
            <SnapshotRow
              label="UP share"
              value={`${bpsToPct(market.upBps)} · ${formatGen(market.upPool)} GEN`}
              tone="up"
            />
            <SnapshotRow
              label="DOWN share"
              value={`${bpsToPct(10000 - market.upBps)} · ${formatGen(market.downPool)} GEN`}
              tone="down"
            />
            <SnapshotRow label="Total pool" value={`${formatGen(pool)} GEN`} />
            <SnapshotRow
              label="Reference date"
              value={`${formatDate(market.referenceDate)} · ${formatPrice(market.instrument, market.referencePrice)}`}
            />
            <SnapshotRow
              label="Target date"
              value={`${formatDate(market.targetDate)} · ${formatPrice(market.instrument, market.targetPrice)}`}
            />
            <SnapshotRow
              label="Settlement eligible"
              value={formatDateTime(market.settlementEligibleAt)}
            />
            <SnapshotRow label="Listed by" value={market.creator} />
          </div>

          {/* Disclosures */}
          <div className="space-y-3">
            <Disclosure title="Market rules" eyebrow="Contract terms" defaultOpen>
              <p>
                This market resolves on one comparison: the {market.instrument} closing value for{" "}
                {formatDate(market.targetDate)} against the closing value for the derived reference
                session, {formatDate(market.referenceDate)}. The reference session is always the
                previous weekday, computed on-chain at listing time and immutable thereafter.
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  UP resolves if the target close is strictly greater than the reference close.
                </li>
                <li>
                  DOWN resolves if the target close is strictly lower than the reference close.
                </li>
                <li>
                  Stake is native GEN, minimum {PROTOCOL_CONFIG.minStake} and maximum{" "}
                  {PROTOCOL_CONFIG.maxStakePerWallet} per wallet per market.
                </li>
                <li>
                  Adding to an existing position on the same side is allowed. A bet on the opposite
                  side from the same wallet is rejected by the contract.
                </li>
              </ul>
            </Disclosure>

            <Disclosure title="Settlement & consensus" eyebrow="How the outcome is produced">
              <p>
                Settlement is permissionless. After {formatDateTime(market.settlementEligibleAt)},
                any wallet may call <code className="num text-foreground">settle_market</code> and
                pay the gas; there is no privileged resolver.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <SourceCard
                  name="FXRatesAPI"
                  detail="Independently fetches its own historical values for both the reference session and the target session, then compares them to produce a direction."
                />
                <SourceCard
                  name="Fawaz Currency API"
                  detail="Independently fetches its own historical values for the same two sessions and produces its own direction from its own data."
                />
              </div>
              <p>
                Each source resolves its own reference and target values — neither borrows a price
                from the other. GenLayer validators then independently rerun the evidence gathering
                and compare results. The market only resolves directionally when both sources agree
                on the direction <em>and</em> validators reach consensus on that agreement.
              </p>
              <p className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/[0.07] px-3 py-2 text-primary">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Disagreement between the two directions, or missing data for either session,
                produces INCONCLUSIVE rather than a guessed outcome.
              </p>
            </Disclosure>

            <Disclosure title="Timeline & payout" eyebrow="Lifecycle">
              <ol className="space-y-3">
                <TimelineStep
                  step="01"
                  title="Listed"
                  detail={`${formatDateTime(market.createdAt)} — reference date derived as ${formatDate(market.referenceDate)}.`}
                />
                <TimelineStep
                  step="02"
                  title="Open for positions"
                  detail="Wallets stake GEN on UP or DOWN until the target session closes."
                />
                <TimelineStep
                  step="03"
                  title="Target session ends"
                  detail={formatDateTime(market.targetEnd)}
                />
                <TimelineStep
                  step="04"
                  title="Settlement window opens"
                  detail={`${formatDateTime(market.settlementEligibleAt)} — anyone can trigger settlement.`}
                />
                <TimelineStep
                  step="05"
                  title="Claim"
                  detail="Winners call claim_payout and receive stake plus a pro-rata share of the losing pool."
                />
              </ol>
            </Disclosure>

            <Disclosure title="Risks & inconclusive conditions" eyebrow="Read before staking">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  A market resolves INCONCLUSIVE when the two sources disagree on direction, when
                  either session has no published value, or when validators cannot reach consensus.
                </li>
                <li>
                  INCONCLUSIVE refunds every original stake in full. Nobody wins and nobody loses.
                </li>
                <li>
                  An exact flat close (target equal to reference) is not a directional outcome and
                  resolves INCONCLUSIVE.
                </li>
                <li>
                  Odds are pari-mutuel and move as the pool fills. The quoted payout is a projection
                  against the current pool, not a locked price.
                </li>
                <li>
                  Settlement requires someone to pay gas. If no one calls it immediately, payouts
                  are delayed but never lost.
                </li>
              </ul>
            </Disclosure>
          </div>
        </div>

        {/* ------------------------------------------------------ right col */}
        <div className="min-w-0">
          <div className="lg:sticky lg:top-20 lg:space-y-4">
            <TradeTicket market={market} className="hidden lg:block" />
            <div className="panel hidden p-4 lg:block">
              <span className="label-xs">Contract</span>
              <div className="num mt-2 break-all text-xs text-muted-foreground">
                {PROTOCOL_CONFIG.contractAddress}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <ExternalLink className="h-3.5 w-3.5" />
                {PROTOCOL_CONFIG.chain}
              </div>
            </div>
            <div className="lg:hidden">
              <TradeTicket market={market} />
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
              <span className="text-down">{bpsToPct(10000 - market.upBps, 0)}</span>
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

function SourceCard({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="num text-sm font-semibold text-foreground">{name}</div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
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
