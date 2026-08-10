import { queryOptions } from "@tanstack/react-query";
import type { Instrument } from "@/lib/vektor/types";
import {
  fetchLivePrices,
  fetchPriceSeries,
  fetchReferencePrice,
  fetchTargetDaySeries,
} from "./forex";

const retry = 2;
const base = { retry, refetchOnWindowFocus: true } as const;

export const livePricesQuery = () =>
  queryOptions({
    ...base,
    queryKey: ["marketData", "live-all"],
    queryFn: ({ signal }) => fetchLivePrices(signal),
    staleTime: 50_000,
    refetchInterval: 60_000,
    placeholderData: (previous) => previous,
  });

export const marketHistoryQuery = (instrument: Instrument, createdAt: string, enabled = true) => {
  const created = new Date(createdAt);
  return queryOptions({
    ...base,
    enabled: enabled && !Number.isNaN(created.getTime()),
    queryKey: ["marketData", "history", instrument, createdAt],
    queryFn: ({ signal }) => {
      const end = new Date();
      return fetchPriceSeries(instrument, created, end, signal);
    },
    staleTime: 10 * 60_000,
    refetchInterval: false,
    placeholderData: (previous) => previous,
  });
};

export const referencePriceQuery = (
  instrument: Instrument,
  referenceDate: string,
  enabled = true,
) =>
  queryOptions({
    ...base,
    enabled: enabled && Boolean(referenceDate),
    queryKey: ["marketData", "reference", instrument, referenceDate],
    queryFn: ({ signal }) => fetchReferencePrice(instrument, referenceDate, signal),
    staleTime: Infinity,
    gcTime: 7 * 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

export const targetDayQuery = (
  instrument: Instrument,
  targetDate: string,
  targetEnd: string,
  enabled: boolean,
) => {
  const target = new Date(`${targetDate}T00:00:00.000Z`);
  const end = new Date(targetEnd);
  return queryOptions({
    ...base,
    enabled: enabled && !Number.isNaN(target.getTime()) && !Number.isNaN(end.getTime()),
    queryKey: ["marketData", "target-day", instrument, targetDate, targetEnd],
    queryFn: ({ signal }) => fetchTargetDaySeries(instrument, target, end, signal),
    staleTime: Infinity,
    gcTime: 7 * 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
};
