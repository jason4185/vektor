import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Market, Side, TxState } from "@/lib/vektor/types";
import { bpsToPct, formatGen, projectPayout } from "@/lib/vektor/format";
import { getVektorContract } from "@/lib/vektor/contract";
import { remainingCapacityQuery, userBetQuery } from "@/lib/vektor/queries";
import { useWallet } from "@/lib/vektor/wallet";
import { PROTOCOL_CONFIG } from "@/lib/vektor/mock-data";
import { SideChip } from "./status-chip";

export function TradeTicket({ market, className }: { market: Market; className?: string }) {
  const { address, status: walletStatus, connect } = useWallet();
  const [side, setSide] = useState<Side>("UP");
  const [amount, setAmount] = useState("2");
  const [tx, setTx] = useState<TxState>({ phase: "idle" });

  const { data: existingBet } = useQuery(userBetQuery(market.id, address));
  const { data: remaining = PROTOCOL_CONFIG.maxStakePerWallet } = useQuery(
    remainingCapacityQuery(market.id, address),
  );

  useEffect(() => {
    if (existingBet) setSide(existingBet.side);
  }, [existingBet]);

  const numeric = Number(amount);
  const valid = Number.isFinite(numeric) && numeric > 0;
  const closed = market.status === "CLOSED";
  const lockedSide = existingBet ? existingBet.side : null;

  const error = useMemo(() => {
    if (closed) return "This market no longer accepts positions.";
    if (!valid) return null;
    if (numeric < PROTOCOL_CONFIG.minStake)
      return `Minimum stake is ${PROTOCOL_CONFIG.minStake} GEN.`;
    if (numeric > remaining) return `Only ${formatGen(remaining)} GEN of wallet capacity remains.`;
    if (lockedSide && lockedSide !== side)
      return `Wallet already holds ${lockedSide}. Opposite-side positions are rejected by the contract.`;
    return null;
  }, [closed, valid, numeric, remaining, lockedSide, side]);

  const payout = valid ? projectPayout(market.upPool, market.downPool, side, numeric) : 0;
  const impliedBps = side === "UP" ? market.upBps : 10000 - market.upBps;
  const multiple = valid && numeric > 0 ? payout / numeric : 0;

  async function submit() {
    if (!address) {
      void connect();
      return;
    }
    setTx({ phase: "signing" });
    try {
      const intent = await getVektorContract().place_bet(market.id, side, `${numeric}`);
      setTx({ phase: "pending", hash: intent.method });
      await new Promise((r) => setTimeout(r, 900));
      setTx({ phase: "success", hash: intent.method });
    } catch {
      setTx({ phase: "error", message: "The contract call could not be prepared." });
    }
  }

  const busy = tx.phase === "signing" || tx.phase === "pending";

  return (
    <div className={cn("panel overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="label-xs">Trade ticket</span>
        <span className="num text-xs text-muted-foreground">{market.id}</span>
      </div>

      <div className="space-y-4 p-4">
        {/* Segmented side control */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-1">
          {(["UP", "DOWN"] as Side[]).map((s) => {
            const Icon = s === "UP" ? ArrowUpRight : ArrowDownRight;
            const active = side === s;
            return (
              <button
                key={s}
                type="button"
                disabled={closed || (!!lockedSide && lockedSide !== s)}
                onClick={() => setSide(s)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold uppercase tracking-[0.06em] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-35",
                  active && s === "UP" && "bg-up text-up-foreground",
                  active && s === "DOWN" && "bg-down text-down-foreground",
                  !active && "text-muted-foreground hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {s}
                <span className="num text-xs opacity-80">
                  {bpsToPct(s === "UP" ? market.upBps : 10000 - market.upBps, 0)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Amount */}
        <div>
          <div className="flex items-baseline justify-between">
            <span className="label-xs">Stake</span>
            <span className="num text-xs text-muted-foreground">
              {formatGen(remaining)} GEN capacity left
            </span>
          </div>
          <div className="relative mt-2">
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              disabled={closed}
              className="num h-12 border-border bg-background pr-16 text-lg font-semibold"
            />
            <span className="num absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
              GEN
            </span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {[1, 2, 5, 10].map((v) => (
              <button
                key={v}
                type="button"
                disabled={closed || v > remaining}
                onClick={() => setAmount(String(Math.min(v, remaining)))}
                className="num rounded-lg border border-border bg-background py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-35"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Projection */}
        <dl className="space-y-2 rounded-xl border border-border bg-background p-3">
          <Row label="Implied probability" value={bpsToPct(impliedBps)} />
          <Row
            label="Projected payout"
            value={`${formatGen(payout)} GEN`}
            tone={side === "UP" ? "up" : "down"}
          />
          <Row label="Payout multiple" value={`${multiple.toFixed(2)}×`} />
          <Row
            label="Pool after fill"
            value={`${formatGen(market.upPool + market.downPool + (valid ? numeric : 0))} GEN`}
          />
        </dl>

        {existingBet && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-muted-foreground">
            <SideChip side={existingBet.side} />
            <span className="num">{formatGen(existingBet.stake)} GEN already staked</span>
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-down">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        {tx.phase === "success" && (
          <p className="flex items-start gap-2 rounded-lg border border-up/30 bg-up/10 px-3 py-2 text-xs leading-relaxed text-up">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Ticket prepared. Broadcasting is disabled until the GenLayer client is wired in.
          </p>
        )}
        {tx.phase === "error" && (
          <p className="flex items-start gap-2 text-xs text-down">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {tx.message}
          </p>
        )}

        <Button
          className="h-11 w-full text-sm font-bold uppercase tracking-[0.06em]"
          variant={side === "UP" ? "up" : "down"}
          disabled={closed || !!error || !valid || busy}
          onClick={() => void submit()}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {!address && walletStatus !== "connecting" && <Wallet className="h-4 w-4" />}
          {!address
            ? "Connect wallet to trade"
            : busy
              ? tx.phase === "signing"
                ? "Awaiting signature"
                : "Submitting"
              : `Stake ${valid ? formatGen(numeric, 0) : "—"} GEN on ${side}`}
        </Button>

        <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
          Pari-mutuel settlement. Winners split the full pool pro-rata; an inconclusive resolution
          refunds every original stake.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "num text-sm font-semibold text-foreground",
          tone === "up" && "text-up",
          tone === "down" && "text-down",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
