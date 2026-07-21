import type {
  BacktestTrade,
  Candle,
  EngineParams,
  EquityPoint,
  Session,
} from "./types";
import {
  entryPrice,
  stopLossPrice,
  takeProfitPrice,
  grossProfit,
  tradePips,
  netProfit,
  round2,
} from "./execution";

const iso = (ms: number) => new Date(ms).toISOString();

/** Session windows in data-file time (server time, treated as UTC). */
const SESSION_HOURS: Record<string, [number, number]> = {
  ASIA: [0, 9],
  LONDON: [9, 17],
  NEW_YORK: [15, 24],
};

export function inSession(ts: number, session: Session): boolean {
  if (session === "ALL") return true;
  const h = new Date(ts).getUTCHours();
  const [a, b] = SESSION_HOURS[session];
  return h >= a && h < b;
}

type OpenPosition = {
  direction: "BUY" | "SELL";
  trade: BacktestTrade;
  sl: number;
  tp: number;
};

/**
 * H4 breakout engine. H4 candles are pushed via the constructor; M1 candles
 * are pushed one at a time in ascending order via onM1(). Levels come from the
 * previous *completed* H4 candle and are active only during the next H4
 * period. Entry triggers use M1 high/low (wick touch), never close. Max one
 * open position; one entry per H4 period.
 *
 * Documented ambiguity rules (SKIP mode, the app default):
 * - Buy and Sell levels touched in the same M1 candle -> signal skipped.
 * - SL and TP both inside the same M1 candle -> resolved as a LOSS
 *   (conservative), OPTIMISTIC mode resolves as WIN.
 */
export class BreakoutEngine {
  readonly trades: BacktestTrade[] = [];
  readonly equity: EquityPoint[] = [];
  ambiguousSignals = 0;
  skippedSignals = 0;
  balance: number;

  private h4: Candle[];
  private h4Index = -1;
  private buyLevel: number | null = null;
  private sellLevel: number | null = null;
  private levelConsumed = false;
  private position: OpenPosition | null = null;
  private refH4: Candle | null = null;
  private tradeSeq = 0;
  private lastM1: Candle | null = null;

  constructor(h4Candles: Candle[], private cfg: EngineParams) {
    this.h4 = h4Candles;
    this.balance = cfg.initialBalance;
    this.equity.push({ time: "", balance: this.balance });
  }

  onM1(c: Candle): void {
    this.lastM1 = c;
    this.advanceH4(c.timestamp);
    if (this.position) {
      this.checkExit(c);
    }
    if (
      !this.position &&
      !this.levelConsumed &&
      this.buyLevel !== null &&
      this.sellLevel !== null &&
      inSession(c.timestamp, this.cfg.session)
    ) {
      this.checkEntry(c);
    }
  }

  finish(): void {
    if (this.position && this.lastM1) {
      const t = this.position.trade;
      const exit = this.lastM1.close;
      t.exitTime = iso(this.lastM1.timestamp);
      t.exitPrice = exit;
      t.result = "OPEN_AT_END";
      this.settle(t, exit);
      this.position = null;
      this.cfg.onTradeClosed?.(t);
    }
  }

  /** Move the active H4 window forward so that ts falls inside it. */
  private advanceH4(ts: number): void {
    while (
      this.h4Index + 1 < this.h4.length &&
      ts >= this.h4[this.h4Index + 1].timestamp
    ) {
      this.h4Index++;
      const prev = this.h4Index > 0 ? this.h4[this.h4Index - 1] : null;
      if (prev) {
        this.refH4 = prev;
        this.buyLevel = prev.high + this.cfg.breakoutDistance;
        this.sellLevel = prev.low - this.cfg.breakoutDistance;
      } else {
        this.refH4 = null;
        this.buyLevel = null;
        this.sellLevel = null;
      }
      this.levelConsumed = false;
    }
  }

