import type { StrategyDefinition } from "@/strategies/types";
import { ORDERFLOW_CONFLUENCE_V1_ID, ORDERFLOW_CONFLUENCE_V1_NAME } from "./config";
export const orderflowConfluenceV1Strategy: StrategyDefinition = { id: ORDERFLOW_CONFLUENCE_V1_ID, name: ORDERFLOW_CONFLUENCE_V1_NAME, description: "M1 sweep/reclaim confluence with D1/weekly levels and fixed RR.", status: "READY", signalTimeframe: "M1", executionTimeframe: "M1", validateConfig: () => ({ valid: true, errors: [] }) };
