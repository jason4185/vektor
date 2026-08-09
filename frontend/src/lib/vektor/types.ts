/**
 * Vektor domain types.
 * These mirror the on-chain contract shapes so the mock service can be
 * swapped for a real GenLayer client without touching UI code.
 */

export type Instrument = "GBP/USD" | "USD/JPY" | "XAU/USD" | "XAG/USD";

export type InstrumentClass = "fx" | "metals";

export type Side = "UP" | "DOWN";

export type MarketStatus = "OPEN" | "CLOSED";

export type Outcome = "UP" | "DOWN" | "INCONCLUSIVE";

export interface InstrumentMeta {
  symbol: Instrument;
  name: string;
  klass: InstrumentClass;
  base: string;
  quote: string;
  decimals: number;
  blurb: string;
}

export interface ProtocolConfig {
  chain: string;
  contractAddress: string;
  nativeToken: "GEN";
  minStake: number;
  maxStakePerWallet: number;
  settlementDelaySeconds: number;
  protocolFeeBps: number;
  oracles: string[];
}

export interface PricePoint {
  /** ISO timestamp */
  t: string;
  /** price value */
  v: number;
}

export interface Market {
  id: string;
  instrument: Instrument;
  question: string;
  /** derived previous-weekday reference date, YYYY-MM-DD */
  referenceDate: string;
  /** target date, YYYY-MM-DD */
  targetDate: string;
  /** ISO timestamp when the target session closes */
  targetEnd: string;
  /** ISO timestamp from which settlement becomes permissionless */
  settlementEligibleAt: string;
  createdAt: string;
  creator: string;
  status: MarketStatus;
  /** total staked on UP, in GEN */
  upPool: number;
  /** total staked on DOWN, in GEN */
  downPool: number;
  /** implied probability of UP, in basis points */
  upBps: number;
  bettors: number;
  referencePrice: number | null;
  targetPrice: number | null;
  lastPrice: number;
  outcome: Outcome | null;
  series: PricePoint[];
}

export interface UserBet {
  marketId: string;
  side: Side;
  stake: number;
  placedAt: string;
  claimed: boolean;
}

export type PositionStatus = "ACTIVE" | "WON" | "LOST" | "REFUND_AVAILABLE" | "CLAIMED";

export interface Position {
  market: Market;
  bet: UserBet;
  status: PositionStatus;
  claimable: number;
}

export type ActivityKind = "CREATE" | "BET" | "SETTLE" | "CLAIM";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  marketId: string;
  instrument: Instrument;
  actor: string;
  amount: number | null;
  side: Side | null;
  outcome: Outcome | null;
  txHash: string;
  timestamp: string;
}

export interface MarketQuery {
  category?: "all" | "fx" | "metals" | "live" | "settling" | "resolved";
  instruments?: Instrument[];
  search?: string;
  sort?: "volume" | "newest" | "closing" | "activity";
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  referenceDate: string | null;
  question: string | null;
}

/** UI-only representation of a pending contract write. */
export type TxState =
  | { phase: "idle" }
  | { phase: "signing" }
  | { phase: "pending"; hash: string }
  | { phase: "success"; hash: string }
  | { phase: "error"; message: string };
