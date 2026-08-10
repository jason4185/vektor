/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/vektor/states";
import { PositionChip, SideChip } from "@/components/vektor/status-chip";
import { useWallet } from "@/lib/vektor/wallet";
import { portfolioQuery } from "@/lib/vektor/queries";
import { vektorContract } from "@/lib/vektor/contract";
import { formatWalletError } from "@/lib/vektor/errors";
import { formatDate, formatGen } from "@/lib/vektor/format";
import type { UserResult } from "@/lib/vektor/types";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — Vektor" },
      {
        name: "description",
        content: "Track your open and finished Vektor positions.",
      },
    ],
  }),
  component: Portfolio,
});

const TABS: { key: UserResult | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Active" },
  { key: "WON", label: "Won" },
  { key: "LOST", label: "Lost" },
  { key: "REFUND_AVAILABLE", label: "Refunds" },
  { key: "CLAIMED", label: "Claimed" },
];

function Portfolio() {
  const { address, connect, status: walletStatus } = useWallet();
  const [tab, setTab] = useState<UserResult | "ALL">("ALL");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: positions = [], isPending, isError, refetch } = useQuery(portfolioQuery(address));
  const filtered = tab === "ALL" ? positions : positions.filter((p) => p.status === tab);
  const totals = useMemo(
    () => ({
      staked: positions.reduce((a, p) => a + p.bet.stake, 0),
      claimable: positions.reduce((a, p) => a + p.claimable, 0),
      open: positions.filter((p) => p.status === "PENDING").length,
    }),
    [positions],
  );

  async function claim(marketId: string) {
    setClaimingId(marketId);
    setClaimError(null);
    try {
      const result = await vektorContract.claim_payout(marketId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vektor", "portfolio", address] }),
        queryClient.invalidateQueries({ queryKey: ["vektor", "user-status", marketId, address] }),
      ]);
      if (!result.confirmed) setClaimError("Claim submitted. Vektor is still confirming it.");
    } catch (error) {
      setClaimError(formatWalletError(error));
    } finally {
      setClaimingId(null);
    }
  }

  if (!address)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          title="Connect your wallet to view your positions"
          description="Your Vektor positions will appear here after you make a prediction."
          action={
            <Button onClick={() => void connect()} disabled={walletStatus === "connecting"}>
              {walletStatus === "connecting" ? "Connecting…" : "Connect wallet"}
            </Button>
          }
        />
      </div>
    );
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="label-xs text-primary">Your positions</div>
      <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-foreground sm:text-3xl">
        Portfolio
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Track your open and finished positions.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total staked" value={`${formatGen(totals.staked)} GEN`} />
        <SummaryCard label="Your payout" value={`${formatGen(totals.claimable)} GEN`} tone="up" />
        <SummaryCard label="Active positions" value={String(totals.open)} />
      </div>
      <div className="mt-6 flex flex-wrap gap-1 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em]",
              tab === t.key
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {claimError && <p className="mt-3 text-sm text-down">{claimError}</p>}
      {isPending && <LoadingBlock label="Loading your positions" />}
      {isError && <ErrorState onRetry={() => void refetch()} />}
      {!isPending && !isError && filtered.length === 0 && (
        <EmptyState
          className="mt-6"
          title="No positions yet"
          description="Your markets will appear here after you place a prediction."
          action={
            <Button asChild variant="surface" size="sm">
              <Link to="/">Browse markets</Link>
            </Button>
          }
        />
      )}
      {filtered.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <div className="hidden grid-cols-[minmax(0,1fr)_88px_110px_120px_150px_120px] gap-3 border-b border-border bg-surface px-4 py-2.5 lg:grid">
            {["Market", "Side", "Stake", "Payout", "Result", ""].map((h, i) => (
              <span key={i} className="label-xs">
                {h}
              </span>
            ))}
          </div>
          <div className="divide-y divide-border">
            {filtered.map((p) => (
              <div
                key={p.market.id}
                className="grid gap-3 px-4 py-3.5 hover:bg-surface lg:grid-cols-[minmax(0,1fr)_88px_110px_120px_150px_120px] lg:items-center"
              >
                <div>
                  <Link
                    to="/market/$id"
                    params={{ id: p.market.id }}
                    className="num text-sm font-bold text-foreground hover:text-primary"
                  >
                    {p.market.instrument}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    Prediction day · {formatDate(p.market.targetDate)}
                  </div>
                </div>
                <div>
                  <SideChip side={p.bet.side as "UP" | "DOWN"} />
                </div>
                <div className="num text-sm font-semibold">{formatGen(p.bet.stake)} GEN</div>
                <div
                  className={cn(
                    "num text-sm font-semibold",
                    p.claimable > 0 ? "text-up" : "text-muted-foreground",
                  )}
                >
                  {p.claimable > 0 ? `${formatGen(p.claimable)} GEN` : "—"}
                </div>
                <div>
                  <PositionChip status={p.status as any} />
                </div>
                <div className="lg:text-right">
                  {(p.status === "WON" || p.status === "REFUND_AVAILABLE") && p.claimable > 0 ? (
                    <Button
                      size="sm"
                      className="w-full font-semibold lg:w-auto"
                      disabled={claimingId !== null}
                      onClick={() => void claim(p.market.id)}
                    >
                      {claimingId === p.market.id
                        ? "Processing…"
                        : p.status === "WON"
                          ? "Claim"
                          : "Refund"}
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
