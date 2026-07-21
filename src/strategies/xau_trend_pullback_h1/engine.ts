import type { BacktestTrade, Candle, EquityPoint } from "@/backtest/types";
import { grossProfit, netProfit, round2, tradePips } from "@/backtest/execution";
import { calculateH1Indicators, hasH1Warmup } from "./indicators";
import type { H1IndicatorPoint, H1Signal, XauTrendPullbackH1Config } from "./types";

const iso = (timestamp: number) => new Date(timestamp).toISOString();
const dayOf = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);

export function pullbackValid(candles: Candle[], indicators: H1IndicatorPoint[], confirmationIndex: number, cfg: XauTrendPullbackH1Config): boolean {
  for (let i = Math.max(0, confirmationIndex - 3); i < confirmationIndex; i++) {
    const point = indicators[i];
    if (point.ema50 === null || point.atr14 === null || point.atr14 <= 0) continue;
    const upper = point.ema50 + cfg.pullbackAtrTolerance * point.atr14;
    const lower = point.ema50 - cfg.pullbackAtrTolerance * point.atr14;
    if (candles[i].low <= upper && candles[i].high >= lower) return true;
  }
  return false;
}

export function bullishConfirmation(candles: Candle[], indicators: H1IndicatorPoint[], i: number, cfg: XauTrendPullbackH1Config): boolean {
  const c = candles[i]; const previous = candles[i - 1]; const point = indicators[i]; const range = c.high - c.low; const body = c.close - c.open;
  return range > 0 && body > 0 && body >= cfg.confirmationBodyMin * range && c.close >= c.low + cfg.confirmationCloseTopFraction * range && c.close > previous.high && point.ema200 !== null && c.close > point.ema200;
}

export function bearishConfirmation(candles: Candle[], indicators: H1IndicatorPoint[], i: number, cfg: XauTrendPullbackH1Config): boolean {
  const c = candles[i]; const previous = candles[i - 1]; const point = indicators[i]; const range = c.high - c.low; const body = c.open - c.close; const bottom = 1 - cfg.confirmationCloseTopFraction;
  return range > 0 && body > 0 && body >= cfg.confirmationBodyMin * range && c.close <= c.low + bottom * range && c.close < previous.low && point.ema200 !== null && c.close < point.ema200;
}

export function latestSwing(candles: Candle[], index: number, direction: "BUY" | "SELL", cfg: XauTrendPullbackH1Config): number | null {
  const lastCandidate = index - cfg.swingFractalRadius - 1;
  const firstCandidate = Math.max(cfg.swingFractalRadius, index - cfg.swingLookback - cfg.swingFractalRadius);
  for (let k = lastCandidate; k >= firstCandidate; k--) {
    let valid = true;
    for (let offset = 1; offset <= cfg.swingFractalRadius; offset++) {
      if (direction === "BUY" && !(candles[k].low < candles[k - offset].low && candles[k].low < candles[k + offset].low)) valid = false;
      if (direction === "SELL" && !(candles[k].high > candles[k - offset].high && candles[k].high > candles[k + offset].high)) valid = false;
    }
    if (valid) return direction === "BUY" ? candles[k].low : candles[k].high;
  }
  return null;
}

export function makeSignal(candles: Candle[], indicators: H1IndicatorPoint[], i: number, cfg: XauTrendPullbackH1Config): H1Signal | null {
  const point = indicators[i]; const c = candles[i];
  if (point.ema50 === null || point.ema200 === null || point.atr14 === null || point.atr14 <= 0) return null;
  if (Math.abs(point.ema50 - point.ema200) < cfg.trendAtrSeparation * point.atr14 || !pullbackValid(candles, indicators, i, cfg)) return null;
  const buy = point.ema50 > point.ema200 && c.close > point.ema200 && bullishConfirmation(candles, indicators, i, cfg);
  const sell = point.ema50 < point.ema200 && c.close < point.ema200 && bearishConfirmation(candles, indicators, i, cfg);
  if (!buy && !sell) return null;
  const direction = buy ? "BUY" : "SELL";
  return { index: i, direction, signalTime: iso(c.timestamp), entryIndex: i + 1, entryTime: iso(candles[i + 1].timestamp), atr14: point.atr14, ema50: point.ema50, ema200: point.ema200, swingPrice: latestSwing(candles, i, direction, cfg) };
}

type Position = { trade: BacktestTrade; direction: "BUY" | "SELL"; sl: number; tp: number; entryDay: string };

export class TrendPullbackH1Engine {
  readonly trades: BacktestTrade[] = [];
  readonly equity: EquityPoint[] = [];
  readonly indicators: H1IndicatorPoint[];
  balance: number;
  readonly requestedStartDate: string;
  effectiveTradingStart: string | null = null;
  readonly warmupCandlesUsed: number;
  private position: Position | null = null;
  private pending: H1Signal | null = null;
  private seq = 0;
  private lastCandle: Candle | null = null;
  private readonly tradesByDay = new Map<string, number>();
  private readonly lossesByDay = new Map<string, number>();

  constructor(private readonly candles: Candle[], private readonly cfg: XauTrendPullbackH1Config, private readonly fromMs: number, private readonly toMs: number) {
    this.balance = cfg.initialBalance; this.requestedStartDate = cfg.startDate; this.warmupCandlesUsed = cfg.warmupCandles; this.indicators = calculateH1Indicators(candles, cfg.emaFastPeriod, cfg.emaSlowPeriod, cfg.atrPeriod); this.equity.push({ time: iso(fromMs), balance: this.balance });
  }

