import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Instrument, Market } from "@/lib/vektor/types";
import { formatMarketDataPrice } from "@/lib/market-data/normalize";
import { aggregateCandles } from "@/lib/market-data/candles";
import {
  livePricesQuery,
  marketHistoryQuery,
  referencePriceQuery,
  targetDayQuery,
} from "@/lib/market-data/queries";
import type { Candle, PriceSample } from "@/lib/market-data/types";

const CANDLE_MINUTES = 5;

function utcLabel(value: number) {
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function TargetDayChart({ market }: { market: Market }) {
  const [now, setNow] = useState(() => Date.now());
  const [liveSamples, setLiveSamples] = useState<PriceSample[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const targetMs = new Date(`${market.targetDate}T00:00:00Z`).getTime();
  const targetEndMs = new Date(market.targetEnd).getTime();
  const targetStarted = Number.isFinite(targetMs) && now >= targetMs;
  const complete = Number.isFinite(targetEndMs) && now >= targetEndMs;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    const boundaries = [targetMs, targetEndMs].filter(
      (value) => Number.isFinite(value) && value > Date.now(),
    );
    const nextBoundary = boundaries.length > 0 ? Math.min(...boundaries) : null;
    const wake =
      nextBoundary === null
        ? undefined
        : window.setTimeout(() => setNow(Date.now()), nextBoundary - Date.now() + 250);
    return () => {
      window.clearInterval(timer);
      if (wake !== undefined) window.clearTimeout(wake);
    };
  }, [targetEndMs, targetMs]);

  const seriesQuery = useQuery(marketHistoryQuery(market.instrument, market.createdAt));
  const referenceQuery = useQuery(referencePriceQuery(market.instrument, market.referenceDate));
  const completedDayQuery = useQuery(
    targetDayQuery(market.instrument, market.targetDate, market.targetEnd, complete),
  );
  const liveQuery = useQuery(livePricesQuery());
  const live = liveQuery.data?.[market.instrument];
  const liveUpdatedAt = live ? new Date(live.updatedAt).getTime() : Number.NaN;
  const liveAgeMs = Number.isFinite(liveUpdatedAt) ? Math.max(0, now - liveUpdatedAt) : Infinity;
  const liveStatus =
    liveQuery.isError || !live
      ? "Price delayed"
      : liveAgeMs < 90_000
        ? "Live"
        : liveAgeMs < 180_000
          ? "Updating"
          : [0, 6].includes(new Date(liveUpdatedAt).getUTCDay())
            ? "Market closed"
            : "Price delayed";

  useEffect(() => {
    if (!live) return;
    const timestamp = new Date(live.updatedAt).getTime();
    if (!Number.isFinite(timestamp) || !Number.isFinite(live.price) || live.price <= 0) return;
    setLiveSamples((previous) => {
      const next = [
        ...previous.filter((point) => point.timestamp !== timestamp),
        {
          timestamp,
          price: live.price,
          raw: live.raw,
        },
      ];
      return next.sort((a, b) => a.timestamp - b.timestamp);
    });
  }, [live]);

  const points = useMemo(() => {
    const byTimestamp = new Map<number, PriceSample>();
    for (const point of [...(seriesQuery.data ?? []), ...liveSamples]) {
      if (point.timestamp <= now) byTimestamp.set(point.timestamp, point);
    }
    return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
  }, [liveSamples, now, seriesQuery.data]);

  const reference = referenceQuery.data ?? null;
  const dayEnd = complete ? (completedDayQuery.data?.dayEnd ?? null) : null;
  const current = live
    ? { timestamp: new Date(live.updatedAt).getTime(), price: live.price, raw: live.raw }
    : (points.at(-1) ?? null);
  const comparison = complete ? dayEnd : current;
  const delta =
    targetStarted && reference && comparison
      ? BigInt(comparison.raw) - BigInt(reference.raw)
      : null;
  const absoluteMove = delta === null ? null : Number(delta) / 1_000_000_000_000;
  const movePct =
    delta !== null && reference ? Number((delta * 10_000n) / BigInt(reference.raw)) / 100 : null;
  const direction =
    delta === null ? null : delta > 0n ? "UP today" : delta < 0n ? "DOWN today" : "FLAT today";
  const candles = aggregateCandles(points, CANDLE_MINUTES);
  const selectedCandle = hovered == null ? null : (candles[hovered] ?? null);

  return (
    <div className="panel overflow-hidden p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="label-xs">Price</span>
          <h2 className="mt-1 text-base font-semibold text-foreground">Live market</h2>
        </div>
        <span className="label-xs rounded-md border border-border bg-background px-2.5 py-1">
          5m candles
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <ChartMetric
          label="Current"
          value={formatMarketDataPrice(market.instrument, current?.price)}
        />
        {reference && (
          <ChartMetric
            label="Reference"
            value={formatMarketDataPrice(market.instrument, reference.price)}
          />
        )}
        {targetStarted ? (
          <>
            <ChartMetric
              label={complete ? "Prediction-day move" : "Move"}
              value={
                movePct == null || absoluteMove == null
                  ? "—"
                  : `${absoluteMove >= 0 ? "+" : ""}${formatMarketDataPrice(market.instrument, absoluteMove)} (${movePct >= 0 ? "+" : ""}${movePct.toFixed(2)}%)`
              }
              tone={delta == null ? undefined : delta >= 0n ? "up" : "down"}
            />
            <ChartMetric
              label={complete ? "Prediction-day direction" : "Today"}
              value={direction ?? "—"}
              tone={
                direction === "DOWN today" ? "down" : direction === "UP today" ? "up" : undefined
              }
            />
          </>
        ) : (
          <span className="text-muted-foreground">
            Prediction day starts {formatUtcDate(targetMs)} · 00:00 UTC
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
          <span
            className={`h-1.5 w-1.5 rounded-full ${liveStatus === "Live" && liveQuery.isFetching ? "animate-pulse bg-primary" : liveStatus === "Live" ? "bg-primary" : "bg-muted-foreground"}`}
          />
          {complete ? "Prediction day complete" : liveStatus}
        </span>
      </div>

      {seriesQuery.isError && candles.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-border-strong px-5 py-12 text-center text-sm text-muted-foreground">
          Price data is temporarily unavailable. Please try again shortly.
        </div>
      ) : candles.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-border-strong px-5 py-12 text-center text-sm text-muted-foreground">
          Waiting for real price data.
        </div>
      ) : (
        <>
          {(seriesQuery.isError || liveQuery.isError) && (
            <div className="mt-4 text-right text-[11px] text-muted-foreground">
              Price data delayed
            </div>
          )}
          <div className="mt-5 h-[320px] w-full">
            <CandleChart
              candles={candles}
              instrument={market.instrument}
              reference={reference}
              targetMs={targetMs}
              current={current}
              hovered={hovered}
              onHover={setHovered}
            />
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-3 text-xs text-muted-foreground">
            <span>{selectedCandle ? `${utcLabel(selectedCandle.timestamp)} UTC` : "UTC"}</span>
            <span>
              {complete && dayEnd
                ? `Day end · ${formatMarketDataPrice(market.instrument, dayEnd.price)}`
                : "Live price movement is separate from the final Vektor market result."}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function CandleChart({
  candles,
  instrument,
  reference,
  targetMs,
  current,
  hovered,
  onHover,
}: {
  candles: Candle[];
  instrument: Instrument;
  reference: PriceSample | null;
  targetMs: number;
  current: PriceSample | null;
  hovered: number | null;
  onHover: (index: number | null) => void;
}) {
  const width = 1000;
  const height = 320;
  const left = 8;
  const right = 70;
  const top = 18;
  const bottom = 28;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const visibleStart = candles[0]?.timestamp ?? 0;
  const visibleEnd = candles.at(-1)?.timestamp ?? 0;
  const minimum = Math.min(
    ...candles.map((candle) => candle.low),
    ...(reference ? [reference.price] : []),
    ...(current ? [current.price] : []),
  );
  const maximum = Math.max(
    ...candles.map((candle) => candle.high),
    ...(reference ? [reference.price] : []),
    ...(current ? [current.price] : []),
  );
  const spread = maximum - minimum || Math.max(maximum * 0.001, 0.000001);
  const y = (value: number) => top + ((maximum - value) / spread) * plotHeight;
  const x = (timestamp: number) => {
    if (visibleEnd <= visibleStart) return left + plotWidth / 2;
    return left + ((timestamp - visibleStart) / (visibleEnd - visibleStart)) * plotWidth;
  };
  const candleWidth = Math.max(2, Math.min(10, (plotWidth / Math.max(candles.length, 1)) * 0.68));
  const targetVisible = targetMs >= visibleStart && targetMs <= visibleEnd;
  const currentY = current ? y(current.price) : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full select-none"
      role="img"
      aria-label={`${instrument} live 5-minute candlestick chart`}
      onMouseLeave={() => onHover(null)}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const position = ((event.clientX - rect.left) / rect.width) * width;
        const timestamp =
          visibleStart + ((position - left) / plotWidth) * (visibleEnd - visibleStart);
        let nearest = 0;
        let distance = Number.POSITIVE_INFINITY;
        candles.forEach((candle, index) => {
          const nextDistance = Math.abs(candle.timestamp - timestamp);
          if (nextDistance < distance) {
            distance = nextDistance;
            nearest = index;
          }
        });
        onHover(position >= left && position <= left + plotWidth ? nearest : null);
      }}
    >
      {[0, 0.5, 1].map((step) => (
        <line
          key={step}
          x1={left}
          x2={left + plotWidth}
          y1={top + plotHeight * step}
          y2={top + plotHeight * step}
          stroke="var(--border)"
          strokeDasharray="3 5"
        />
      ))}
      {candles.map((candle, index) => {
        const color = candle.close >= candle.open ? "var(--up)" : "var(--down)";
        const candleX = x(candle.timestamp);
        const bodyTop = y(Math.max(candle.open, candle.close));
        const bodyHeight = Math.max(1.5, Math.abs(y(candle.open) - y(candle.close)));
        return (
          <g key={candle.timestamp}>
            <line
              x1={candleX}
              x2={candleX}
              y1={y(candle.high)}
              y2={y(candle.low)}
              stroke={color}
              strokeWidth={1.2}
            />
            <rect
              x={candleX - candleWidth / 2}
              y={bodyTop}
              width={candleWidth}
              height={bodyHeight}
              fill={color}
              opacity={hovered === index ? 1 : 0.86}
            />
          </g>
        );
      })}
      {targetVisible && (
        <g>
          <line
            x1={x(targetMs)}
            x2={x(targetMs)}
            y1={top}
            y2={top + plotHeight}
            stroke="var(--primary)"
            strokeDasharray="5 4"
          />
          <text
            x={Math.min(x(targetMs) + 6, width - 155)}
            y={top + 12}
            fill="var(--primary)"
            fontSize="11"
          >
            Prediction day starts
          </text>
        </g>
      )}
      {reference && (
        <g>
          <line
            x1={left}
            x2={left + plotWidth}
            y1={y(reference.price)}
            y2={y(reference.price)}
            stroke="var(--primary)"
            strokeDasharray="4 4"
          />
          <text x={left + 4} y={y(reference.price) - 5} fill="var(--primary)" fontSize="11">
            Reference {formatMarketDataPrice(instrument, reference.price)}
          </text>
        </g>
      )}
      {currentY !== null && (
        <line
          x1={left}
          x2={left + plotWidth}
          y1={currentY}
          y2={currentY}
          stroke="var(--foreground)"
          strokeOpacity="0.35"
          strokeDasharray="2 4"
        />
      )}
      {hovered !== null && candles[hovered] && (
        <line
          x1={x(candles[hovered].timestamp)}
          x2={x(candles[hovered].timestamp)}
          y1={top}
          y2={top + plotHeight}
          stroke="var(--foreground)"
          strokeOpacity="0.25"
        />
      )}
      <text x={left} y={height - 8} fill="var(--muted-foreground)" fontSize="10">
        {utcLabel(visibleStart)} UTC
      </text>
      <text x={left + plotWidth - 72} y={height - 8} fill="var(--muted-foreground)" fontSize="10">
        {utcLabel(visibleEnd)} UTC
      </text>
      <text x={left + plotWidth + 8} y={top + 4} fill="var(--muted-foreground)" fontSize="10">
        {formatMarketDataPrice(instrument, maximum)}
      </text>
      <text
        x={left + plotWidth + 8}
        y={top + plotHeight}
        fill="var(--muted-foreground)"
        fontSize="10"
      >
        {formatMarketDataPrice(instrument, minimum)}
      </text>
      {hovered !== null && candles[hovered] && (
        <g
          transform={`translate(${Math.min(x(candles[hovered].timestamp) + 10, width - 145)}, ${top + 14})`}
        >
          <rect
            width="135"
            height="61"
            rx="6"
            fill="var(--surface-raised)"
            stroke="var(--border-strong)"
          />
          <text x="8" y="16" fill="var(--muted-foreground)" fontSize="10">
            {utcLabel(candles[hovered].timestamp)} UTC
          </text>
          <text x="8" y="32" fill="var(--foreground)" fontSize="10">
            O {formatMarketDataPrice(instrument, candles[hovered].open)} · C{" "}
            {formatMarketDataPrice(instrument, candles[hovered].close)}
          </text>
          <text x="8" y="48" fill="var(--foreground)" fontSize="10">
            H {formatMarketDataPrice(instrument, candles[hovered].high)} · L{" "}
            {formatMarketDataPrice(instrument, candles[hovered].low)}
          </text>
        </g>
      )}
    </svg>
  );
}

function ChartMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | undefined;
}) {
  return (
    <div>
      <div className="label-xs">{label}</div>
      <div
        className={`num mt-1 text-sm font-semibold ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

function formatUtcDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}
