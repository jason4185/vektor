import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, HandCoins, Plus, ShieldCheck } from "lucide-react";
import { LoadingBlock, ErrorState, EmptyState } from "@/components/vektor/states";
import { OutcomeChip, SideChip } from "@/components/vektor/status-chip";
import { activityQuery } from "@/lib/vektor/queries";
import { formatGen, relativeTime } from "@/lib/vektor/format";
import type { ActivityKind } from "@/lib/vektor/types";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Vektor" },
      {
        name: "description",
        content:
          "Live feed of Vektor contract activity: market listings, GEN bets, permissionless settlements and payout claims.",
      },
      { property: "og:title", content: "Activity — Vektor" },
      {
        property: "og:description",
        content: "Every listing, bet, settlement and claim on the Vektor contract.",
      },
    ],
  }),
  component: ActivityFeed,
});

const ICONS: Record<ActivityKind, typeof Coins> = {
  CREATE: Plus,
  BET: Coins,
  SETTLE: ShieldCheck,
  CLAIM: HandCoins,
};

const LABELS: Record<ActivityKind, string> = {
  CREATE: "Market listed",
  BET: "Position placed",
  SETTLE: "Market settled",
  CLAIM: "Payout claimed",
};

function ActivityFeed() {
  const { data, isPending, isError, refetch } = useQuery(activityQuery());

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">
        Activity
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Preview activity from the Vektor adapter, newest first. Chain writes remain disabled until a
        GenLayer client is configured.
      </p>

      <div className="mt-6">
        {isPending && <LoadingBlock label="Indexing contract events" />}
        {isError && <ErrorState onRetry={() => void refetch()} />}
        {data && data.length === 0 && (
          <EmptyState title="No events yet" description="Contract activity will stream in here." />
        )}

        {data && data.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border divide-y divide-border">
            {data.map((e) => {
              const Icon = ICONS[e.kind];
              return (
                <div key={e.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-raised">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {LABELS[e.kind]}
                      </span>
                      <Link
                        to="/market/$id"
                        params={{ id: e.marketId }}
                        className="num text-xs text-muted-foreground hover:text-primary"
                      >
                        {e.instrument} · {e.marketId}
                      </Link>
                      {e.side && <SideChip side={e.side} />}
                      {e.outcome && <OutcomeChip outcome={e.outcome} />}
                    </div>
                    <div className="num mt-1 truncate text-xs text-muted-foreground">
                      {e.actor} · {e.txHash}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {e.amount !== null && (
                      <div className="num text-sm font-semibold text-foreground">
                        {formatGen(e.amount)} GEN
                      </div>
                    )}
                    <div className="num text-xs text-muted-foreground">
                      {relativeTime(e.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
