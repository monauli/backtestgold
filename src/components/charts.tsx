"use client";

import type { EquityPoint, MonthlyResult, SessionResult } from "@/backtest/types";

function polyline(values: number[], w: number, h: number, pad = 6): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (v - min) / span) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function EquityChart({ equity }: { equity: EquityPoint[] }) {
  const w = 720, h = 220;
  const values = equity.map((p) => p.balance);
  if (values.length < 2)
    return <p className="text-sm text-slate-400">Not enough data for chart.</p>;
  const min = Math.min(...values), max = Math.max(...values);
  return (
    <div className="h-[220px] w-full sm:h-[240px] lg:h-[250px]">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full rounded bg-slate-900">
      <polyline points={polyline(values, w, h)} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
      <text x="8" y="14" fill="#94a3b8" fontSize="11">{max.toFixed(2)}</text>
      <text x="8" y={h - 6} fill="#94a3b8" fontSize="11">{min.toFixed(2)}</text>
      </svg>
    </div>
  );
}

export function DrawdownChart({ equity }: { equity: EquityPoint[] }) {
  const w = 720, h = 180;
  let peak = -Infinity;
  const dd = equity.map((p) => {
    peak = Math.max(peak, p.balance);
    return peak > 0 ? ((peak - p.balance) / peak) * 100 : 0;
  });
  if (dd.length < 2)
    return <p className="text-sm text-slate-400">Not enough data for chart.</p>;
  const max = Math.max(...dd);
  // invert so drawdown grows downward visually
  const values = dd.map((v) => -v);
  return (
    <div className="h-[180px] w-full sm:h-[200px] lg:h-[210px]">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full rounded bg-slate-900">
      <polyline points={polyline(values, w, h)} fill="none" stroke="#f87171" strokeWidth="1.5" />
      <text x="8" y="14" fill="#94a3b8" fontSize="11">0%</text>
      <text x="8" y={h - 6} fill="#94a3b8" fontSize="11">-{max.toFixed(2)}%</text>
      </svg>
    </div>
  );
}

export function MonthlyChart({ monthly }: { monthly: MonthlyResult[] }) {
  const w = 720, h = 180, pad = 8;
  if (monthly.length === 0)
    return <p className="text-sm text-slate-400">No monthly data.</p>;
  const values = monthly.map((m) => m.netProfit);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const bw = (w - 2 * pad) / monthly.length;
  const zeroY = pad + (max / span) * (h - 2 * pad);
  return (
    <div className="h-[210px] w-full sm:h-[230px] lg:h-[240px]">
      <svg viewBox={`0 0 ${w} ${h + 20}`} preserveAspectRatio="none" className="h-full w-full rounded bg-slate-900">
      {monthly.map((m, i) => {
        const vh = (Math.abs(m.netProfit) / span) * (h - 2 * pad);
        const y = m.netProfit >= 0 ? zeroY - vh : zeroY;
        return (
          <g key={m.month}>
            <rect
              x={pad + i * bw + 1}
              y={y}
              width={Math.max(bw - 2, 1)}
              height={Math.max(vh, 0.5)}
              fill={m.netProfit >= 0 ? "#34d399" : "#f87171"}
            />
            {monthly.length <= 24 && (
              <text
                x={pad + i * bw + bw / 2}
                y={h + 14}
                fill="#94a3b8"
                fontSize="9"
                textAnchor="middle"
              >
                {m.month.slice(2)}
              </text>
            )}
          </g>
        );
      })}
      <line x1={pad} x2={w - pad} y1={zeroY} y2={zeroY} stroke="#475569" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

export function SessionChart({ sessions }: { sessions: SessionResult[] }) {
  const max = Math.max(...sessions.map((s) => Math.abs(s.netProfit)), 1);
  return <div className="grid gap-3 sm:grid-cols-3">
    {sessions.map((s) => <div key={s.session} className="rounded bg-slate-900 p-3">
      <div className="text-xs uppercase text-slate-400">{s.session.replace("_", " ")}</div>
      <div className={s.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}>{s.netProfit >= 0 ? "+" : ""}${s.netProfit.toFixed(2)}</div>
      <div className="mt-2 h-2 rounded bg-slate-800"><div className={s.netProfit >= 0 ? "h-2 rounded bg-emerald-400" : "h-2 rounded bg-red-400"} style={{ width: `${Math.max(4, Math.abs(s.netProfit) / max * 100)}%` }} /></div>
      <div className="mt-1 text-xs text-slate-500">{s.trades} trade · {s.wins} win · {s.losses} loss</div>
    </div>)}
  </div>;
}
