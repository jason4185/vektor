# Vektor

Permissionless daily FX and metals prediction markets powered by GenLayer.

## What Vektor is

Vektor lets users predict whether the target day's value will be UP or DOWN
versus the immediately previous weekday for:

- GBP/USD
- USD/JPY
- XAU/USD
- XAG/USD

The contract derives the previous-weekday reference date. Market creators do
not choose providers, URLs, parsing rules, or settlement outcomes.

## Why GenLayer matters

Settlement depends on external historical market facts. Vektor uses GenLayer
validator consensus to independently fetch and verify that evidence instead of
trusting the creator, frontend, or settlement caller.

FXRatesAPI and Fawaz each fetch their own reference and target values. Each
source independently derives a direction after fixed-point normalization. Both
sources must agree on UP or DOWN. Disagreement, ties, invalid evidence, or
unavailable evidence produce the documented inconclusive/retry behavior;
transient source failures do not falsely finalize a market.

## Permissionlessness and economics

- Anyone can create a bounded supported market.
- Anyone can settle an eligible market.
- The settlement caller cannot choose the outcome or evidence.
- There is no owner, admin, operator, keeper, or privileged cron role.
- Native GEN stake minimum: 1 GEN per transaction.
- Maximum cumulative stake: 10 GEN per wallet per market.
- Same-side top-ups are allowed; opposite-side staking is rejected.
- Normal winners receive pari-mutuel proportional payouts.
- INCONCLUSIVE markets refund original stakes.

## Lifecycle

```text
Create → Bet → Observation → Permissionless settlement
       → Validator consensus → UP / DOWN / INCONCLUSIVE → Claim
```

## Repository layout

- `contracts/Vektor.py` — production GenLayer Intelligent Contract.
- `frontend/` — Vektor web application and its single contract adapter boundary.
- `tests/direct/` — production direct-mode contract tests.
- `docs/` — current architecture and settlement notes.

Historical-only test artifacts are intentionally excluded from this repository.

## Frontend

The frontend is a polished preview application using a deterministic local
adapter until a GenLayer wallet/client implementation is configured. Its write
buttons produce clearly marked, non-broadcasting intents; no fake transaction
is presented as a chain submission. Public contract configuration belongs in
`frontend/.env` using the placeholders in `frontend/.env.example`.

From `frontend/`:

```bash
bun install --frozen-lockfile
bun run lint
bunx tsc --noEmit
bun run build
```

## Contract validation

From the repository root:

```bash
/private/tmp/vektor-test-venv312/bin/python -m pytest tests/direct -q
/private/tmp/vektor-test-venv312/bin/python -m py_compile contracts/Vektor.py
genvm-lint check contracts/Vektor.py --json
genvm-lint schema contracts/Vektor.py --json
genvm-lint typecheck contracts/Vektor.py --json
```

The production ABI is 4 writes, 15 views, and 19 total public methods.

## Security and limitations

- Settlement depends on two external historical providers and a unanimous
  2-of-2 directional result.
- The reference rule uses the immediately previous weekday, not a full holiday
  calendar.
- Integer payout rounding can leave small dust.
- Serialized JSON indexes have MVP-scale growth characteristics.
- Persistent provider downtime can delay settlement indefinitely; it does not
  silently create a false outcome.
- No contract or frontend deployment is performed by this repository workflow.
