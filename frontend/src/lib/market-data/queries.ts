import { queryOptions } from "@tanstack/react-query";
import type { Instrument } from "@/lib/vektor/types";
import { fetchLivePrices, fetchPriceSeries, fetchTargetDaySeries } from "./forex";

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

export const rollingMarketSeriesQuery = (instrument: Instrument, enabled = true) => {
  return queryOptions({
    ...base,
    enabled,
    queryKey: ["marketData", "rolling-series", instrument, "24h"],
    queryFn: ({ signal }) => {
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60_000);
      return fetchPriceSeries(instrument, start, end, signal);
    },
    staleTime: 5 * 60_000,
    refetchInterval: false,
    placeholderData: (previous) => previous,
  });
};

export const marketAnchorQuery = (instrument: Instrument, targetDate: string, enabled: boolean) => {
  const target = new Date(`${targetDate}T00:00:00.000Z`);
  const end = new Date(target.getTime() + 15 * 60_000);
  return queryOptions({
    ...base,
    enabled: enabled && !Number.isNaN(target.getTime()),
    queryKey: ["marketData", "anchor", instrument, targetDate],
    queryFn: ({ signal }) => fetchPriceSeries(instrument, target, end, signal),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
};

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
