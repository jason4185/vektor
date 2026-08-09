# Vektor settlement

The fixed historical adapters are:

- FXRatesAPI: `https://api.fxratesapi.com/historical?date={date}&base=USD&currencies=GBP,JPY,XAU,XAG&resolution=1d&format=json`.
  The adapter validates `success`, USD base, requested historical date,
  `rates`, and the requested provider currency. No API key or secret is
  embedded; any provider authentication remains a deployment requirement.
- Fawaz primary:
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{date}/v1/currencies/usd.min.json`.
  Fallback:
  `https://{date}.currency-api.pages.dev/v1/currencies/usd.min.json`.
  The adapter validates the exact date and reads the nested `usd` object for
  `gbp`, `jpy`, `xau`, or `xag`. Primary transport/5xx or malformed data uses
  the same-date fallback; a second transient failure remains retryable.

The source-rate parser is deterministic and float-free. It uses a 12-decimal
intermediate integer scale. Normalization then produces canonical 6-decimal
prices: reciprocal pairs use `RATE_SCALE * SCALE // rate`, while USD/JPY uses
`rate * SCALE // RATE_SCALE`.

Each provider compares its own normalized reference and target prices. UP + UP
resolves UP; DOWN + DOWN resolves DOWN; any tie, disagreement, or invalid
evidence is INCONCLUSIVE. Prices from different providers are never averaged
or compared against each other.

After source consensus, finalization checks pool state. A source UP with zero
UP stake, or source DOWN with zero DOWN stake, becomes final INCONCLUSIVE. An
empty pool also becomes INCONCLUSIVE. This preserves the source result in
evidence while ensuring every deposited stake remains refundable. Normal
winners retain the proportional parimutuel payout; claims update state before
the native transfer and cannot repeat.

The read API returns full market JSON for detail pages and `get_markets`
returns bounded summaries with a limit of 1–50 for listings. `get_protocol_config`
reports the GEN unit, stake bounds, scales, source names, and permissionless
flags. Claimable amount is zero before finalization, for a loser, or after
claiming; it is the original stake for INCONCLUSIVE markets and the
proportional pool share for a winner.

Creation previews use the reason codes `VALID`, `UNSUPPORTED_INSTRUMENT`,
`INVALID_TARGET_DATE`, `NON_WEEKDAY_DATE`, `TARGET_OUTSIDE_CREATION_WINDOW`,
and `DUPLICATE_MARKET`.
