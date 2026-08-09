import { queryOptions } from "@tanstack/react-query";
import { getVektorContract } from "./contract";
import type { Instrument, MarketQuery } from "./types";

const c = () => getVektorContract();

export const protocolConfigQuery = () =>
  queryOptions({ queryKey: ["vektor", "config"], queryFn: () => c().get_protocol_config() });

export const supportedMarketsQuery = () =>
  queryOptions({ queryKey: ["vektor", "instruments"], queryFn: () => c().get_supported_markets() });

export const marketsQuery = (query: MarketQuery) =>
  queryOptions({ queryKey: ["vektor", "markets", query], queryFn: () => c().get_markets(query) });

export const marketQuery = (id: string) =>
  queryOptions({ queryKey: ["vektor", "market", id], queryFn: () => c().get_market(id) });

export const activityQuery = () =>
  queryOptions({
    queryKey: ["vektor", "activity"],
    queryFn: () => c().get_activity(),
  });

export const userBetQuery = (marketId: string, address: string | null) =>
  queryOptions({
    queryKey: ["vektor", "user-bet", marketId, address],
    queryFn: () => (address ? c().get_user_bet(marketId, address) : Promise.resolve(null)),
  });

export const remainingCapacityQuery = (marketId: string, address: string | null) =>
  queryOptions({
    queryKey: ["vektor", "capacity", marketId, address],
    queryFn: () =>
      address ? c().get_remaining_bet_capacity(marketId, address) : Promise.resolve(10),
  });

export const userMarketIdsQuery = (address: string | null) =>
  queryOptions({
    queryKey: ["vektor", "user-markets", address],
    queryFn: () => (address ? c().get_user_market_ids(address) : Promise.resolve([])),
  });

export const dueMarketIdsQuery = () =>
  queryOptions({ queryKey: ["vektor", "due"], queryFn: () => c().get_due_market_ids() });

export const validateCreationQuery = (instrument: Instrument, targetDate: string) =>
  queryOptions({
    queryKey: ["vektor", "validate", instrument, targetDate],
    queryFn: () => c().validate_market_creation(instrument, targetDate),
    enabled: Boolean(targetDate),
  });
