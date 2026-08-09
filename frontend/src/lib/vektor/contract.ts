/**
 * Vektor contract adapter.
 *
 * This is the single boundary between the UI and the GenLayer contract.
 * Today it is backed by deterministic preview data; a real GenLayer client
 * can be supplied through `setVektorContract()` without changing the UI.
 *
 * Preview writes return descriptive non-broadcasting `TxIntent` values.
 */

import type {
  Instrument,
  Market,
  MarketQuery,
  Outcome,
  PositionStatus,
  ProtocolConfig,
  Side,
  UserBet,
  ValidationResult,
} from "./types";
import {
  ACTIVITY,
  DEMO_WALLET,
  INSTRUMENTS,
  MARKETS,
  PROTOCOL_CONFIG,
  USER_BETS,
  buildQuestion,
  isWeekend,
  previousWeekday,
} from "./mock-data";
import type { ActivityEvent, InstrumentMeta } from "./types";

/** Describes an unsigned contract write. The preview adapter never broadcasts. */
export interface TxIntent {
  method: string;
  args: Record<string, unknown>;
  value?: string;
  /** True once a real GenLayer client is connected. */
  broadcastable: boolean;
}

export interface VektorContract {
  /* ------------------------------------------------------------- writes */
  create_market(instrument: Instrument, target_date: string): Promise<TxIntent>;
  place_bet(market_id: string, side: Side, value: string): Promise<TxIntent>;
  settle_market(market_id: string): Promise<TxIntent>;
  claim_payout(market_id: string): Promise<TxIntent>;

  /* -------------------------------------------------------------- views */
  get_protocol_config(): Promise<ProtocolConfig>;
  get_supported_markets(): Promise<InstrumentMeta[]>;
  get_market(market_id: string): Promise<Market | null>;
  get_market_count(): Promise<number>;
  get_market_ids(): Promise<string[]>;
  get_markets(query?: MarketQuery): Promise<Market[]>;
  get_user_bet(market_id: string, address: string): Promise<UserBet | null>;
  get_user_market_ids(address: string): Promise<string[]>;
  get_due_market_ids(): Promise<string[]>;
  get_remaining_bet_capacity(market_id: string, address: string): Promise<number>;
  get_claimable_payout(market_id: string, address: string): Promise<number>;
  get_user_market_status(market_id: string, address: string): Promise<PositionStatus | null>;
  can_place_bet(
    market_id: string,
    address: string,
    side: Side,
    amount: number,
  ): Promise<{ allowed: boolean; reason: string | null }>;
  can_claim_payout(
    market_id: string,
    address: string,
  ): Promise<{ allowed: boolean; reason: string | null }>;
  validate_market_creation(instrument: Instrument, target_date: string): Promise<ValidationResult>;

  /* --------------------------------------- off-chain indexer conveniences */
  get_activity(): Promise<ActivityEvent[]>;
}

const latency = (ms = 220) => new Promise((r) => setTimeout(r, ms));

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function statusFor(market: Market, bet: UserBet): PositionStatus {
  if (market.status !== "CLOSED") return "ACTIVE";
  if (market.outcome === "INCONCLUSIVE") {
    return bet.claimed ? "CLAIMED" : "REFUND_AVAILABLE";
  }
  if (market.outcome === bet.side) return bet.claimed ? "CLAIMED" : "WON";
  return "LOST";
}

function payoutFor(market: Market, bet: UserBet): number {
  if (market.status !== "CLOSED") return 0;
  if (market.outcome === "INCONCLUSIVE") return bet.claimed ? 0 : bet.stake;
  if (market.outcome !== bet.side) return 0;
  if (bet.claimed) return 0;
  const winningPool = market.outcome === "UP" ? market.upPool : market.downPool;
  const total = market.upPool + market.downPool;
  return (bet.stake / winningPool) * total;
}

export class MockVektorContract implements VektorContract {
  /* ------------------------------------------------------------- writes */

  async create_market(instrument: Instrument, target_date: string): Promise<TxIntent> {
    await latency();
    return {
      method: "create_market",
      args: { instrument, target_date },
      broadcastable: false,
    };
  }

  async place_bet(market_id: string, side: Side, value: string): Promise<TxIntent> {
    await latency();
    return {
      method: "place_bet",
      args: { market_id, side },
      value,
      broadcastable: false,
    };
  }

  async settle_market(market_id: string): Promise<TxIntent> {
    await latency();
    return { method: "settle_market", args: { market_id }, broadcastable: false };
  }

  async claim_payout(market_id: string): Promise<TxIntent> {
    await latency();
    return { method: "claim_payout", args: { market_id }, broadcastable: false };
  }

  /* -------------------------------------------------------------- views */

  async get_protocol_config() {
    await latency(80);
    return clone(PROTOCOL_CONFIG);
  }

  async get_supported_markets() {
    await latency(80);
    return clone(INSTRUMENTS);
  }

  async get_market(market_id: string) {
    await latency();
    return clone(MARKETS.find((m) => m.id === market_id) ?? null);
  }

  async get_market_count() {
    await latency(60);
    return MARKETS.length;
  }

  async get_market_ids() {
    await latency(60);
    return MARKETS.map((m) => m.id);
  }

