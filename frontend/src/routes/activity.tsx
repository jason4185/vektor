import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Clock3,
  Radio,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/vektor/states";
import { useWallet } from "@/lib/vektor/wallet";
import {
  dueMarketsQuery,
  marketQuery,
  portfolioQuery,
  userStatusQuery,
} from "@/lib/vektor/queries";
import { vektorContract } from "@/lib/vektor/contract";
import { formatWalletError } from "@/lib/vektor/errors";
import { formatDate, formatGen } from "@/lib/vektor/format";
import {
  activityMatches,
  activityPriority,
  deriveActivityItem,
  type ActivityFilter,
  type ActivityItem,
} from "@/lib/vektor/activity";
import { cn } from "@/lib/utils";
import { reconcileAcceptedWrite } from "@/lib/vektor/reconciliation";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Vektor" },
      { name: "description", content: "Your Vektor markets and actions from contract state." },
    ],
  }),
  component: ActivityPage,
});

const filters: Array<{ key: ActivityFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "needs", label: "Needs action" },
  { key: "live", label: "Live" },
  { key: "open", label: "Open" },
  { key: "finished", label: "Finished" },
];

function ActivityPage() {
  const { address, connect, status: walletStatus } = useWallet();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const portfolio = useQuery(portfolioQuery(address));
  const due = useQuery(dueMarketsQuery());
  const items = useMemo(
    () =>
      (portfolio.data ?? [])
        .map((position) => deriveActivityItem(position, now))
        .filter((item): item is ActivityItem => item !== null)
        .sort(
          (a, b) =>
            activityPriority(a) - activityPriority(b) || b.targetDate.localeCompare(a.targetDate),
        ),
    [now, portfolio.data],
  );
  const filtered = items.filter((item) => activityMatches(item, filter));

  async function refresh(marketId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vektor", "portfolio", address] }),
      queryClient.invalidateQueries({ queryKey: ["vektor", "market", marketId] }),
      queryClient.invalidateQueries({ queryKey: ["vektor", "user-status", marketId, address] }),
      queryClient.invalidateQueries({ queryKey: ["vektor", "due-market-state"] }),
      queryClient.invalidateQueries({ queryKey: ["vektor", "due-markets"] }),
    ]);
  }

  async function run(item: ActivityItem) {
    if (!address || !item.action || item.action === "view") return;
    const busyKey = item.action === "settle" ? `settle-${item.marketId}` : item.marketId;
    setBusyId(busyKey);
    setError(null);
    setNotice(null);
    try {
      const result =
        item.action === "settle"
          ? await vektorContract.settle_market(item.marketId)
          : await vektorContract.claim_payout(item.marketId);
      const reconciled =
        item.action === "settle"
          ? await reconcileAcceptedWrite(
              result,
              () => queryClient.fetchQuery(marketQuery(item.marketId)),
              (market) => market.status === "CLOSED",
            )
          : await reconcileAcceptedWrite(
              result,
              () => queryClient.fetchQuery(userStatusQuery(item.marketId, address)),
              (status) => status.claimed,
            );
      await refresh(item.marketId);
      if (!result.confirmed) {
        setNotice("Submitted. Vektor is still confirming the transaction.");
      } else if (!reconciled) {
        setNotice("Accepted by GenLayer, but the updated contract state is still catching up.");
      } else {
        setNotice(item.action === "settle" ? "Market settled." : "Claim confirmed.");
      }
    } catch (reason) {
      setError(formatWalletError(reason));
    } finally {
      setBusyId(null);
    }
  }

  if (!address) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
        <PageIntro />
        <EmptyState
          className="mt-6"
          title="Connect your wallet to see your Vektor activity"
          description="Your markets and positions are read directly from Vektor."
          action={
            <Button onClick={() => void connect()} disabled={walletStatus === "connecting"}>
              {walletStatus === "connecting" ? "Connecting…" : "Connect wallet"}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <PageIntro />
      <div className="mt-6 flex flex-wrap gap-1 border-b border-border pb-2">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold",
              filter === item.key
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-down">{error}</p>}
      {notice && <p className="mt-3 text-sm text-muted-foreground">{notice}</p>}
      {portfolio.isPending && <LoadingBlock label="Loading your activity" />}
      {portfolio.isError && <ErrorState onRetry={() => void portfolio.refetch()} />}
      {!portfolio.isPending && !portfolio.isError && filtered.length === 0 && (
        <EmptyState
          className="mt-6"
          title="No activity yet"
          description="Your Vektor positions and market actions will appear here after you participate in a market."
          action={
            <Button asChild variant="surface">
              <Link to="/">Browse markets</Link>
            </Button>
          }
        />
      )}
      {!portfolio.isPending && !portfolio.isError && filtered.length > 0 && (
        <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface/30">
          {filtered.map((item) => (
            <ActivityRow
              key={item.marketId}
              item={item}
              busy={busyId === item.marketId || busyId === `settle-${item.marketId}`}
              onAction={() => void run(item)}
            />
          ))}
        </div>
      )}
      {due.data && due.data.length > 0 && (
        <section className="mt-8">
          <div className="label-xs text-primary">Markets ready to settle</div>
          <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface/30">
            {due.data.map((market) => (
              <div key={market.id} className="flex items-center gap-3 px-4 py-3">
                <Clock3 className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{market.instrument}</div>
                  <div className="text-xs text-muted-foreground">
                    Prediction day {formatDate(market.targetDate)}
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={busyId === `settle-${market.id}`}
                  onClick={() =>
                    void run({
                      marketId: market.id,
                      kind: "ready",
                      group: "needs",
                      title: "Ready to settle",
                      instrument: market.instrument,
                      side: "UP",
                      stake: 0,
                      claimable: 0,
                      targetDate: market.targetDate,
                      action: "settle",
                    })
                  }
                >
                  {busyId === `settle-${market.id}` ? "Settling…" : "Settle"}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Activity is reconstructed from current Vektor market state on GenLayer.
      </p>
    </div>
  );
}

function PageIntro() {
  return (
    <>
      <div className="label-xs text-primary">Contract activity</div>
      <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-foreground sm:text-3xl">
        Activity
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your Vektor markets and actions, read directly from the contract.
      </p>
    </>
  );
}

function ActivityRow({
  item,
  busy,
  onAction,
}: {
  item: ActivityItem;
  busy: boolean;
  onAction: () => void;
}) {
  const Icon =
    item.kind === "payout" || item.kind === "refund"
      ? CircleDollarSign
      : item.kind === "live"
        ? Radio
        : item.kind === "lost"
          ? item.side === "UP"
            ? ArrowUpRight
            : ArrowDownRight
          : item.kind === "won" || item.kind === "claimed"
            ? Trophy
            : item.side === "UP"
              ? ArrowUpRight
              : ArrowDownRight;
  const actionLabel =
    item.action === "claim"
      ? item.kind === "refund"
        ? "Claim refund"
        : "Claim payout"
      : item.action === "settle"
        ? "Settle market"
        : "View market";
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-surface">
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          item.kind === "lost"
            ? "text-down"
            : item.kind === "payout" || item.kind === "refund"
              ? "text-up"
              : "text-primary",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">{item.title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {item.instrument} · {item.side} · {formatGen(item.stake)} GEN · Prediction day{" "}
          {formatDate(item.targetDate)}
        </div>
      </div>
      {item.claimable > 0 && (
        <div className="num text-xs font-semibold text-up">
          {formatGen(item.claimable)} GEN available
        </div>
      )}
      <Button
        asChild={item.action === "view"}
        size="sm"
        variant={item.action === "view" ? "surface" : "default"}
        disabled={busy}
        onClick={item.action === "view" ? undefined : onAction}
      >
        {item.action === "view" ? (
          <Link to="/market/$id" params={{ id: item.marketId }}>
            {actionLabel} →
          </Link>
        ) : busy ? (
          "Processing…"
        ) : (
          actionLabel
        )}
      </Button>
    </div>
  );
}
