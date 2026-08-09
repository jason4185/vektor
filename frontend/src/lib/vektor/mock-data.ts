import type {
  ActivityEvent,
  Instrument,
  InstrumentMeta,
  Market,
  Outcome,
  PricePoint,
  ProtocolConfig,
  UserBet,
} from "./types";

export const INSTRUMENTS: InstrumentMeta[] = [
  {
    symbol: "GBP/USD",
    name: "Sterling / Dollar",
    klass: "fx",
    base: "GBP",
    quote: "USD",
    decimals: 4,
    blurb: "Cable. London-hours volatility, rate-differential driven.",
  },
  {
    symbol: "USD/JPY",
    name: "Dollar / Yen",
    klass: "fx",
    base: "USD",
    quote: "JPY",
    decimals: 3,
    blurb: "Carry-sensitive, reacts hard to yields and intervention talk.",
  },
  {
    symbol: "XAU/USD",
    name: "Gold / Dollar",
    klass: "metals",
    base: "XAU",
    quote: "USD",
    decimals: 2,
    blurb: "Gold spot. Real-rate and risk-hedge flows.",
  },
  {
    symbol: "XAG/USD",
    name: "Silver / Dollar",
    klass: "metals",
    base: "XAG",
    quote: "USD",
    decimals: 3,
    blurb: "Silver spot. Higher beta cousin of gold.",
  },
];

export const PROTOCOL_CONFIG: ProtocolConfig = {
  chain: import.meta.env["VITE_VEKTOR_NETWORK"] || "GenLayer",
  contractAddress: import.meta.env["VITE_VEKTOR_CONTRACT_ADDRESS"] || "Not configured",
  nativeToken: "GEN",
  minStake: 1,
  maxStakePerWallet: 10,
  settlementDelaySeconds: 86400,
  protocolFeeBps: 0,
  oracles: ["FXRatesAPI", "Fawaz Currency API"],
};

/* ---------------------------------------------------------------- helpers */

const BASE_PRICE: Record<Instrument, number> = {
  "GBP/USD": 1.2734,
  "USD/JPY": 152.418,
  "XAU/USD": 2418.62,
  "XAG/USD": 28.914,
};

const VOL: Record<Instrument, number> = {
  "GBP/USD": 0.0016,
  "USD/JPY": 0.22,
  "XAU/USD": 4.6,
  "XAG/USD": 0.14,
};

