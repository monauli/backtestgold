import type { BacktestTrade, Candle, EngineParams, EquityPoint } from "@/backtest/types";
import { entryPrice, grossProfit, netProfit, round2, stopLossPrice, takeProfitPrice, tradePips } from "@/backtest/execution";

const iso = (timestamp: number) => new Date(timestamp).toISOString();
type Position = { direction: "BUY" | "SELL"; trade: BacktestTrade; sl: number; tp: number };

export class DailyPreviousCandleBreakoutEngine {
  readonly trades: BacktestTrade[] = [];
  readonly equity: EquityPoint[] = [];
  ambiguousSignals = 0;
  skippedSignals = 0;
  pendingExpiredDays = 0;
  noTriggerDays = 0;
  balance: number;
  previousDailyHigh: number | null = null;
  previousDailyLow: number | null = null;
  buyStop: number | null = null;
  sellStop: number | null = null;
  private daily: Candle[];
  private currentDayStart = -1;
  private dailyIndex = -1;
  private pendingActive = false;
  private dayHasTrade = false;
  private position: Position | null = null;
  private lastM1: Candle | null = null;
  private tradeSeq = 0;

  constructor(dailyCandles: Candle[], private cfg: EngineParams & { entryOffset: number }) {
    this.daily = [...dailyCandles].sort((a, b) => a.timestamp - b.timestamp);
    this.balance = cfg.initialBalance;
    this.equity.push({ time: "", balance: this.balance });
  }
  onM1(candle: Candle): void {
    this.lastM1 = candle; this.advanceDaily(candle.timestamp);
    if (this.position) this.checkExit(candle);
    if (!this.position && this.pendingActive && !this.dayHasTrade) this.checkEntry(candle);
  }
  finish(): void {
    if (this.pendingActive && !this.dayHasTrade) { this.pendingExpiredDays++; this.noTriggerDays++; this.pendingActive = false; }
    if (!this.position || !this.lastM1) return;
    const trade = this.position.trade; trade.exitTime = iso(this.lastM1.timestamp); trade.exitPrice = this.lastM1.close; trade.result = "OPEN_AT_END"; this.settle(trade, trade.exitPrice); this.position = null;
  }
  private advanceDaily(timestamp: number): void {
    const date = new Date(timestamp);
    const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    if (dayStart === this.currentDayStart) return;
    if (this.currentDayStart >= 0 && this.pendingActive && !this.dayHasTrade) { this.pendingExpiredDays++; this.noTriggerDays++; }
    this.currentDayStart = dayStart;
    this.dayHasTrade = false;
    this.pendingActive = false;
    if (this.position) return;
    let index = -1;
    for (let i = this.daily.length - 1; i >= 0; i--) {
      if (this.daily[i].timestamp < dayStart) { index = i; break; }
    }
    this.dailyIndex = index;
    const previous = index >= 0 ? this.daily[index] : null;
    this.previousDailyHigh = previous?.high ?? null; this.previousDailyLow = previous?.low ?? null;
    this.buyStop = previous ? previous.high + this.cfg.entryOffset : null; this.sellStop = previous ? previous.low - this.cfg.entryOffset : null;
    this.pendingActive = Boolean(previous);
  }
  private checkEntry(candle: Candle): void {
    const buyTouched = candle.high >= this.buyStop!; const sellTouched = candle.low <= this.sellStop!;
    if (!buyTouched && !sellTouched) return;
    this.pendingActive = false; this.dayHasTrade = true;
    if (buyTouched && sellTouched) { this.ambiguousSignals++; this.skippedSignals++; return; }
    this.open(candle, buyTouched ? "BUY" : "SELL");
  }
  private open(candle: Candle, direction: "BUY" | "SELL"): void {
    const level = direction === "BUY" ? this.buyStop! : this.sellStop!; const entry = entryPrice(level, direction, this.cfg); const sl = stopLossPrice(entry, direction, this.cfg.stopLossDistance); const tp = takeProfitPrice(entry, direction, this.cfg.takeProfitDistance); const reference = this.daily[this.dailyIndex]!;
    const trade: BacktestTrade = { id: "D1-T" + (++this.tradeSeq), direction, referenceH4Time: iso(reference.timestamp), referenceHigh: reference.high, referenceLow: reference.low, breakoutLevel: level, entryTime: iso(candle.timestamp), entryPrice: entry, stopLoss: sl, takeProfit: tp, exitTime: null, exitPrice: null, result: "WIN", pips: 0, grossProfit: 0, commission: this.cfg.commission, netProfit: 0, balanceBefore: this.balance, balanceAfter: this.balance };
    this.position = { direction, trade, sl, tp }; this.checkExit(candle);
  }
  private checkExit(candle: Candle): void {
    const position = this.position!; const slHit = position.direction === "BUY" ? candle.low <= position.sl : candle.high >= position.sl; const tpHit = position.direction === "BUY" ? candle.high >= position.tp : candle.low <= position.tp; if (!slHit && !tpHit) return;
    const exit = slHit && tpHit ? position.sl : slHit ? position.sl : position.tp; if (slHit && tpHit) this.ambiguousSignals++;
    const trade = position.trade; trade.exitTime = iso(candle.timestamp); trade.exitPrice = exit; this.settle(trade, exit); trade.result = trade.netProfit > 0 ? "WIN" : trade.netProfit < 0 ? "LOSS" : "BREAKEVEN"; this.position = null;
  }
  private settle(trade: BacktestTrade, exit: number): void {
    const gross = grossProfit(trade.direction, trade.entryPrice, exit, this.cfg.lot); trade.pips = round2(tradePips(trade.direction, trade.entryPrice, exit)); trade.grossProfit = round2(gross); trade.netProfit = round2(netProfit(gross, trade.commission)); trade.balanceBefore = round2(this.balance); this.balance = round2(this.balance + trade.netProfit); trade.balanceAfter = this.balance; this.trades.push(trade); this.equity.push({ time: trade.exitTime ?? trade.entryTime, balance: this.balance });
  }
}
