import type { Instrument } from "@/lib/vektor/types";

export interface LivePrice {
  price: number;
  raw: string;
  updatedAt: string;
}

export type LivePrices = Partial<Record<Instrument, LivePrice>>;

export interface PriceSample {
  timestamp: number;
  price: number;
  raw: string;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TargetDaySeries {
  instrument: Instrument;
  targetDate: string;
  points: PriceSample[];
  dayStart: PriceSample | null;
  dayEnd: PriceSample | null;
}
