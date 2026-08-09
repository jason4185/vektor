import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/vektor/disclosure";
import { INSTRUMENTS, PROTOCOL_CONFIG } from "@/lib/vektor/mock-data";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Vektor works — settlement by validator consensus" },
      {
        name: "description",
        content:
          "How Vektor derives reference dates, prices daily UP/DOWN markets pari-mutuel, and settles through GenLayer validator consensus over two independent price sources.",
      },
      { property: "og:title", content: "How Vektor works" },
      {
        property: "og:description",
        content:
          "Reference-date derivation, pari-mutuel payouts and validator-consensus settlement, explained.",
      },
    ],
  }),
  component: HowItWorks,
});

function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground">How Vektor works</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Vektor turns one honest question into a daily market: did this instrument finish the session
        above or below its previous weekday reference? No operator sets the line, no operator calls
        the result.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {INSTRUMENTS.map((i) => (
          <div key={i.symbol} className="panel p-4">
            <div className="num text-sm font-bold text-foreground">{i.symbol}</div>
            <div className="mt-1 text-xs text-muted-foreground">{i.name}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-3">
        <Disclosure title="Listing a market" eyebrow="Step 01" defaultOpen>
          <p>
            You pick an instrument and a weekday target session. The contract derives the reference
            date itself — the weekday immediately preceding the target — so the comparison window
            can never be gamed by the creator. The question text is generated on-chain and is
            immutable.
          </p>
        </Disclosure>

        <Disclosure title="Taking a position" eyebrow="Step 02">
          <p>
            Stake native GEN on UP or DOWN, minimum {PROTOCOL_CONFIG.minStake} and maximum{" "}
            {PROTOCOL_CONFIG.maxStakePerWallet} per wallet per market. You can top up the same side
            as often as you like within that cap. A bet on the opposite side from the same wallet is
            rejected outright — positions are directional, not hedged.
          </p>
        </Disclosure>

        <Disclosure title="Settlement and consensus" eyebrow="Step 03">
          <p>
            After the target session closes and the settlement window opens, any wallet can trigger
            settlement. Two independent sources — FXRatesAPI and the Fawaz historical currency data
            — each retrieve their <em>own</em> reference-session and target-session values and each
            derive a direction from their own numbers.
          </p>
          <p>
            GenLayer validators independently rerun that evidence gathering rather than trusting a
            single fetch. The market resolves UP or DOWN only when both source directions agree and
            validators reach consensus on that agreement. Anything else resolves INCONCLUSIVE.
          </p>
        </Disclosure>

        <Disclosure title="Payouts" eyebrow="Step 04">
          <p>
            Payouts are pari-mutuel: the winning side splits the entire pool pro-rata by stake, so
            your effective odds depend on how the pool filled, not on a quoted price at entry. An
            INCONCLUSIVE resolution refunds every original stake in full. Claims are pull-based —
            call claim_payout when you're ready.
          </p>
        </Disclosure>
      </div>

      <div className="panel mt-8 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Ready to take a side?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Today's sessions are already live on the book.
          </p>
        </div>
        <Button asChild className="shrink-0 font-semibold">
          <Link to="/">Browse markets</Link>
        </Button>
      </div>
    </div>
  );
}
