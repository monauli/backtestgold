"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/data", label: "Data XAUUSD" },
  { href: "/new", label: "New Backtest" },
  { href: "/batch-backtest", label: "Batch Backtest" },
  { href: "/results", label: "Backtest Results" },
  { href: "/compare", label: "Compare Results" },
  { href: "/prop-firm", label: "Prop Firm Simulator" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r border-slate-800 bg-slate-900 p-4">
      <Link href="/" className="mb-6 block text-lg font-bold text-amber-400">BACKTESTGOLD</Link>
      <nav className="space-y-1" aria-label="Main navigation">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
            className={`block rounded px-3 py-2 text-sm transition-colors ${active
              ? "bg-amber-500/15 font-semibold text-amber-300 ring-1 ring-amber-500/40"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
            {item.label}
          </Link>;
        })}
      </nav>
    </aside>
  );
}
