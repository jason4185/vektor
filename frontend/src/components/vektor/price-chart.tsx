import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Instrument, PricePoint } from "@/lib/vektor/types";
import { formatPrice } from "@/lib/vektor/format";

/**
 * Reference/target price chart.
 * Data is injected as `PricePoint[]` so a live feed can replace the mock
 * series without changing this component.
 */
export function PriceChart({
  instrument,
  series,
  referencePrice,
  height = 320,
}: {
  instrument: Instrument;
  series: PricePoint[];
  referencePrice: number | null;
  height?: number;
}) {
  const data = useMemo(
    () =>
      series.map((p) => ({
        t: p.t,
        v: p.v,
        label: new Date(p.t).toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          timeZone: "UTC",
        }),
      })),
    [series],
  );

  const values = data.map((d) => d.v);
  const min = Math.min(...values, referencePrice ?? Infinity);
  const max = Math.max(...values, referencePrice ?? -Infinity);
  const pad = (max - min) * 0.12 || 0.01;
  const last = values[values.length - 1] ?? 0;
  const above = referencePrice === null || last >= referencePrice;
  const color = above ? "var(--up)" : "var(--down)";

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="vk-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            minTickGap={48}
          />
          <YAxis
            domain={[min - pad, max + pad]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={68}
            tickFormatter={(v: number) => formatPrice(instrument, v)}
          />
          {referencePrice !== null && (
            <ReferenceLine
              y={referencePrice}
              stroke="var(--primary)"
              strokeDasharray="4 4"
              label={{
                value: `REF ${formatPrice(instrument, referencePrice)}`,
                position: "insideTopLeft",
                fill: "var(--primary)",
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          )}
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border-strong)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            itemStyle={{ color: "var(--foreground)" }}
            formatter={(v: number) => [formatPrice(instrument, v), instrument]}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill="url(#vk-area)"
            dot={false}
            activeDot={{ r: 3, fill: color, stroke: "var(--background)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
