# Vektor architecture

```text
permissionless create_market(pair, target_date)
  -> contract-derived previous-weekday reference, question, and fixed metadata
  -> OPEN pooled UP/DOWN positions
  -> trading closes at target UTC day start
  -> after target UTC day ends, anyone calls settle_market
  -> FXRatesAPI and Fawaz independently fetch USD-base historical rates
  -> each source normalizes its own rates and derives a direction
  -> GenLayer validators repeat the source work and compare canonical fields
  -> empty winning side converts a source win to refundable INCONCLUSIVE
  -> CLOSED market resolves UP, DOWN, or INCONCLUSIVE
  -> claim pays proportional winnings or refunds principal
```

Supported mappings are GBP/USD = GBP reciprocal, USD/JPY = JPY direct,
XAU/USD = XAU reciprocal, and XAG/USD = XAG reciprocal. A creator supplies no
URL, provider, parser, or algorithm. The target is a validated weekday within
the creation window; the reference is deterministically the immediately
previous weekday. Creation is allowed on weekends when the target remains
future.

State remains compact: market JSON by numeric ID, a JSON ID list, user position
JSON, and a duplicate-key TreeMap. No DynRay-based storage is used. Automation
has no special authority because settlement is the same public method for every
caller.

The canonical question is short and deterministic, for example
`XAU/USD: UP or DOWN on Jan 5?`. Market records store the question, FX/METAL
category, directional labels, and fixed comparison rules. The read-only
`validate_market_creation` preview returns machine-readable validation reasons
without changing state; `create_market` remains authoritative.

Stake bounds are 1 GEN minimum per transaction and 10 GEN maximum cumulative
stake per wallet per market. Same-side deposits may top up until the cap; a
position cannot switch sides. Frontend reads expose immutable configuration,
the exact supported-market mapping, bounded summaries, user state, remaining
capacity, and deterministic claimability.

Wallet participation IDs are stored as compact per-wallet JSON arrays in a
TreeMap for bounded portfolio reads. Derived market display status,
settlement-ready state, pool-share basis points, and bounded due-market
discovery are read-only conveniences; due-market discovery paginates global
market-ID windows of at most 50 and returns scan progress. They do not alter
lifecycle or settlement authority.
