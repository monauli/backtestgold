import Link from "next/link";
import { getMongoDb } from "@/lib/mongodb";
import DeleteBatchButton from "./delete-button";

export const dynamic = "force-dynamic";

type BatchRow = {
  combinationId: string; rank?: number; strategyId?: string;
  breakoutPips?: number; stopLossPips?: number; takeProfitPips?: number; riskReward?: number;
  emaFast?: number; emaSlow?: number; atrPeriod?: number;
  totalTrades?: number; wins?: number; losses?: number; winRate?: number; profitFactor?: number;
  netProfit?: number; maximumDrawdownPercent?: number; overallScore?: number;
  status?: string; qualification?: string; detailRunId?: string;
};

export default async function BatchResult({ params }: { params: { batchId: string } }) {
  const db = await getMongoDb();
  const job = await db.collection("batch_backtest_jobs").findOne({ batchId: params.batchId });
  if (!job) return <div>Batch Not Found</div>;
  const rows = await db.collection<BatchRow>("batch_backtest_results").find({ batchId: params.batchId }).sort({ rank: 1, combinationId: 1 }).toArray();
  const qualified = rows.filter((x) => x.qualification === "QUALIFIED").length;
  const h1 = job.strategyId === "xau_trend_pullback_h1" || job.config?.strategyId === "xau_trend_pullback_h1";
  const headers = h1 ? ["Rank", "EMA", "ATR", "RR", "Trades", "Win", "Loss", "Win Rate", "PF", "Net Profit", "Max DD %", "Score", "Status", "Action"] : ["Rank", "Breakout", "SL", "TP", "RR", "Trades", "Win", "Loss", "Win Rate", "PF", "Net Profit", "Max DD %", "Score", "Status", "Action"];
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">{params.batchId}</h2><p className="text-sm text-slate-400">Batch Backtest · {job.config.startDate} → {job.config.endDate}</p></div><DeleteBatchButton batchId={params.batchId} /></div><div className="grid grid-cols-2 gap-3 md:grid-cols-5"><div className="rounded border border-slate-800 bg-slate-900 p-3">Strategy<br/><b>{h1 ? "XAU Trend Pullback H1" : "Breakout H4"}</b></div><div className="rounded border border-slate-800 bg-slate-900 p-3">Status<br/><b>{job.status}</b></div><div className="rounded border border-slate-800 bg-slate-900 p-3">Combinations<br/><b>{job.completedCombinations}/{job.totalCombinations}</b></div><div className="rounded border border-slate-800 bg-slate-900 p-3">Qualified<br/><b>{qualified}</b></div><div className="rounded border border-slate-800 bg-slate-900 p-3">Lot<br/><b>{job.config.lot}</b></div></div><div className="overflow-x-auto rounded-lg border border-slate-800"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-slate-900 text-left text-slate-400"><tr>{headers.map((x) => <th className="p-3" key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((r, i) => { const common = <><td className="p-3">{r.rank || "-"}</td><td className="p-3">{h1 ? `EMA${r.emaFast ?? 50}/EMA${r.emaSlow ?? 200}` : r.breakoutPips}</td><td className="p-3">{h1 ? `ATR${r.atrPeriod ?? 14}` : r.stopLossPips}</td><td className="p-3">{h1 ? "1:2" : r.takeProfitPips}</td><td className="p-3">{h1 ? `1:${Number(r.riskReward ?? 2).toFixed(2)}` : `1:${Number(r.riskReward).toFixed(2)}`}</td></>; return <tr className={i < 5 ? "border-t border-amber-800 bg-amber-950/20" : "border-t border-slate-800"} key={r.combinationId}>{common}<td className="p-3">{r.totalTrades ?? "-"}</td><td className="p-3">{r.wins ?? "-"}</td><td className="p-3">{r.losses ?? "-"}</td><td className="p-3">{r.winRate?.toFixed?.(2) ?? "-"}%</td><td className="p-3">{r.profitFactor?.toFixed?.(2) ?? "-"}</td><td className="p-3">{r.netProfit?.toFixed?.(2) ?? "-"}</td><td className="p-3">{r.maximumDrawdownPercent?.toFixed?.(2) ?? "-"}</td><td className="p-3">{r.overallScore?.toFixed?.(2) ?? "-"}</td><td className="p-3">{r.status === "FAILED" ? "FAILED" : r.qualification || r.status}</td><td className="p-3">{r.detailRunId ? <Link className="text-amber-300" href={`/results/${r.detailRunId}`}>View Full Result</Link> : "Summary"}</td></tr>; })}</tbody></table></div></div>;
}
