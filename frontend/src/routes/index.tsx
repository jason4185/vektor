import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layers, TrendingUp, WalletCards } from "lucide-react";
import { CategoryNav, type CategoryKey } from "@/components/vektor/category-nav";
import { FilterRail, type SortKey } from "@/components/vektor/filter-rail";
import { MarketCard } from "@/components/vektor/market-card";
import { EmptyState, ErrorState, MarketCardSkeleton } from "@/components/vektor/states";
import { marketsQuery, userMarketIdsQuery } from "@/lib/vektor/queries";
import type { Instrument } from "@/lib/vektor/types";
import { formatGen } from "@/lib/vektor/format";
import { useWallet } from "@/lib/vektor/wallet";
import { LivePriceStrip } from "@/components/vektor/live-price";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vektor — Daily FX & Metals Prediction Markets on GenLayer" },
      {
        name: "description",
        content: "Choose UP or DOWN on daily GBP/USD, USD/JPY, gold, and silver markets.",
      },
      { property: "og:title", content: "Vektor — Daily FX & Metals Prediction Markets" },
      {
        property: "og:description",
        content: "Stake GEN on UP or DOWN and share the pool if your side wins.",
      },
    ],
  }),
  component: MarketsHome,
});

function MarketsHome() {
  const [category, setCategory] = useState<CategoryKey>("all");
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [sort, setSort] = useState<SortKey>("volume");
  const { address } = useWallet();

  const query = useMemo(() => ({ category, instruments, sort }), [category, instruments, sort]);
  const { data: page, isPending, isError, refetch } = useQuery(marketsQuery(query));
  const { data: userMarkets } = useQuery(userMarketIdsQuery(address));
  const data = useMemo(() => page?.items ?? [], [page?.items]);

  const totals = useMemo(() => {
    const pool = data.reduce((a, m) => a + m.upPool + m.downPool, 0);
    const live = data.filter((m) => m.status === "OPEN").length;
    return { pool, live };
  }, [data]);

  return (
    <>
      <CategoryNav value={category} onChange={setCategory} />

      <section className="mx-auto max-w-[1600px] px-4 pb-2 pt-7 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <div className="label-xs mb-2 text-primary">Vektor markets</div>
            <h1 className="text-[1.75rem] font-bold tracking-[-0.04em] text-foreground sm:text-3xl">
              Daily directional markets
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Choose whether FX or metals will finish UP or DOWN compared with the previous weekday.
              Stake GEN and share the pool if your side wins.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-4 border-t border-border pt-4 sm:flex sm:gap-8 sm:border-t-0 sm:pt-0">
            <HeroStat icon={Layers} label="Open pool" value={`${formatGen(totals.pool, 0)} GEN`} />
            <HeroStat icon={TrendingUp} label="Live markets" value={String(totals.live)} />
            <HeroStat
              icon={WalletCards}
              label="Your positions"
              value={String(userMarkets?.total ?? 0)}
            />
          </dl>
        </div>
        <div className="mt-5">
          <LivePriceStrip instruments={["GBP/USD", "USD/JPY", "XAU/USD", "XAG/USD"]} />
        </div>
      </section>

      <section className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[224px_minmax(0,1fr)] lg:px-8">
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
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="label-xs">
              Market feed <span className="text-foreground/70">{page?.total ?? 0}</span>
            </div>
            <div className="text-xs text-muted-foreground">Available markets</div>
          </div>
          {isPending && Array.from({ length: 4 }).map((_, i) => <MarketCardSkeleton key={i} />)}

          {isError && <ErrorState onRetry={() => void refetch()} />}

          {!isPending && !isError && data && data.length === 0 && (
            <EmptyState
              title="No markets match these filters"
              description="No Vektor markets found. Create the first daily market."
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
