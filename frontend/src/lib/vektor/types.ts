export type Instrument = "GBP/USD" | "USD/JPY" | "XAU/USD" | "XAG/USD";
export type InstrumentClass = "fx" | "metals";
export type Side = "UP" | "DOWN";
export type MarketStatus = "OPEN" | "CLOSED";
export type Outcome = "NONE" | "UP" | "DOWN" | "INCONCLUSIVE";
export type DisplayStatus =
  "BETTING_OPEN" | "OBSERVATION_ACTIVE" | "READY_FOR_SETTLEMENT" | "SETTLED" | "INCONCLUSIVE";
export type UserResult =
  "NOT_PARTICIPATED" | "PENDING" | "WON" | "LOST" | "REFUND_AVAILABLE" | "CLAIMED";
export type ClaimType = "WIN" | "REFUND" | "NONE";

export interface InstrumentMeta {
  instrument: Instrument;
  display_symbol: string;
  category: "FX" | "METAL";
  provider_currency: string;
  reciprocal: boolean;
  symbol?: Instrument;
  name?: string;
  klass?: InstrumentClass;
  base?: string;
  quote?: string;
  decimals?: number;
  blurb?: string;
}
export interface ProtocolConfig {
  name: string;
  version: string;
  market_type: string;
  price_scale: string;
  source_rate_scale: string;
  gen_unit: string;
  min_stake: string;
  max_stake: string;
  settlement_sources: string[];
  permissionless_creation: boolean;
  permissionless_settlement: boolean;
  outcomes: Outcome[];
  chain: string;
  contractAddress: string;
  minStake: number;
  maxStakePerWallet: number;
  protocolFeeBps: number;
  oracles: string[];
}
export interface PricePoint {
  t: string;
  v: number;
}
export interface Evidence {
  ar: string;
  at: string;
  av: boolean;
  br: string;
  bt: string;
  bv: boolean;
  ad: string;
  bd: string;
  outcome: Outcome;
  final_outcome?: Outcome;
}
export interface Market {
  id: string;
  instrument: Instrument;
  question: string;
  category: "FX" | "METAL";
  referenceDate: string;
  targetDate: string;
  targetEnd: string;
  settlementEligibleAt: string;
  createdAt: string;
  status: MarketStatus;
  displayStatus: DisplayStatus;
  settlementReady: boolean;
  upPool: number;
  downPool: number;
  upBps: number;
  downBps: number;
  outcome: Outcome;
  referencePrice: number | null;
  targetPrice: number | null;
  series: PricePoint[];
  evidence: Evidence | null;
  creator: string;
  bettors: number | null;
  marketType?: string;
}
export interface MarketQuery {
  category?: "all" | "fx" | "metals" | "live" | "settling" | "resolved";
  instruments?: Instrument[];
  search?: string;
  sort?: "volume" | "newest" | "closing" | "activity";
}
export interface UserBet {
  side: "NONE" | Side;
  stake: number;
  claimed: boolean;
}
export interface UserMarketStatus {
  market_id: string;
  wallet: string;
  side: "NONE" | Side;
  stake: number;
  claimed: boolean;
  status: MarketStatus;
  outcome: Outcome;
  can_claim: boolean;
  claim_type: ClaimType;
  claimable_amount: number;
  user_result: UserResult;
  remaining_bet_capacity: number;
  can_place_bet: boolean;
  betting_open: boolean;
  resolved: boolean;
}
export interface ValidationResult {
  valid: boolean;
  reason: string;
  instrument: string;
  category: string;
  question: string;
  reference_date: string;
  target_date: string;
  betting_close: string;
  settlement_eligible: string;
  duplicate_market_id: string;
}
export interface Page<T> {
  items: T[];
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
  nextOffset?: number;
  scanned?: number;
}
export interface Position {
  market: Market;
  bet: UserBet;
  status: UserResult;
  claimable: number;
}
export interface TxState {
  phase:
    | "idle"
    | "preparing"
    | "wallet_confirmation"
    | "submitted"
    | "processing"
    | "completed"
    | "cancelled"
    | "failed"
    | "uncertain";
  hash?: string;
  message?: string;
}

export interface WriteResult {
  hash: string;
  confirmed: boolean;
}

export type WriteProgressPhase = "submitted" | "processing" | "completed" | "uncertain";
export interface WriteProgress {
  phase: WriteProgressPhase;
  hash: string;
}
export interface WriteOptions {
  onProgress?: (progress: WriteProgress) => void;
}
