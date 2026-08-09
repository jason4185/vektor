import type { PricePoint } from "@/lib/vektor/types";

export function Sparkline({
  data,
  tone = "up",
  width = 112,
  height = 40,
}: {
  data: PricePoint[];
  tone?: "up" | "down";
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const values = data.map((d) => d.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);

  const points = values
    .map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / span) * height).toFixed(2)}`)
    .join(" ");

  const stroke = tone === "up" ? "var(--up)" : "var(--down)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