  run(): void {
    const first = this.candles.findIndex((c) => c.timestamp >= this.fromMs);
    const selected = this.candles.filter((c) => c.timestamp >= this.fromMs && c.timestamp <= this.toMs);
    const tradingStartIndex = first + this.cfg.warmupCandles;
    if (first < 0 || selected.length < this.cfg.warmupCandles + 1 || !hasH1Warmup(this.candles, tradingStartIndex)) throw new Error("INSUFFICIENT_H1_WARMUP");
    this.effectiveTradingStart = iso(this.candles[tradingStartIndex].timestamp);
    for (let i = tradingStartIndex; i < this.candles.length; i++) {
      const c = this.candles[i]; if (c.timestamp > this.toMs) break;
      const hadPosition = this.position !== null;
      if (this.position) this.checkExit(c);
      let entered = false;
      if (this.pending && this.pending.entryIndex === i) { entered = this.enter(c, this.pending); this.pending = null; }
      if (!hadPosition && !entered && !this.position && i < this.candles.length - 1) this.pending = makeSignal(this.candles, this.indicators, i, this.cfg);
      this.lastCandle = c;
    }
    this.finish();
  }

  private canEnter(day: string): boolean { return (this.tradesByDay.get(day) ?? 0) < this.cfg.maxTradesPerDay && (this.lossesByDay.get(day) ?? 0) < this.cfg.maxLossesPerDay && this.position === null; }

  private enter(c: Candle, signal: H1Signal): boolean {
    const entryDay = dayOf(c.timestamp); if (!this.canEnter(entryDay)) return false;
    const riskAtr = this.cfg.stopAtrMultiple * signal.atr14; let sl: number; let tp: number;
    if (signal.direction === "BUY") { const structural = signal.swingPrice === null ? Number.POSITIVE_INFINITY : signal.swingPrice - this.cfg.swingBufferAtr * signal.atr14; sl = Math.min(c.open - riskAtr, structural); const risk = c.open - sl; if (!(risk > 0)) return false; tp = c.open + this.cfg.riskReward * risk; }
    else { const structural = signal.swingPrice === null ? Number.NEGATIVE_INFINITY : signal.swingPrice + this.cfg.swingBufferAtr * signal.atr14; sl = Math.max(c.open + riskAtr, structural); const risk = sl - c.open; if (!(risk > 0)) return false; tp = c.open - this.cfg.riskReward * risk; }
    const trade: BacktestTrade = { id: `H1-T${++this.seq}`, direction: signal.direction, referenceH4Time: signal.signalTime, referenceHigh: this.candles[signal.index].high, referenceLow: this.candles[signal.index].low, breakoutLevel: c.open, entryTime: iso(c.timestamp), entryPrice: round2(c.open), stopLoss: round2(sl), takeProfit: round2(tp), exitTime: null, exitPrice: null, result: "WIN", pips: 0, grossProfit: 0, commission: 0, netProfit: 0, balanceBefore: this.balance, balanceAfter: this.balance };
    this.tradesByDay.set(entryDay, (this.tradesByDay.get(entryDay) ?? 0) + 1); this.position = { trade, direction: signal.direction, sl, tp, entryDay }; this.checkExit(c); return true;
  }

  private checkExit(c: Candle): void {
    const p = this.position; if (!p) return;
    const slHit = p.direction === "BUY" ? c.low <= p.sl : c.high >= p.sl; const tpHit = p.direction === "BUY" ? c.high >= p.tp : c.low <= p.tp;
    if (!slHit && !tpHit) return;
    const exit = slHit ? p.sl : p.tp; const t = p.trade; t.exitTime = iso(c.timestamp); t.exitPrice = round2(exit); this.settle(t, exit, slHit && tpHit); this.position = null;
  }

  private settle(t: BacktestTrade, exit: number, ambiguous: boolean): void {
    const gross = grossProfit(t.direction, t.entryPrice, exit, this.cfg.lot); t.pips = round2(tradePips(t.direction, t.entryPrice, exit)); t.grossProfit = round2(gross); t.netProfit = round2(netProfit(gross, 0)); t.balanceBefore = round2(this.balance); this.balance = round2(this.balance + t.netProfit); t.balanceAfter = this.balance; t.result = t.netProfit > 0 ? "WIN" : t.netProfit < 0 ? "LOSS" : "BREAKEVEN"; void ambiguous; this.trades.push(t); this.equity.push({ time: t.exitTime ?? t.entryTime, balance: this.balance }); if (t.result === "LOSS") this.lossesByDay.set(dayOf(Date.parse(t.entryTime)), (this.lossesByDay.get(dayOf(Date.parse(t.entryTime))) ?? 0) + 1);
  }

  private finish(): void { if (!this.position || !this.lastCandle) return; const t = this.position.trade; const exit = this.lastCandle.close; t.exitTime = iso(this.lastCandle.timestamp); t.exitPrice = round2(exit); t.result = "OPEN_AT_END"; this.settle(t, exit, false); this.position = null; }
}

export function runTrendPullbackH1(candles: Candle[], cfg: XauTrendPullbackH1Config, fromMs: number, toMs: number) {
  const engine = new TrendPullbackH1Engine(candles, cfg, fromMs, toMs); engine.run(); return engine;
}