/** Deterministic pseudo-random so SSR and client render identically. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toISODate(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The contract's derivation: previous weekday before the target date. */
export function previousWeekday(targetDate: string): string {
  const d = new Date(`${targetDate}T00:00:00Z`);
  do {
    d.setUTCDate(d.getUTCDate() - 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return toISODate(d);
}

export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function buildQuestion(instrument: Instrument, targetDate: string): string {
  const date = new Date(`${targetDate}T00:00:00Z`);
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${instrument}: UP or DOWN on ${month} ${date.getUTCDate()}?`;
}

function buildSeries(instrument: Instrument, seed: number, points = 96, drift = 0): PricePoint[] {
  const rnd = seeded(seed);
  const base = BASE_PRICE[instrument];
  const vol = VOL[instrument];
  const out: PricePoint[] = [];
  let v = base;
  const start = Date.UTC(2026, 7, 6, 0, 0, 0);
  for (let i = 0; i < points; i++) {
    v += (rnd() - 0.5) * vol + (drift * vol) / points;
    out.push({
      t: new Date(start + i * 30 * 60 * 1000).toISOString(),
      v: Number(v.toFixed(instrument === "GBP/USD" ? 5 : 3)),
    });
  }
  return out;
}

/* ------------------------------------------------------------- market set */

interface Blueprint {
  id: string;
  instrument: Instrument;
  targetDate: string;
  status: Market["status"];
  upPool: number;
  downPool: number;
  bettors: number;
  outcome?: Outcome;
  creator: string;
  seed: number;
  drift: number;
}

const BLUEPRINTS: Blueprint[] = [
  {
    id: "vk-1042",
    instrument: "GBP/USD",
    targetDate: "2026-08-11",
    status: "OPEN",
    upPool: 184.5,
    downPool: 121.0,
    bettors: 47,
    creator: "demo-creator-a",
    seed: 11,
    drift: 3,
  },
  {
    id: "vk-1041",
    instrument: "XAU/USD",
    targetDate: "2026-08-11",
    status: "OPEN",
    upPool: 262.0,
    downPool: 98.5,
    bettors: 61,
    creator: "demo-creator-b",
    seed: 22,
    drift: 5,
  },
  {
    id: "vk-1040",
    instrument: "USD/JPY",
    targetDate: "2026-08-11",
    status: "OPEN",
    upPool: 44.0,
    downPool: 71.5,
    bettors: 19,
    creator: "demo-creator-c",
    seed: 33,
    drift: -4,
  },
  {
    id: "vk-1039",
    instrument: "XAG/USD",
    targetDate: "2026-08-11",
    status: "OPEN",
    upPool: 31.0,
    downPool: 27.0,
    bettors: 12,
    creator: "demo-creator-d",
    seed: 44,
    drift: 1,
  },
  {
    id: "vk-1038",
    instrument: "GBP/USD",
    targetDate: "2026-08-10",
    status: "OPEN",
    upPool: 210.0,
    downPool: 246.5,
    bettors: 73,
    creator: "demo-creator-a",
    seed: 55,
    drift: -6,
  },
  {
    id: "vk-1037",
    instrument: "XAU/USD",
    targetDate: "2026-08-10",
    status: "OPEN",
    upPool: 158.0,
    downPool: 143.0,
    bettors: 52,
    creator: "demo-creator-b",
    seed: 66,
    drift: 2,
  },
  {
    id: "vk-1036",
    instrument: "USD/JPY",
    targetDate: "2026-08-07",
    status: "CLOSED",
    upPool: 301.5,
    downPool: 188.0,
    bettors: 84,
    outcome: "UP",
    creator: "demo-creator-c",
    seed: 77,
    drift: 7,
  },
  {
    id: "vk-1035",
    instrument: "XAG/USD",
    targetDate: "2026-08-07",
    status: "CLOSED",
    upPool: 96.0,
    downPool: 174.5,
    bettors: 39,
    outcome: "DOWN",
    creator: "demo-creator-d",
    seed: 88,
    drift: -8,
  },
  {
    id: "vk-1034",
    instrument: "XAU/USD",
    targetDate: "2026-08-06",
    status: "CLOSED",
    upPool: 129.0,
    downPool: 133.5,
    bettors: 41,
    outcome: "INCONCLUSIVE",
    creator: "demo-creator-b",
    seed: 99,
    drift: 0,
  },
  {
    id: "vk-1033",
    instrument: "GBP/USD",
    targetDate: "2026-08-06",
    status: "CLOSED",
    upPool: 222.0,
    downPool: 91.5,
    bettors: 58,
    outcome: "UP",
    creator: "demo-creator-a",
    seed: 111,
    drift: 6,
  },
  {
    id: "vk-1032",
    instrument: "USD/JPY",
    targetDate: "2026-08-05",
    status: "CLOSED",
    upPool: 77.0,
    downPool: 164.0,
    bettors: 36,
    outcome: "DOWN",
    creator: "demo-creator-c",
    seed: 122,
    drift: -5,
  },
  {
    id: "vk-1031",
    instrument: "XAG/USD",
    targetDate: "2026-08-05",
    status: "CLOSED",
    upPool: 143.5,
    downPool: 118.0,
    bettors: 44,
    outcome: "UP",
    creator: "demo-creator-d",
    seed: 133,
    drift: 4,
  },
];

function toMarket(b: Blueprint): Market {
  const referenceDate = previousWeekday(b.targetDate);
  const total = b.upPool + b.downPool;
  const upBps = total === 0 ? 5000 : Math.round((b.upPool / total) * 10000);
  const series = buildSeries(b.instrument, b.seed, 96, b.drift);
  const referencePrice = series[24]!.v;
  const lastPrice = series[series.length - 1]!.v;
  const resolved = b.status === "CLOSED";

  return {
    id: b.id,
    instrument: b.instrument,
    question: buildQuestion(b.instrument, b.targetDate),
    referenceDate,
    targetDate: b.targetDate,
    targetEnd: new Date(Date.parse(`${b.targetDate}T00:00:00Z`) + 86400000).toISOString(),
    settlementEligibleAt: new Date(
      Date.parse(`${b.targetDate}T00:00:00Z`) + 86400000,
    ).toISOString(),
    createdAt: `${referenceDate}T09:12:44Z`,
    creator: b.creator,
    status: b.status,
    upPool: b.upPool,
    downPool: b.downPool,
    upBps,
    bettors: b.bettors,
    referencePrice,
    targetPrice: resolved ? lastPrice : null,
    lastPrice,
    outcome: b.outcome ?? null,
    series,
  };
}

export const MARKETS: Market[] = BLUEPRINTS.map(toMarket);

/* ------------------------------------------------------------ user state */

export const DEMO_WALLET = "demo-wallet";

export const USER_BETS: UserBet[] = [
  { marketId: "vk-1042", side: "UP", stake: 6, placedAt: "2026-08-10T14:02:11Z", claimed: false },
  { marketId: "vk-1041", side: "UP", stake: 10, placedAt: "2026-08-10T16:44:03Z", claimed: false },
  { marketId: "vk-1038", side: "DOWN", stake: 4, placedAt: "2026-08-09T11:20:55Z", claimed: false },
  { marketId: "vk-1036", side: "UP", stake: 5, placedAt: "2026-08-06T18:31:07Z", claimed: false },
  { marketId: "vk-1035", side: "UP", stake: 3, placedAt: "2026-08-06T09:15:22Z", claimed: false },
  { marketId: "vk-1034", side: "DOWN", stake: 7, placedAt: "2026-08-05T13:47:39Z", claimed: false },
  { marketId: "vk-1033", side: "UP", stake: 8, placedAt: "2026-08-05T08:04:18Z", claimed: true },
];

export const ACTIVITY: ActivityEvent[] = [
  {
    id: "ev-91",
    kind: "BET",
    marketId: "vk-1041",
    instrument: "XAU/USD",
    actor: "demo-wallet",
    amount: 10,
    side: "UP",
    outcome: null,
    txHash: "demo-tx-91",
    timestamp: "2026-08-10T16:44:03Z",
  },
  {
    id: "ev-90",
    kind: "BET",
    marketId: "vk-1042",
    instrument: "GBP/USD",
    actor: "demo-trader-a",
    amount: 3.5,
    side: "DOWN",
    outcome: null,
    txHash: "demo-tx-90",
    timestamp: "2026-08-10T16:12:48Z",
  },
  {
    id: "ev-89",
    kind: "CREATE",
    marketId: "vk-1039",
    instrument: "XAG/USD",
    actor: "demo-creator-d",
    amount: null,
    side: null,
    outcome: null,
    txHash: "demo-tx-89",
    timestamp: "2026-08-10T15:03:29Z",
  },
  {
    id: "ev-88",
    kind: "BET",
    marketId: "vk-1042",
    instrument: "GBP/USD",
    actor: "demo-wallet",
    amount: 6,
    side: "UP",
    outcome: null,
    txHash: "demo-tx-88",
    timestamp: "2026-08-10T14:02:11Z",
  },
  {
    id: "ev-87",
    kind: "SETTLE",
    marketId: "vk-1036",
    instrument: "USD/JPY",
    actor: "demo-creator-c",
    amount: null,
    side: null,
    outcome: "UP",
    txHash: "demo-tx-87",
    timestamp: "2026-08-08T22:04:51Z",
  },
  {
    id: "ev-86",
    kind: "CLAIM",
    marketId: "vk-1033",
    instrument: "GBP/USD",
    actor: "demo-wallet",
    amount: 11.4,
    side: "UP",
    outcome: null,
    txHash: "demo-tx-86",
    timestamp: "2026-08-07T10:22:16Z",
  },
  {
    id: "ev-85",
    kind: "SETTLE",
    marketId: "vk-1035",
    instrument: "XAG/USD",
    actor: "demo-creator-a",
    amount: null,
    side: null,
    outcome: "DOWN",
    txHash: "demo-tx-85",
    timestamp: "2026-08-07T22:01:09Z",
  },
  {
    id: "ev-84",
    kind: "SETTLE",
    marketId: "vk-1034",
    instrument: "XAU/USD",
    actor: "demo-creator-b",
    amount: null,
    side: null,
    outcome: "INCONCLUSIVE",
    txHash: "demo-tx-84",
    timestamp: "2026-08-06T22:00:37Z",
  },
  {
    id: "ev-83",
    kind: "BET",
    marketId: "vk-1038",
    instrument: "GBP/USD",
    actor: "demo-wallet",
    amount: 4,
    side: "DOWN",
    outcome: null,
    txHash: "demo-tx-83",
    timestamp: "2026-08-09T11:20:55Z",
  },
  {
    id: "ev-82",
    kind: "CREATE",
    marketId: "vk-1042",
    instrument: "GBP/USD",
    actor: "demo-creator-a",
    amount: null,
    side: null,
    outcome: null,
    txHash: "demo-tx-82",
    timestamp: "2026-08-09T09:12:44Z",
  },
];
