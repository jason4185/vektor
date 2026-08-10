/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "genlayer-js";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import { formatUnits, parseUnits } from "viem";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import {
  CONTRACT_EXPLORER,
  GENLAYER_CHAIN,
  GENLAYER_RPC_ENDPOINT,
  MARKET_PAGE_SIZE,
  requireContractAddress,
} from "./config";
import type {
  Evidence,
  Instrument,
  InstrumentMeta,
  Market,
  MarketQuery,
  Page,
  Position,
  ProtocolConfig,
  Side,
  UserBet,
  UserMarketStatus,
  ValidationResult,
  WriteResult,
  WriteOptions,
} from "./types";
import { presentationStatus } from "./timing";

type AnyClient = {
  readContract(args: Record<string, unknown>): Promise<unknown>;
  writeContract(args: Record<string, unknown>): Promise<unknown>;
  waitForTransactionReceipt(args: Record<string, unknown>): Promise<any>;
};
type RawMarket = any;

const client = () =>
  createClient({
    chain: GENLAYER_CHAIN as any,
    endpoint: GENLAYER_RPC_ENDPOINT,
  }) as unknown as AnyClient;
const raw = (value: unknown): any => (typeof value === "string" ? JSON.parse(value) : value);
const text = (value: unknown) => String(value ?? "");
const gen = (value: unknown) => Number(formatUnits(BigInt(text(value)), 18));
const timestamp = (value: unknown): string | null => {
  const s = text(value);
  if (!s || s === "0") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`;
  try {
    const seconds = Number(BigInt(s));
    return Number.isSafeInteger(seconds) && seconds > 0
      ? new Date(seconds * 1000).toISOString()
      : null;
  } catch {
    return null;
  }
};
const genUnits = (value: unknown) => BigInt(text(value));
const price = (value: unknown) => {
  const n = Number(BigInt(text(value))) / 1_000_000;
  return Number.isFinite(n) ? n : null;
};

async function read(functionName: string, args: unknown[] = []) {
  return client().readContract({
    address: requireContractAddress(),
    functionName,
    args,
    // GenLayerJS 1.1.x exposes the accepted/non-final state through this
    // transaction-hash variant rather than a stateStatus option.
    transactionHashVariant: "latest-nonfinal",
  });
}

function evidenceOf(value: unknown): Evidence | null {
  if (!value) return null;
  const e = value as Record<string, any>;
  return typeof e === "object" && "ar" in e ? (e as Evidence) : null;
}

function mapMarket(value: unknown, summary = false): Market {
  const m = value as RawMarket;
  const evidence = evidenceOf(m.evidence ? raw(m.evidence) : null);
  return {
    id: text(m.id),
    instrument: m.instrument as Instrument,
    question: text(m.question),
    category: m.category === "METAL" ? "METAL" : "FX",
    referenceDate: text(m.reference_date),
    targetDate: text(m.target_date),
    // get_markets exposes the same boundary as `settlement_eligible`; the
    // detailed get_market view exposes it as `target_end`.
    targetEnd: timestamp(m.target_end ?? m.settlement_eligible),
    settlementEligibleAt: timestamp(m.settlement_eligible ?? m.target_end),
    createdAt: timestamp(m.created),
    status: m.status,
    displayStatus: m.display_status,
    settlementReady: Boolean(m.settlement_ready),
    upPool: gen(m.up_total ?? m.up),
    downPool: gen(m.down_total ?? m.down),
    upPoolUnits: genUnits(m.up_total ?? m.up),
    downPoolUnits: genUnits(m.down_total ?? m.down),
    upBps: Number(m.up_bps ?? 0),
    downBps: Number(m.down_bps ?? 0),
    outcome: m.outcome,
    referencePrice: evidence ? price(evidence.ar) : null,
    targetPrice: evidence ? price(evidence.at) : null,
    series: [],
    evidence,
    bettors: summary ? null : null,
    marketType: m.market_type,
  };
}

function mapPage(value: unknown): Page<Market> {
  const p = raw(value) as any;
  const total = Number(p.total);
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error("Market pagination returned an invalid total.");
  }
  const markets = p.markets ?? [];
  return {
    items: markets.map((m: unknown) => mapMarket(m, true)),
    offset: Number(p.offset),
    limit: Number(p.limit),
    total,
    hasMore: Number(p.offset) + markets.length < total,
  };
}

export interface VektorContract {
  create_market(
    instrument: Instrument,
    target_date: string,
    options?: WriteOptions,
  ): Promise<WriteResult>;
  place_bet(
    market_id: string,
    side: Side,
    value: string,
    options?: WriteOptions,
  ): Promise<WriteResult>;
  settle_market(market_id: string, options?: WriteOptions): Promise<WriteResult>;
  claim_payout(market_id: string, options?: WriteOptions): Promise<WriteResult>;
  get_protocol_config(): Promise<ProtocolConfig>;
  get_supported_markets(): Promise<InstrumentMeta[]>;
  get_market(market_id: string): Promise<Market>;
  get_market_count(): Promise<number>;
  get_market_ids(): Promise<string[]>;
  get_markets(query?: MarketQuery): Promise<Page<Market>>;
  get_user_bet(market_id: string, address: string): Promise<UserBet>;
  get_user_market_ids(address: string, offset?: number, limit?: number): Promise<Page<string>>;
  get_due_market_ids(offset?: number, limit?: number): Promise<Page<string>>;
  get_remaining_bet_capacity(market_id: string, address: string): Promise<number>;
  get_claimable_payout(market_id: string, address: string): Promise<number>;
  get_user_market_status(market_id: string, address: string): Promise<UserMarketStatus>;
  can_place_bet(market_id: string, address: string, side: Side, amount: string): Promise<boolean>;
  can_claim_payout(market_id: string, address: string): Promise<boolean>;
  validate_market_creation(instrument: Instrument, target_date: string): Promise<ValidationResult>;
}

export const vektorContract: VektorContract = {
  async get_protocol_config() {
    const p = raw(await read("get_protocol_config")) as any;
    return {
      ...p,
      chain: GENLAYER_CHAIN.name,
      contractAddress: requireContractAddress(),
      minStake: gen(p.min_stake),
      maxStakePerWallet: gen(p.max_stake),
      protocolFeeBps: 0,
      oracles: p.settlement_sources,
    };
  },
  async get_supported_markets() {
    return raw(await read("get_supported_markets")) as InstrumentMeta[];
  },
  async get_market(market_id) {
    return mapMarket(raw(await read("get_market", [BigInt(market_id)])));
  },
  async get_market_count() {
    return Number(await read("get_market_count"));
  },
  async get_market_ids() {
    return raw(await read("get_market_ids")) as string[];
  },
  async get_markets(query = {}) {
    const pages: Page<Market>[] = [];
    let offset = 0;
    const seenOffsets = new Set<number>();
    for (let iteration = 0; iteration < 1000; iteration += 1) {
      if (seenOffsets.has(offset)) throw new Error("Market pagination did not advance.");
      seenOffsets.add(offset);
      const page = mapPage(await read("get_markets", [BigInt(offset), BigInt(MARKET_PAGE_SIZE)]));
      pages.push(page);
      if (!page.hasMore) break;
      const nextOffset = page.offset + page.items.length;
      if (nextOffset <= offset || page.items.length === 0)
        throw new Error("Market pagination returned invalid metadata.");
      offset = nextOffset;
      if (iteration === 999) throw new Error("Market pagination exceeded safety limit.");
    }
    const items = [...new Map(pages.flatMap((page) => page.items).map((m) => [m.id, m])).values()];
    const page = {
      items,
      offset: 0,
      limit: MARKET_PAGE_SIZE,
      total: items.length,
      hasMore: false,
    } satisfies Page<Market>;
    let filtered = page.items;
    const now = Date.now();
    if (query.category === "fx") filtered = filtered.filter((m) => m.category === "FX");
    if (query.category === "metals") filtered = filtered.filter((m) => m.category === "METAL");
    if (query.category === "live")
      filtered = filtered.filter((m) => {
        const phase = presentationStatus(m, now);
        return phase === "BETTING_OPEN" || phase === "OBSERVATION_ACTIVE";
      });
    if (query.category === "settling")
      filtered = filtered.filter((m) => presentationStatus(m, now) === "READY_FOR_SETTLEMENT");
    if (query.category === "resolved") filtered = filtered.filter((m) => m.status === "CLOSED");
    if (query.instruments?.length)
      filtered = filtered.filter((m) => query.instruments?.includes(m.instrument));
    if (query.search?.trim()) {
      const q = query.search.trim().toLowerCase();
      filtered = filtered.filter((m) => `${m.instrument} ${m.question}`.toLowerCase().includes(q));
    }
    filtered.sort((a, b) =>
      query.sort === "newest"
        ? Number(b.id) - Number(a.id)
        : query.sort === "closing"
          ? (a.targetEnd ?? "").localeCompare(b.targetEnd ?? "")
          : b.upPool + b.downPool - a.upPool - a.downPool,
    );
    return { ...page, total: filtered.length, items: filtered };
  },
  async get_user_bet(market_id, address) {
    const p = raw(await read("get_user_bet", [BigInt(market_id), address])) as any;
    return { side: p.side, stake: gen(p.stake), claimed: Boolean(p.claimed) };
  },
  async get_user_market_ids(address, offset = 0, limit = MARKET_PAGE_SIZE) {
    const p = raw(
      await read("get_user_market_ids", [address, BigInt(offset), BigInt(limit)]),
    ) as any;
    return {
      items: p.market_ids as string[],
      offset: Number(p.offset),
      limit: Number(p.limit),
      total: Number(p.total),
      hasMore: Boolean(p.has_more),
    };
  },
  async get_due_market_ids(offset = 0, limit = MARKET_PAGE_SIZE) {
    const p = raw(await read("get_due_market_ids", [BigInt(offset), BigInt(limit)])) as any;
    return {
      items: p.market_ids as string[],
      offset: Number(p.offset),
      limit: Number(p.limit),
      total: null,
      hasMore: Boolean(p.has_more),
      nextOffset: Number(p.next_offset),
      scanned: Number(p.scanned),
    };
  },
  async get_remaining_bet_capacity(market_id, address) {
    return gen(await read("get_remaining_bet_capacity", [BigInt(market_id), address]));
  },
  async get_claimable_payout(market_id, address) {
    return gen(await read("get_claimable_payout", [BigInt(market_id), address]));
  },
  async get_user_market_status(market_id, address) {
    const p = raw(await read("get_user_market_status", [BigInt(market_id), address])) as any;
    return {
      ...p,
      stake: gen(p.stake),
      claimable_amount: gen(p.claimable_amount),
      remaining_bet_capacity: gen(p.remaining_bet_capacity),
    } as UserMarketStatus;
  },
  async can_place_bet(market_id, address, side, amount) {
    return Boolean(
      await read("can_place_bet", [BigInt(market_id), address, side, parseUnits(amount, 18)]),
    );
  },
  async can_claim_payout(market_id, address) {
    return Boolean(await read("can_claim_payout", [BigInt(market_id), address]));
  },
  async validate_market_creation(instrument, target_date) {
    return raw(
      await read("validate_market_creation", [instrument, target_date]),
    ) as ValidationResult;
  },
  async create_market(instrument, target_date, options?: WriteOptions) {
    return submit("create_market", [instrument, target_date], 0n, options);
  },
  async place_bet(market_id, side, value, options?: WriteOptions) {
    return submit("place_bet", [BigInt(market_id), side], parseUnits(value, 18), options);
  },
  async settle_market(market_id, options?: WriteOptions) {
    return submit("settle_market", [BigInt(market_id)], 0n, options);
  },
  async claim_payout(market_id, options?: WriteOptions) {
    return submit("claim_payout", [BigInt(market_id)], 0n, options);
  },
};

let activeWallet: { connector: Connector; account: Address } | null = null;
export function setActiveWallet(wallet: { connector: Connector; account: Address } | null) {
  activeWallet = wallet;
}

async function submit(
  functionName: string,
  args: unknown[],
  value = 0n,
  options?: WriteOptions,
): Promise<WriteResult> {
  if (!activeWallet) throw new Error("Connect an injected wallet before submitting.");
  const provider = await activeWallet.connector.getProvider();
  const request = (
    provider as { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
  ).request;
  if (!request) throw new Error("Your wallet could not be used. Try reconnecting it.");
  const accounts = await request({ method: "eth_accounts" });
  if (
    !Array.isArray(accounts) ||
    String(accounts[0]).toLowerCase() !== activeWallet.account.toLowerCase()
  )
    throw new Error("Connected wallet account changed. Reconnect and try again.");
  const chainId = await request({ method: "eth_chainId" });
  if (String(chainId).toLowerCase() !== `0x${GENLAYER_CHAIN.id.toString(16)}`)
    throw new Error(`Switch your wallet to ${GENLAYER_CHAIN.name}.`);
  const writeClient = createClient({
    chain: GENLAYER_CHAIN as any,
    endpoint: GENLAYER_RPC_ENDPOINT,
    account: activeWallet.account,
    provider,
  }) as unknown as AnyClient;
  const result = await writeClient.writeContract({
    address: requireContractAddress(),
    functionName,
    args,
    value,
  });
  const hash = String(result);
  options?.onProgress?.({ phase: "submitted", hash });
  options?.onProgress?.({ phase: "processing", hash });
  const receiptPromise = writeClient.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    interval: 2_000,
    retries: 60,
  });
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), 150_000);
  });
  const receipt = await Promise.race([receiptPromise, timeoutPromise]);
  if (timeoutId !== undefined) clearTimeout(timeoutId);
  if (receipt === null) {
    options?.onProgress?.({ phase: "uncertain", hash });
    return { hash, confirmed: false };
  }
  if (receipt?.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR)
    throw new Error("This action could not be completed.");
  if (receipt?.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    options?.onProgress?.({ phase: "uncertain", hash });
    return { hash, confirmed: false };
  }
  options?.onProgress?.({ phase: "completed", hash });
  return {
    hash,
    confirmed: true,
  };
}

export function transactionExplorer(hash: string) {
  return `${CONTRACT_EXPLORER}/tx/${hash}`;
}
export function formatNative(value: string) {
  return formatUnits(BigInt(value), 18);
}
export function nativeValue(value: string) {
  return parseUnits(value, 18);
}
export async function loadPosition(address: string, marketId: string): Promise<Position> {
  const [market, status] = await Promise.all([
    vektorContract.get_market(marketId),
    vektorContract.get_user_market_status(marketId, address),
  ]);
  return {
    market,
    bet: { side: status.side, stake: status.stake, claimed: status.claimed },
    status: status.user_result,
    claimable: status.claimable_amount,
  };
}
