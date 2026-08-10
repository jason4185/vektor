import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Instrument } from "@/lib/vektor/types";
import { formatMarketDataPrice } from "@/lib/market-data/normalize";
import { livePricesQuery } from "@/lib/market-data/queries";

export function LivePrice({ instrument }: { instrument: Instrument }) {
  const { data, isFetching } = useQuery(livePricesQuery());
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const price = data?.[instrument];
  const age = price ? ageSeconds(price.updatedAt) : Infinity;
  const status = freshness(age);
  return (
    <div className="min-w-0">
      <div className="label-xs">Live price</div>
      <div className="num mt-0.5 truncate text-sm font-semibold text-foreground">
        {price ? formatMarketDataPrice(instrument, price.price) : "Unavailable"}
      </div>
      {price && (
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <span
            className={`h-1.5 w-1.5 rounded-full ${status === "Live" ? "animate-pulse bg-primary" : "bg-muted-foreground"}`}
          />
          {status} · {relativeUpdatedAt(price.updatedAt)}
          {isFetching ? " · updating" : ""}
        </div>
      )}
    </div>
  );
}

export function LivePriceStrip({ instruments }: { instruments: Instrument[] }) {
  const { data, isError, isFetching } = useQuery(livePricesQuery());
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="panel flex min-w-0 gap-5 overflow-x-auto px-4 py-3 sm:gap-7">
      {instruments.map((instrument) => {
        const price = data?.[instrument];
        const status = price ? freshness(ageSeconds(price.updatedAt)) : "Unavailable";
        return (
          <div key={instrument} className="min-w-[122px] shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="num text-xs font-semibold text-foreground">{instrument}</span>
              {isFetching && price && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </div>
            <div className="num mt-1 text-sm font-semibold text-foreground">
              {price
                ? formatMarketDataPrice(instrument, price.price)
                : isError
                  ? "Unavailable"
                  : "—"}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span
                className={`h-1.5 w-1.5 rounded-full ${status === "Live" ? "animate-pulse bg-primary" : "bg-muted-foreground"}`}
              />
              {!price
                ? isError
                  ? "Price unavailable"
                  : "Waiting for price"
                : `${status} · ${relativeUpdatedAt(price.updatedAt)}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function relativeUpdatedAt(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.round(seconds / 60)}m ago`;
}
function ageSeconds(value: string) {
  return Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
}
function freshness(age: number) {
  if (age < 90) return "Live";
  if (age < 180) return "Updating";
  return "Price delayed";
}
