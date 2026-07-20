"use client";
import { useRouter } from "next/navigation";
export default function DeleteBatchButton({ batchId }: { batchId: string }) { const router = useRouter(); return <button onClick={async()=>{if(!confirm(`Delete ${batchId} dan hanya detail Top 5 miliknya?`))return;const r=await fetch(`/api/batch-backtest/${batchId}`,{method:"DELETE"});if(r.ok)router.push("/batch-backtest");}} className="rounded border border-red-800 px-3 py-1.5 text-sm text-red-300">Delete Batch</button>; }