  async get_markets(query: MarketQuery = {}) {
    await latency(260);
    const { category = "all", instruments, search, sort = "volume" } = query;
    let out = clone(MARKETS);

    if (category === "fx" || category === "metals") {
      const symbols = INSTRUMENTS.filter((i) => i.klass === category).map((i) => i.symbol);
      out = out.filter((m) => symbols.includes(m.instrument));
    } else if (category === "live") {
      out = out.filter((m) => m.status === "OPEN");
    } else if (category === "settling") {
      out = out.filter((m) => m.status === "OPEN");
    } else if (category === "resolved") {
      out = out.filter((m) => m.status === "CLOSED");
    }

    if (instruments?.length) {
      out = out.filter((m) => instruments.includes(m.instrument));
    }

    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (m) =>
          m.instrument.toLowerCase().includes(q) ||
          m.question.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q),
      );
    }

    const total = (m: Market) => m.upPool + m.downPool;
    out.sort((a, b) => {
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "closing") return a.targetEnd.localeCompare(b.targetEnd);
      if (sort === "activity") return b.bettors - a.bettors;
      return total(b) - total(a);
    });

    return out;
  }

  async get_user_bet(market_id: string, address: string) {
    await latency(120);
    if (address !== DEMO_WALLET) return null;
    return clone(USER_BETS.find((b) => b.marketId === market_id) ?? null);
  }

  async get_user_market_ids(address: string) {
    await latency(120);
    if (address !== DEMO_WALLET) return [];
    return USER_BETS.map((b) => b.marketId);
  }

  async get_due_market_ids() {
    await latency(120);
    return MARKETS.filter((m) => m.status === "OPEN" && m.targetDate <= "2026-08-10").map(
      (m) => m.id,
    );
  }

  async get_remaining_bet_capacity(market_id: string, address: string) {
    await latency(100);
    const bet = address === DEMO_WALLET ? USER_BETS.find((b) => b.marketId === market_id) : null;
    return Math.max(0, PROTOCOL_CONFIG.maxStakePerWallet - (bet?.stake ?? 0));
  }

  async get_claimable_payout(market_id: string, address: string) {
    await latency(100);
    const market = MARKETS.find((m) => m.id === market_id);
    const bet = address === DEMO_WALLET ? USER_BETS.find((b) => b.marketId === market_id) : null;
    if (!market || !bet) return 0;
    return payoutFor(market, bet);
  }

  async get_user_market_status(market_id: string, address: string) {
    await latency(100);
    const market = MARKETS.find((m) => m.id === market_id);
    const bet = address === DEMO_WALLET ? USER_BETS.find((b) => b.marketId === market_id) : null;
    if (!market || !bet) return null;
    return statusFor(market, bet);
  }

  async can_place_bet(market_id: string, address: string, side: Side, amount: number) {
    await latency(90);
    const market = MARKETS.find((m) => m.id === market_id);
    if (!market) return { allowed: false, reason: "Market not found." };
    if (market.status === "CLOSED") {
      return { allowed: false, reason: "Market is closed to new positions." };
    }
    if (amount < PROTOCOL_CONFIG.minStake) {
      return { allowed: false, reason: `Minimum stake is ${PROTOCOL_CONFIG.minStake} GEN.` };
    }
    const existing =
      address === DEMO_WALLET ? USER_BETS.find((b) => b.marketId === market_id) : null;
    if (existing && existing.side !== side) {
      return {
        allowed: false,
        reason: `This wallet already holds ${existing.side}. Opposite-side positions are rejected.`,
      };
    }
    const remaining = PROTOCOL_CONFIG.maxStakePerWallet - (existing?.stake ?? 0);
    if (amount > remaining) {
      return { allowed: false, reason: `Remaining capacity is ${remaining} GEN for this wallet.` };
    }
    return { allowed: true, reason: null };
  }

  async can_claim_payout(market_id: string, address: string) {
    await latency(90);
    const status = await this.get_user_market_status(market_id, address);
    if (!status) return { allowed: false, reason: "No position in this market." };
    if (status === "ACTIVE") return { allowed: false, reason: "Market has not settled." };
    if (status === "LOST") return { allowed: false, reason: "Position did not win." };
    if (status === "CLAIMED") return { allowed: false, reason: "Already claimed." };
    return { allowed: true, reason: null };
  }

  async validate_market_creation(instrument: Instrument, target_date: string) {
    await latency(140);
    const errors: string[] = [];

    if (!INSTRUMENTS.some((i) => i.symbol === instrument)) {
      errors.push("Instrument is not in the supported set.");
    }
    if (!target_date) {
      errors.push("Select a target date.");
    } else {
      if (isWeekend(target_date)) errors.push("Target date must be a weekday session.");
      if (target_date < "2026-08-11") errors.push("Target date must be today or later.");
      if (MARKETS.some((m) => m.instrument === instrument && m.targetDate === target_date)) {
        errors.push("A market for this instrument and date already exists.");
      }
    }

    const valid = errors.length === 0;
    return {
      valid,
      errors,
      referenceDate: target_date && !isWeekend(target_date) ? previousWeekday(target_date) : null,
      question: valid ? buildQuestion(instrument, target_date) : null,
    } satisfies ValidationResult;
  }

  async get_activity() {
    await latency(200);
    return clone(ACTIVITY).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
}

let instance: VektorContract = new MockVektorContract();

export function getVektorContract(): VektorContract {
  return instance;
}

/** Replace the adapter once a real GenLayer client is available. */
export function setVektorContract(next: VektorContract) {
  instance = next;
}

export type { Outcome };
