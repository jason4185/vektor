import { queryOptions } from "@tanstack/react-query";
import type { Instrument } from "@/lib/vektor/types";
import { fetchLivePrices, fetchPriceSeries } from "./forex";

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

export const marketSeriesQuery = (
  instrument: Instrument,
  start: string,
  end: string,
  range: "1H" | "3H" | "6H" | "1D",
  enabled: boolean,
  poll = true,
) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return queryOptions({
    ...base,
    enabled: enabled && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()),
    queryKey: ["marketData", "series", instrument, start, end, range],
    queryFn: ({ signal }) => fetchPriceSeries(instrument, startDate, endDate, signal),
    staleTime: poll ? 45_000 : Infinity,
    refetchInterval: poll ? 60_000 : false,
    placeholderData: (previous) => previous,
  });
};

export const marketAnchorQuery = (instrument: Instrument, targetDate: string, enabled: boolean) => {
  const target = new Date(`${targetDate}T00:00:00.000Z`);
  const end = new Date(target.getTime() + 60 * 60_000);
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
