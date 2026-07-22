/** Query and guard used to keep saved final-method metadata out of simulation history. */
export const simulationHistoryFilter = { final: { $ne: true } };

export function isSimulationHistoryRecord(record: { final?: unknown }) {
  return record.final !== true;
}
