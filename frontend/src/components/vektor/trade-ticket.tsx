import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { bpsToPct, formatGen } from "@/lib/vektor/format";
import { vektorContract } from "@/lib/vektor/contract";
import { remainingCapacityQuery, userBetQuery } from "@/lib/vektor/queries";
import { useWallet } from "@/lib/vektor/wallet";
import { formatWalletError } from "@/lib/vektor/errors";
import { SideChip } from "./status-chip";
import { TransactionModal } from "./transaction-modal";
import { parseUnits } from "viem";
import { timingCopy } from "@/lib/vektor/timing";
import { useMarketTiming } from "@/lib/vektor/use-market-timing";

export function TradeTicket({ market, className }: { market: Market; className?: string }) {
  const { address, status: walletStatus, connect } = useWallet();
  const queryClient = useQueryClient();
  const [side, setSide] = useState<Side>("UP");
  const [amount, setAmount] = useState("2");
  const [tx, setTx] = useState<TxState>({ phase: "idle" });
  const [modalOpen, setModalOpen] = useState(false);

  const { data: existingBet } = useQuery(userBetQuery(market.id, address));
  const { data: remaining = 0 } = useQuery(remainingCapacityQuery(market.id, address));
  const timing = useMarketTiming(market);

  useEffect(() => {
    if (existingBet?.side === "UP" || existingBet?.side === "DOWN") setSide(existingBet.side);
  }, [existingBet]);

  const numeric = Number(amount);
  const valid = Number.isFinite(numeric) && numeric > 0;
  const bettingOpen = market.status === "OPEN" && timing.bettingOpen;
  const closed = !bettingOpen;
  const lockedSide =
    existingBet && existingBet.stake > 0 && existingBet.side !== "NONE" ? existingBet.side : null;

  const error = useMemo(() => {
    if (closed) return null;
    if (!valid) return null;
    if (numeric < 1) return "Minimum stake is 1 GEN.";
    if (numeric > remaining) return `Only ${formatGen(remaining)} GEN of wallet capacity remains.`;
    if (lockedSide && lockedSide !== side)
      return `You already chose ${lockedSide} for this market. You can only add more to the same side.`;
    return null;
  }, [closed, valid, numeric, remaining, lockedSide, side]);

  const sidePool = side === "UP" ? market.upPool : market.downPool;
  const amountUnits = valid ? parseDisplayUnits(amount) : 0n;
  const poolUnits = parseDisplayUnits((market.upPool + market.downPool).toFixed(6));
  const sidePoolUnits = parseDisplayUnits(sidePool.toFixed(6));
  const payoutUnits =
    valid && sidePoolUnits + amountUnits > 0n
      ? ((poolUnits + amountUnits) * amountUnits) / (sidePoolUnits + amountUnits)
      : 0n;
  const payout = Number(payoutUnits) / 1_000_000;
  const impliedBps = side === "UP" ? market.upBps : market.downBps;
  const multiple = valid && numeric > 0 ? payout / numeric : 0;

  async function submit() {
    if (!address) {
      void connect();
      return;
    }
    setTx({ phase: "preparing" });
    setModalOpen(true);
    try {
      setTx({ phase: "wallet_confirmation" });
      const result = await vektorContract.place_bet(market.id, side, amount, {
        onProgress: ({ phase, hash }) => setTx((current) => ({ ...current, phase, hash })),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vektor", "market", market.id] }),
        queryClient.invalidateQueries({ queryKey: ["vektor", "user-bet", market.id, address] }),
        queryClient.invalidateQueries({ queryKey: ["vektor", "user-status", market.id, address] }),
        queryClient.invalidateQueries({ queryKey: ["vektor", "capacity", market.id, address] }),
        queryClient.invalidateQueries({ queryKey: ["vektor", "markets"] }),
        queryClient.invalidateQueries({ queryKey: ["vektor", "portfolio", address] }),
        queryClient.invalidateQueries({ queryKey: ["vektor", "user-markets", address] }),
      ]);
      let stateConfirmed = false;
      if (result.confirmed) {
        for (let attempt = 0; attempt < 10 && !stateConfirmed; attempt += 1) {
          const refreshedBet = await queryClient.fetchQuery(userBetQuery(market.id, address));
          stateConfirmed =
            refreshedBet.side === side &&
            refreshedBet.stake >= (existingBet?.stake ?? 0) + numeric * 0.999;
          if (!stateConfirmed) await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
      }
      const action = existingBet?.stake ? "Prediction updated" : "Prediction placed";
      setTx({
        phase: stateConfirmed ? "completed" : "uncertain",
        hash: result.hash,
        message: stateConfirmed
          ? `${action}. ${amount} GEN added to ${side}.`
          : `${action}. Your transaction was submitted and is still confirming.`,
      });
    } catch (error) {
      setTx({
        phase: /Transaction cancelled\./.test(formatWalletError(error)) ? "cancelled" : "failed",
        message: formatWalletError(error),
      });
    }
  }

  const busy =
    tx.phase === "preparing" ||
    tx.phase === "wallet_confirmation" ||
    tx.phase === "submitted" ||
    tx.phase === "processing";

  if (!bettingOpen) {
    return (
      <div className={cn("panel overflow-hidden", className)}>
        <div className="border-b border-border px-4 py-3">
          <span className="label-xs">Market status</span>
        </div>
        <div className="space-y-4 p-4">
          <div className="rounded-xl border border-border bg-surface-raised p-4">
            <div className="label-xs">
              {timing.status === "OBSERVATION_ACTIVE"
                ? "Betting ended"
                : timing.status === "READY_FOR_SETTLEMENT"
                  ? "Ready for settlement"
                  : timing.status === "INCONCLUSIVE"
                    ? "Refund available"
                    : "Market settled"}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {timing.status === "OBSERVATION_ACTIVE"
                ? "Prediction day is live. No new predictions can be placed."
                : timing.status === "READY_FOR_SETTLEMENT"
                  ? "Anyone can settle this market once the result is ready."
                  : "New predictions are no longer available for this market."}
            </p>
            {timing.countdown && (
              <p className="mt-2 text-xs text-primary">
                {timingCopy(timing.status, timing.countdown)}
              </p>
            )}
          </div>
          {existingBet && existingBet.stake > 0 && existingBet.side !== "NONE" && (
            <div className="rounded-lg border border-border bg-background px-3 py-3">
              <div className="label-xs">Your position</div>
              <div className="mt-2 flex items-center gap-2">
                <SideChip side={existingBet.side} />
                <span className="num text-sm font-semibold">
                  {formatGen(existingBet.stake)} GEN
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("panel overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="label-xs">Choose a side</span>
        <span className="text-xs text-muted-foreground">
          {timingCopy(timing.status, timing.countdown)}
        </span>
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
                onClick={() => {
                  setSide(s);
                  if (tx.phase === "failed" || tx.phase === "cancelled" || tx.phase === "completed")
                    setTx({ phase: "idle" });
                }}
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
                  {market.upBps === 0 && market.downBps === 0
                    ? "—"
                    : bpsToPct(s === "UP" ? market.upBps : market.downBps, 0)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Amount */}
        <div>
          <div className="flex items-baseline justify-between">
            <span className="label-xs">Amount</span>
            <span className="num text-xs text-muted-foreground">
              Your remaining limit: {formatGen(remaining)} GEN
            </span>
          </div>
          <div className="relative mt-2">
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/[^0-9.]/g, ""));
                if (tx.phase === "failed" || tx.phase === "cancelled" || tx.phase === "completed")
                  setTx({ phase: "idle" });
              }}
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
          <Row
            label="Estimated share"
            value={
              impliedBps === 0 && market.upBps === 0 && market.downBps === 0
                ? "—"
                : bpsToPct(impliedBps)
            }
          />
          <Row
            label="Estimated payout"
            value={`${formatGen(payout)} GEN`}
            tone={side === "UP" ? "up" : "down"}
          />
          <Row label="Payout multiple" value={`${multiple.toFixed(2)}×`} />
          <Row
            label="Pool after fill"
            value={`${formatGen(market.upPool + market.downPool + (valid ? numeric : 0))} GEN`}
          />
        </dl>

        {existingBet && existingBet.stake > 0 && existingBet.side !== "NONE" && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-muted-foreground">
            <SideChip side={existingBet.side} />
            <span className="num">Your stake: {formatGen(existingBet.stake)} GEN</span>
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-down">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        {tx.phase === "completed" && (
          <p className="flex items-start gap-2 rounded-lg border border-up/30 bg-up/10 px-3 py-2 text-xs leading-relaxed text-up">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {tx.message}
          </p>
        )}
        {(tx.phase === "failed" || tx.phase === "cancelled") && (
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
              ? tx.phase === "wallet_confirmation"
                ? "Awaiting wallet"
                : tx.phase === "preparing"
                  ? "Preparing"
                  : tx.phase === "submitted"
                    ? "Submitted"
                    : "Processing"
              : `Predict ${side} · ${valid ? formatGen(numeric, 0) : "—"} GEN`}
        </Button>

        <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
          Winners receive a share of the pool. If the result cannot be confirmed, every original
          stake can be refunded.
        </p>
      </div>
      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Placing prediction"
        description="Keep this window open while your prediction is submitted."
        state={tx}
        successMessage={tx.message}
      />
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

function parseDisplayUnits(value: string) {
  try {
    return parseUnits(value, 6);
  } catch {
    return 0n;
  }
}
