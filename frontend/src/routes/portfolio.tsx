import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/vektor/states";
import { PositionChip, SideChip } from "@/components/vektor/status-chip";
import { useWallet } from "@/lib/vektor/wallet";
import { MARKETS, USER_BETS } from "@/lib/vektor/mock-data";
import { formatDate, formatGen } from "@/lib/vektor/format";
import type { Position, PositionStatus } from "@/lib/vektor/types";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — Vektor" },
      {
        name: "description",
        content:
          "Track active Vektor positions, settled wins, refunds available and claimed payouts across daily FX and metals markets.",
      },
      { property: "og:title", content: "Portfolio — Vektor" },
      {
        property: "og:description",
        content: "Your Vektor positions: active, won, lost, refundable and claimed.",
      },
    ],
  }),
  component: Portfolio,
});

const TABS: { key: PositionStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "WON", label: "Won" },
  { key: "LOST", label: "Lost" },
  { key: "REFUND_AVAILABLE", label: "Refund available" },
  { key: "CLAIMED", label: "Claimed" },
];

function buildPositions(): Position[] {
  return USER_BETS.flatMap((bet) => {
    const market = MARKETS.find((m) => m.id === bet.marketId);
    if (!market) return [];
    let status: PositionStatus = "ACTIVE";
    let claimable = 0;

    if (market.status === "CLOSED") {
      if (market.outcome === "INCONCLUSIVE") {
        status = bet.claimed ? "CLAIMED" : "REFUND_AVAILABLE";
        claimable = bet.claimed ? 0 : bet.stake;
      } else if (market.outcome === bet.side) {
        status = bet.claimed ? "CLAIMED" : "WON";
        const winning = market.outcome === "UP" ? market.upPool : market.downPool;
        claimable = bet.claimed ? 0 : (bet.stake / winning) * (market.upPool + market.downPool);
      } else {
        status = "LOST";
      }
    }
    return [{ market, bet, status, claimable }];
  });
}

function Portfolio() {
  const { address, connect, status: walletStatus } = useWallet();
  const [tab, setTab] = useState<PositionStatus | "ALL">("ALL");

  const positions = useMemo(buildPositions, []);
  const filtered = tab === "ALL" ? positions : positions.filter((p) => p.status === tab);

  const totals = useMemo(() => {
    const staked = positions.reduce((a, p) => a + p.bet.stake, 0);
    const claimable = positions.reduce((a, p) => a + p.claimable, 0);
    const open = positions.filter((p) => p.status === "ACTIVE").length;
    return { staked, claimable, open };
  }, [positions]);

  if (!address) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          title="Connect a wallet to see positions"
          description="The preview adapter reads wallet positions from its local contract-shaped data. A real wallet client can be connected at this boundary."
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
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">
            Portfolio
          </h1>
          <p className="num mt-1.5 text-xs text-muted-foreground">{address}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total staked" value={`${formatGen(totals.staked)} GEN`} />
        <SummaryCard label="Claimable now" value={`${formatGen(totals.claimable)} GEN`} tone="up" />
        <SummaryCard label="Open positions" value={String(totals.open)} />
      </div>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] transition-colors",
              tab === t.key
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="Nothing in this bucket"
          description="Positions appear here as markets move through their lifecycle."
          action={
            <Button asChild variant="surface" size="sm">
              <Link to="/">Browse markets</Link>
            </Button>
          }
        />
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <div className="hidden grid-cols-[minmax(0,1fr)_88px_110px_120px_150px_120px] gap-3 border-b border-border bg-surface px-4 py-2.5 lg:grid">
            {["Market", "Side", "Stake", "Claimable", "Status", ""].map((h, i) => (
              <span key={i} className="label-xs">
                {h}
              </span>
            ))}
          </div>
          <div className="divide-y divide-border">
            {filtered.map((p) => (
              <div
                key={p.market.id}
                className="grid gap-3 px-4 py-3.5 transition-colors hover:bg-surface lg:grid-cols-[minmax(0,1fr)_88px_110px_120px_150px_120px] lg:items-center"
              >
                <div className="min-w-0">
                  <Link
                    to="/market/$id"
                    params={{ id: p.market.id }}
                    className="num text-sm font-bold text-foreground hover:text-primary"
                  >
                    {p.market.instrument}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {formatDate(p.market.targetDate)} · {p.market.id}
                  </div>
                </div>
                <div>
                  <SideChip side={p.bet.side} />
                </div>
                <div className="num text-sm font-semibold text-foreground">
                  {formatGen(p.bet.stake)} GEN
                </div>
                <div
                  className={cn(
                    "num text-sm font-semibold",
                    p.claimable > 0 ? "text-up" : "text-muted-foreground",
                  )}
                >
                  {p.claimable > 0 ? `${formatGen(p.claimable)} GEN` : "—"}
                </div>
                <div>
                  <PositionChip status={p.status} />
                </div>
                <div className="lg:text-right">
                  {p.status === "WON" || p.status === "REFUND_AVAILABLE" ? (
                    <Button size="sm" className="w-full font-semibold lg:w-auto">
                      {p.status === "WON" ? "Claim" : "Refund"}
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="surface" className="w-full lg:w-auto">
                      <Link to="/market/$id" params={{ id: p.market.id }}>
                        View
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "up" }) {
  return (
    <div className="panel p-4">
      <div className="label-xs">{label}</div>
      <div
        className={cn(
          "num mt-1.5 text-xl font-bold",
          tone === "up" ? "text-up" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
