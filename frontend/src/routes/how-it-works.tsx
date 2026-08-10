import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/vektor/disclosure";
import { useQuery } from "@tanstack/react-query";
import { protocolConfigQuery, supportedMarketsQuery } from "@/lib/vektor/queries";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Vektor works — simple daily markets" },
      {
        name: "description",
        content:
          "Learn how Vektor compares daily FX and metals markets, decides results, and pays winners.",
      },
      { property: "og:title", content: "How Vektor works" },
      {
        property: "og:description",
        content: "Choose a market, stake GEN, and claim your payout or refund.",
      },
    ],
  }),
  component: HowItWorks,
});

function HowItWorks() {
  const { data: instruments = [] } = useQuery(supportedMarketsQuery());
  const { data: protocol } = useQuery(protocolConfigQuery());
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="label-xs text-primary">Protocol guide</div>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground">
        How Vektor works
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Vektor makes daily markets simple: choose whether an instrument will finish UP or DOWN
        compared with the previous trading day.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-4">
        {instruments.map((i) => (
          <div key={i.instrument} className="panel p-4">
            <div className="num text-sm font-bold text-foreground">{i.instrument}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {i.category === "METAL" ? "Metals" : "FX"}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        <Disclosure title="Choose a market" eyebrow="Step 01" defaultOpen>
          <p>
            Pick GBP/USD, USD/JPY, Gold, or Silver. Choose a prediction day. Vektor compares it with
            the previous trading day.
          </p>
        </Disclosure>

        <Disclosure title="Choose UP or DOWN" eyebrow="Step 02">
          <p>
            Stake GEN on UP or DOWN. The minimum is {protocol?.minStake ?? 1} GEN and the maximum is{" "}
            {protocol?.maxStakePerWallet ?? 10} GEN per market. You can add more to the same side,
            but you cannot choose both sides.
          </p>
        </Disclosure>

        <Disclosure title="See the market result" eyebrow="Step 03">
          <p>
            After prediction day ends, anyone can settle the market. FXRatesAPI and Fawaz each check
            the prices for both dates and decide UP or DOWN from their own data.
          </p>
          <p>
            GenLayer helps verify the result with more than one source, so no single person decides
            the outcome. Both sources must agree. If they disagree or the result cannot be
            confirmed, you receive a refund.
          </p>
        </Disclosure>

        <Disclosure title="Claim your payout" eyebrow="Step 04">
          <p>
            Winners share the full pool based on how much they staked. If the result is If the
            result cannot be confirmed, every original stake can be refunded. Claim your payout when
            the market is finished.
          </p>
        </Disclosure>
      </div>

      <div className="panel mt-8 flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Ready to choose a side?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse today's markets and make your prediction.
          </p>
        </div>
        <Button asChild className="shrink-0 font-semibold">
          <Link to="/">Browse markets</Link>
        </Button>
      </div>
    </div>
  );
}
