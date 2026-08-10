import assert from "node:assert/strict";
import { presentationStatus } from "../src/lib/vektor/timing.ts";
import type { Market } from "../src/lib/vektor/types.ts";

const market = (overrides: Partial<Market> = {}): Market => ({
  id: "0",
  instrument: "XAU/USD",
  question: "XAU/USD: UP or DOWN?",
  category: "METAL",
  referenceDate: "2026-08-07",
  targetDate: "2026-08-10",
  targetEnd: "2026-08-11T00:00:00.000Z",
  settlementEligibleAt: "2026-08-11T00:00:00.000Z",
  createdAt: "2026-08-09T12:00:00.000Z",
  status: "OPEN",
  displayStatus: "OBSERVATION_ACTIVE",
  settlementReady: false,
  upPool: 0,
  downPool: 0,
  upPoolUnits: 0n,
  downPoolUnits: 0n,
  upBps: 0,
  downBps: 0,
  outcome: "NONE",
  referencePrice: null,
  targetPrice: null,
  series: [],
  evidence: null,
  bettors: null,
  ...overrides,
});

const at = (iso: string) => Date.parse(iso);
const valid = market();
assert.equal(presentationStatus(valid, at("2026-08-09T23:59:59Z")), "BETTING_OPEN");
assert.equal(presentationStatus(valid, at("2026-08-10T00:00:00Z")), "OBSERVATION_ACTIVE");
assert.equal(presentationStatus(valid, at("2026-08-10T17:30:00Z")), "OBSERVATION_ACTIVE");
assert.equal(presentationStatus(valid, at("2026-08-10T23:59:59Z")), "OBSERVATION_ACTIVE");
assert.equal(presentationStatus(valid, at("2026-08-11T00:00:00Z")), "READY_FOR_SETTLEMENT");
assert.equal(presentationStatus(valid, at("2026-08-10T17:30:00+01:00")), "OBSERVATION_ACTIVE");

for (const invalid of [
  { targetDate: "", targetEnd: valid.targetEnd },
  { targetDate: valid.targetDate, targetEnd: null },
  { targetDate: valid.targetDate, targetEnd: "not-a-date" },
  { targetDate: valid.targetDate, targetEnd: "2026-08-09T00:00:00.000Z" },
]) {
  assert.equal(presentationStatus(market(invalid), at("2026-08-12T00:00:00Z")), "UNKNOWN");
}

assert.equal(
  presentationStatus(market({ status: "CLOSED", displayStatus: "INCONCLUSIVE" }), Date.now()),
  "INCONCLUSIVE",
);
console.log("Lifecycle and fail-closed timing smoke checks passed.");
