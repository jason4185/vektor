import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Instrument, Market } from "@/lib/vektor/types";
import { formatMarketDataPrice } from "@/lib/market-data/normalize";
import { aggregateCandles, bucketMinutesForRange } from "@/lib/market-data/candles";
import { livePricesQuery, marketAnchorQuery, marketSeriesQuery } from "@/lib/market-data/queries";
import type { Candle, PriceSample } from "@/lib/market-data/types";

type ChartRange = "1H" | "3H" | "6H" | "1D";
const RANGE_HOURS: Record<ChartRange, number> = { "1H": 1, "3H": 3, "6H": 6, "1D": 24 };

function utcLabel(value: number) {
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function TargetDayChart({ market }: { market: Market }) {
  const [range, setRange] = useState<ChartRange>("1D");
  const [now, setNow] = useState(() => Date.now());
  const [hovered, setHovered] = useState<number | null>(null);
  const targetMs = new Date(`${market.targetDate}T00:00:00Z`).getTime();
  const targetEndMs = new Date(market.targetEnd).getTime();

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

  const complete = Number.isFinite(targetEndMs) && now >= targetEndMs;
  const targetStarted = now >= targetMs;
  const endMs = complete ? targetEndMs : Math.floor(now / 60_000) * 60_000;
  const startMs = complete ? targetMs : endMs - RANGE_HOURS[range] * 60 * 60_000;
  const queryStart = new Date(startMs).toISOString();
  const queryEnd = new Date(endMs).toISOString();
  const seriesQuery = useQuery(
    marketSeriesQuery(market.instrument, queryStart, queryEnd, range, true, !complete),
  );
  const anchorQuery = useQuery(
    marketAnchorQuery(market.instrument, market.targetDate, targetStarted),
  );
  const liveQuery = useQuery(livePricesQuery());
  const live = liveQuery.data?.[market.instrument];

  const points = useMemo(() => {
    const base = seriesQuery.data ?? [];
    if (complete || !live) return base;
    const timestamp = new Date(live.updatedAt).getTime();
    if (!Number.isFinite(timestamp) || timestamp < startMs || timestamp > endMs) return base;
    const next = base.filter((point) => point.timestamp !== timestamp);
    next.push({ timestamp, price: live.price, raw: live.raw });
    return next.sort((a, b) => a.timestamp - b.timestamp);
  }, [complete, endMs, live, seriesQuery.data, startMs]);

  const dayStart = anchorQuery.data?.find((point) => point.timestamp >= targetMs) ?? null;
  const dayEnd = complete
    ? ([...points].reverse().find((point) => point.timestamp <= targetEndMs) ?? null)
    : null;
  const current = complete
    ? dayEnd
    : live
      ? { timestamp: new Date(live.updatedAt).getTime(), price: live.price, raw: live.raw }
      : (points.at(-1) ?? null);
  const delta =
    targetStarted && dayStart && current ? BigInt(current.raw) - BigInt(dayStart.raw) : null;
  const absoluteMove = delta === null ? null : Number(delta) / 1_000_000_000_000;
  const movePct =
    delta !== null && dayStart ? Number((delta * 10_000n) / BigInt(dayStart.raw)) / 100 : null;
  const direction =
    delta === null ? null : delta > 0n ? "UP today" : delta < 0n ? "DOWN today" : "FLAT today";
  const candles = aggregateCandles(points, bucketMinutesForRange(range));
  const selectedCandle = hovered == null ? null : (candles[hovered] ?? null);

  return (
    <div className="panel overflow-hidden p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="label-xs">Price</span>
          <h2 className="mt-1 text-base font-semibold text-foreground">Real market candles</h2>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
          {(["1H", "3H", "6H", "1D"] as ChartRange[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] transition-colors ${range === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <ChartMetric
          label="Current"
          value={formatMarketDataPrice(market.instrument, current?.price)}
        />
        {targetStarted ? (
          <>
            <ChartMetric
              label="Day start"
              value={formatMarketDataPrice(market.instrument, dayStart?.price)}
            />
            <ChartMetric
              label="Move"
              value={
                movePct == null || absoluteMove == null
                  ? "—"
                  : `${absoluteMove >= 0 ? "+" : ""}${formatMarketDataPrice(market.instrument, absoluteMove)} (${movePct >= 0 ? "+" : ""}${movePct.toFixed(2)}%)`
              }
              tone={delta == null ? undefined : delta >= 0n ? "up" : "down"}
            />
            <ChartMetric
              label="Live move"
              value={direction ?? "—"}
              tone={
                direction === "DOWN today" ? "down" : direction === "UP today" ? "up" : undefined
              }
            />
          </>
        ) : (
          <span className="text-muted-foreground">
            Target day starts {formatUtcDate(targetMs)} · 00:00 UTC
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          {complete ? "Day complete" : "Live"}
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
          {seriesQuery.isError && (
            <div className="mt-4 text-right text-[11px] text-muted-foreground">
              Price data delayed
            </div>
          )}
          <div className="mt-5 h-[320px] w-full">
            <CandleChart
              candles={candles}
              instrument={market.instrument}
              dayStart={targetStarted ? dayStart : null}
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
                : "Target-day result is separate from this live view."}
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
  dayStart,
  targetMs,
  current,
  hovered,
  onHover,
}: {
  candles: Candle[];
  instrument: Instrument;
  dayStart: PriceSample | null;
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
  const minimum = Math.min(...candles.map((candle) => candle.low));
  const maximum = Math.max(...candles.map((candle) => candle.high));
  const spread = maximum - minimum || Math.max(maximum * 0.001, 0.000001);
  const y = (value: number) => top + ((maximum - value) / spread) * plotHeight;
  const x = (index: number) => left + (index / Math.max(candles.length - 1, 1)) * plotWidth;
  const candleWidth = Math.max(2, Math.min(12, (plotWidth / candles.length) * 0.68));
  const visibleStart = candles[0]?.timestamp ?? 0;
  const visibleEnd = candles.at(-1)?.timestamp ?? 0;
  const targetVisible = targetMs >= visibleStart && targetMs <= visibleEnd;
  const targetIndex = targetVisible
    ? candles.findIndex((candle) => candle.timestamp >= targetMs)
    : -1;
  const currentY = current ? y(current.price) : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full select-none"
      role="img"
      aria-label={`${instrument} real market candlestick chart`}
      onMouseLeave={() => onHover(null)}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const position = ((event.clientX - rect.left) / rect.width) * width;
        const index = Math.round(((position - left) / plotWidth) * Math.max(candles.length - 1, 1));
        onHover(index >= 0 && index < candles.length ? index : null);
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
        const bodyTop = y(Math.max(candle.open, candle.close));
        const bodyHeight = Math.max(1.5, Math.abs(y(candle.open) - y(candle.close)));
        return (
          <g key={candle.timestamp}>
            <line
              x1={x(index)}
              x2={x(index)}
              y1={y(candle.high)}
              y2={y(candle.low)}
              stroke={color}
              strokeWidth={1.2}
            />
            <rect
              x={x(index) - candleWidth / 2}
              y={bodyTop}
              width={candleWidth}
              height={bodyHeight}
              fill={color}
              opacity={hovered === index ? 1 : 0.86}
            />
          </g>
        );
      })}
      {targetIndex >= 0 && (
        <g>
          <line
            x1={x(targetIndex)}
            x2={x(targetIndex)}
            y1={top}
            y2={top + plotHeight}
            stroke="var(--primary)"
            strokeDasharray="5 4"
          />
          <text
            x={Math.min(x(targetIndex) + 6, width - 155)}
            y={top + 12}
            fill="var(--primary)"
            fontSize="11"
          >
            Target day starts
          </text>
        </g>
      )}
      {dayStart && (
        <g>
          <line
            x1={left}
            x2={left + plotWidth}
            y1={y(dayStart.price)}
            y2={y(dayStart.price)}
            stroke="var(--primary)"
            strokeDasharray="4 4"
          />
          <text x={left + 4} y={y(dayStart.price) - 5} fill="var(--primary)" fontSize="11">
            Day start {formatMarketDataPrice(instrument, dayStart.price)}
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
          x1={x(hovered)}
          x2={x(hovered)}
          y1={top}
          y2={top + plotHeight}
          stroke="var(--foreground)"
          strokeOpacity="0.25"
        />
      )}
      <text x={left} y={height - 8} fill="var(--muted-foreground)" fontSize="10">
        {utcLabel(candles[0]!.timestamp)} UTC
      </text>
      <text x={left + plotWidth - 72} y={height - 8} fill="var(--muted-foreground)" fontSize="10">
        {utcLabel(candles.at(-1)!.timestamp)} UTC
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
        <g transform={`translate(${Math.min(x(hovered) + 10, width - 145)}, ${top + 14})`}>
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
