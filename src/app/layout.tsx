import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./sidebar";

export const metadata: Metadata = {
  title: "BACKTESTGOLD",
  description: "XAUUSD H4 Breakout backtester",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
