import { describe, expect, it } from "vitest";
import { runOrderflowConfluenceV1 } from "@/strategies/orderflow_confluence_v1";
import type { Candle } from "@/backtest/types";
const c=(i:number,o:number,h:number,l:number,cl:number):Candle=>({timestamp:Date.UTC(2024,0,2,0,i),open:o,high:h,low:l,close:cl,volume:10});
const d=(day:number,h:number,l:number):Candle=>({timestamp:Date.UTC(2024,0,day),open:(h+l)/2,high:h,low:l,close:(h+l)/2,volume:1});
const cfg={lot:.35,initialBalance:10000,riskReward:2,stopBufferPips:1,minimumStopDistancePips:1,maximumStopDistancePips:300,maximumEntryDistanceFromLevelPips:100,maximumTradesPerSession:1,maximumTradesPerDay:2,cooldownBars:0,useProxyVwapBias:false,spreadPips:0,slippagePips:0,commissionPerLot:0};
describe("Order Flow Confluence V1",()=>{it("enters only on the M1 after a valid reclaim and records linked events",()=>{const out=runOrderflowConfluenceV1([c(0,100,101,98,99),c(1,99,101,99,100.5),c(2,101,102,100,101),c(3,101,103,100,102)], [d(1,102,99),d(2,103,99)],cfg);expect(out.trades.every(t=>t.entryReason==="SWEEP_RECLAIM_NEXT_OPEN")).toBe(true);expect(out.trades.every(t=>t.sweepEventId&&t.reclaimEventId)).toBe(true)});});