  private checkEntry(c: Candle): void {
    const buyTouched = c.high >= this.buyLevel!;
    const sellTouched = c.low <= this.sellLevel!;
    if (!buyTouched && !sellTouched) return;
    this.levelConsumed = true;

    if (buyTouched && sellTouched) {
      // Order of touches inside one M1 candle is unknowable -> skip.
      this.ambiguousSignals++;
      if (this.cfg.ambiguousHandling !== "OPTIMISTIC") {
        this.skippedSignals++;
        this.recordSignalOnly(c, "SKIPPED");
        return;
      }
      this.open(c, "BUY");
      return;
    }
    const direction = buyTouched ? "BUY" : "SELL";
    if (this.cfg.entryFilter && !this.cfg.entryFilter(direction, this.refH4!)) return;
    if (this.cfg.entryGuard && !this.cfg.entryGuard(c.timestamp)) return;
    this.open(c, direction);
  }

  private recordSignalOnly(c: Candle, result: "AMBIGUOUS" | "SKIPPED"): void {
    const ref = this.refH4!;
    this.trades.push({
      id: `T${++this.tradeSeq}`,
      direction: "BUY",
      referenceH4Time: iso(ref.timestamp),
      referenceHigh: ref.high,
      referenceLow: ref.low,
      breakoutLevel: this.buyLevel!,
      entryTime: iso(c.timestamp),
      entryPrice: this.buyLevel!,
      stopLoss: 0,
      takeProfit: 0,
      exitTime: null,
      exitPrice: null,
      result,
      pips: 0,
      grossProfit: 0,
      commission: 0,
      netProfit: 0,
      balanceBefore: this.balance,
      balanceAfter: this.balance,
    });
  }

  private open(c: Candle, direction: "BUY" | "SELL"): void {
    const level = direction === "BUY" ? this.buyLevel! : this.sellLevel!;
    const entry = entryPrice(level, direction, this.cfg);
    const sl = stopLossPrice(entry, direction, this.cfg.stopLossDistance);
    const tp = takeProfitPrice(entry, direction, this.cfg.takeProfitDistance);
    const ref = this.refH4!;
    const trade: BacktestTrade = {
      id: `T${++this.tradeSeq}`,
      direction,
      referenceH4Time: iso(ref.timestamp),
      referenceHigh: ref.high,
      referenceLow: ref.low,
      breakoutLevel: level,
      entryTime: iso(c.timestamp),
      entryPrice: entry,
      stopLoss: sl,
      takeProfit: tp,
      exitTime: null,
      exitPrice: null,
      result: "WIN",
      pips: 0,
      grossProfit: 0,
      commission: this.cfg.commission,
      netProfit: 0,
      balanceBefore: this.balance,
      balanceAfter: this.balance,
    };
    this.position = { direction, trade, sl, tp };
    // SL/TP may already be inside the entry candle's range
    this.checkExit(c);
  }

  private checkExit(c: Candle): void {
    const p = this.position!;
    const slHit = p.direction === "BUY" ? c.low <= p.sl : c.high >= p.sl;
    const tpHit = p.direction === "BUY" ? c.high >= p.tp : c.low <= p.tp;
    if (!slHit && !tpHit) return;

    let exit: number;
    if (slHit && tpHit) {
      // Intrabar SL+TP: conservative default = LOSS; OPTIMISTIC = WIN.
      exit = this.cfg.ambiguousHandling === "OPTIMISTIC" ? p.tp : p.sl;
    } else {
      exit = slHit ? p.sl : p.tp;
    }
    const t = p.trade;
    t.exitTime = iso(c.timestamp);
    t.exitPrice = exit;
    this.settle(t, exit);
    t.result =
      t.netProfit > 0 ? "WIN" : t.netProfit < 0 ? "LOSS" : "BREAKEVEN";
    this.position = null;
    this.cfg.onTradeClosed?.(t);
  }

  private settle(t: BacktestTrade, exit: number): void {
    const gross = grossProfit(t.direction, t.entryPrice, exit, this.cfg.lot);
    t.pips = round2(tradePips(t.direction, t.entryPrice, exit));
    t.grossProfit = round2(gross);
    t.netProfit = round2(netProfit(gross, t.commission));
    t.balanceBefore = round2(this.balance);
    this.balance = round2(this.balance + t.netProfit);
    t.balanceAfter = this.balance;
    this.trades.push(t);
    this.equity.push({ time: t.exitTime ?? t.entryTime, balance: this.balance });
  }
}
