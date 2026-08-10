import { queryOptions } from "@tanstack/react-query";
import { MARKET_PAGE_SIZE } from "./config";
import { loadPosition, vektorContract } from "./contract";
import type { Instrument, MarketQuery } from "./types";

const retry = 2;
const base = { retry, refetchOnWindowFocus: true } as const;
function marketQueryKey(query: MarketQuery) {
  return [
    query.category ?? "all",
    [...(query.instruments ?? [])].sort().join(","),
    query.search?.trim().toLowerCase() ?? "",
    query.sort ?? "volume",
  ];
}
export const protocolConfigQuery = () =>
  queryOptions({
    ...base,
    queryKey: ["vektor", "protocol"],
    queryFn: () => vektorContract.get_protocol_config(),
    staleTime: 900_000,
  });
export const supportedMarketsQuery = () =>
  queryOptions({
    ...base,
    queryKey: ["vektor", "supported-markets"],
    queryFn: () => vektorContract.get_supported_markets(),
    staleTime: 900_000,
  });
export const marketsQuery = (query: MarketQuery) =>
  queryOptions({
    ...base,
    queryKey: ["vektor", "markets", ...marketQueryKey(query)],
    queryFn: () => vektorContract.get_markets(query),
    placeholderData: (previous) => previous,
    refetchInterval: 15_000,
  });
export const marketQuery = (id: string) =>
  queryOptions({
    ...base,
    queryKey: ["vektor", "market", id],
    queryFn: () => vektorContract.get_market(id),
    placeholderData: (previous) => previous,
    refetchInterval: (query) => {
      const m = query.state.data;
      if (!m) return 10_000;
      if (m.status === "CLOSED") return 120_000;
      if (m.displayStatus === "OBSERVATION_ACTIVE") return 18_000;
      return 10_000;
    },
  });
export const userBetQuery = (marketId: string, address: string | null) =>
  queryOptions({
    ...base,
    queryKey: ["vektor", "user-bet", marketId, address],
    enabled: Boolean(address),
    queryFn: () => vektorContract.get_user_bet(marketId, address!),
    refetchInterval: 18_000,
  });
export const userStatusQuery = (marketId: string, address: string | null) =>
  queryOptions({
    ...base,
    queryKey: ["vektor", "user-status", marketId, address],
    enabled: Boolean(address),
    queryFn: () => vektorContract.get_user_market_status(marketId, address!),
    refetchInterval: 18_000,
  });
export const remainingCapacityQuery = (marketId: string, address: string | null) =>
  queryOptions({
    ...base,
    queryKey: ["vektor", "capacity", marketId, address],
    enabled: Boolean(address),
    queryFn: () => vektorContract.get_remaining_bet_capacity(marketId, address!),
    refetchInterval: 20_000,
  });
export const userMarketIdsQuery = (address: string | null) =>
  queryOptions({
    ...base,
    queryKey: ["vektor", "user-markets", address],
    enabled: Boolean(address),
    queryFn: () => vektorContract.get_user_market_ids(address!, 0, MARKET_PAGE_SIZE),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
export const dueMarketIdsQuery = () =>
  queryOptions({
    ...base,
    queryKey: ["vektor", "due-markets", 0, MARKET_PAGE_SIZE],
    queryFn: () => vektorContract.get_due_market_ids(0, MARKET_PAGE_SIZE),
    staleTime: 30_000,
  });
export const dueMarketsQuery = () =>
  queryOptions({
    ...base,
    queryKey: ["vektor", "due-market-state"],
    queryFn: async () => {
      const ids: string[] = [];
      let offset = 0;
      while (true) {
        const page = await vektorContract.get_due_market_ids(offset, MARKET_PAGE_SIZE);
        ids.push(...page.items);
        if (!page.hasMore || page.nextOffset === undefined) break;
        offset = page.nextOffset;
      }
      const markets = [];
      for (const id of ids) markets.push(await vektorContract.get_market(id));
      return markets;
    },
    placeholderData: (previous) => previous,
    staleTime: 15_000,
    refetchInterval: 20_000,
  });
export const validateCreationQuery = (instrument: Instrument, targetDate: string) =>
  queryOptions({
    ...base,
    queryKey: ["vektor", "validation", instrument, targetDate],
    enabled: Boolean(instrument && targetDate),
    queryFn: () => vektorContract.validate_market_creation(instrument, targetDate),
    staleTime: 5_000,
  });
export const positionQuery = (address: string | null, marketId: string) =>
  queryOptions({
    ...base,
    queryKey: ["vektor", "position", address, marketId],
    enabled: Boolean(address),
    queryFn: () => loadPosition(address!, marketId),
  });
export const portfolioQuery = (address: string | null) =>
  queryOptions({
    ...base,
    queryKey: ["vektor", "portfolio", address],
    enabled: Boolean(address),
    queryFn: async () => {
      const ids: string[] = [];
      let offset = 0;
      while (true) {
        const page = await vektorContract.get_user_market_ids(address!, offset, MARKET_PAGE_SIZE);
        ids.push(...page.items);
        if (!page.hasMore || page.items.length === 0) break;
        offset += page.items.length;
      }
      const positions = [];
      for (const id of ids) positions.push(await loadPosition(address!, id));
      return positions;
    },
    placeholderData: (previous) => previous,
    staleTime: 15_000,
    refetchInterval: 25_000,
  });
