import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Layers, TrendingUp } from "lucide-react";
import { CategoryNav, type CategoryKey } from "@/components/vektor/category-nav";
import { FilterRail, type SortKey } from "@/components/vektor/filter-rail";
import { MarketCard } from "@/components/vektor/market-card";
import { EmptyState, ErrorState, MarketCardSkeleton } from "@/components/vektor/states";
import { marketsQuery } from "@/lib/vektor/queries";
import type { Instrument } from "@/lib/vektor/types";
import { formatGen } from "@/lib/vektor/format";
import { MARKETS } from "@/lib/vektor/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vektor — Daily FX & Metals Prediction Markets on GenLayer" },
      {
        name: "description",
        content:
          "Trade daily UP/DOWN markets on GBP/USD, USD/JPY, XAU/USD and XAG/USD. Permissionless listing, GEN staking, validator-resolved outcomes.",
      },
      { property: "og:title", content: "Vektor — Daily FX & Metals Prediction Markets" },
      {
        property: "og:description",
        content:
          "Permissionless daily directional markets on GenLayer. Stake GEN on UP or DOWN and settle by validator consensus.",
      },
    ],
  }),
  component: MarketsHome,
});

function MarketsHome() {
  const [category, setCategory] = useState<CategoryKey>("all");
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [sort, setSort] = useState<SortKey>("volume");

  const query = useMemo(() => ({ category, instruments, sort }), [category, instruments, sort]);
  const { data, isPending, isError, refetch } = useQuery(marketsQuery(query));

  const totals = useMemo(() => {
    const pool = MARKETS.reduce((a, m) => a + m.upPool + m.downPool, 0);
    const live = MARKETS.filter((m) => m.status === "OPEN").length;
    const traders = MARKETS.reduce((a, m) => a + m.bettors, 0);
    return { pool, live, traders };
  }, []);

  return (
    <>
      <CategoryNav value={category} onChange={setCategory} />

      <section className="mx-auto max-w-[1600px] px-4 pt-8 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 lg:flex lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">
              Daily directional markets
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              One question per session: does the instrument close above or below its previous
              weekday reference? Stake GEN, settle on validator consensus.
            </p>
          </div>
          <dl className="hidden shrink-0 gap-8 sm:flex">
            <HeroStat icon={Layers} label="Open pool" value={`${formatGen(totals.pool, 0)} GEN`} />
            <HeroStat icon={TrendingUp} label="Live markets" value={String(totals.live)} />
            <HeroStat icon={Activity} label="Positions" value={String(totals.traders)} />
          </dl>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[264px_minmax(0,1fr)]">
        <FilterRail
          className="hidden lg:block"
          selected={instruments}
          sort={sort}
          onSort={setSort}
          onReset={() => setInstruments([])}
          onToggle={(s) =>
            setInstruments((prev) =>
              prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
            )
          }
        />

        <div className="min-w-0 space-y-3">
          {isPending && Array.from({ length: 4 }).map((_, i) => <MarketCardSkeleton key={i} />)}

          {isError && <ErrorState onRetry={() => void refetch()} />}

          {!isPending && !isError && data && data.length === 0 && (
            <EmptyState
              title="No markets match these filters"
              description="Loosen the instrument filter or switch category. New sessions are listed each weekday."
            />
          )}

          {data?.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      </section>
    </>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="label-xs flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="num mt-1 text-xl font-bold text-foreground">{value}</dd>
    </div>
  );
}
