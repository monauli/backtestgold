import { FINAL_METHOD, type SavedMethod } from "@/config/saved-methods";

export function activeMethods(methods: SavedMethod[]) { return methods.filter((method) => method.status === "ACTIVE"); }
export function archivedMethods(methods: SavedMethod[]) { return methods.filter((method) => method.status === "ARCHIVED"); }
export function defaultMethodId(methods: SavedMethod[]) { return methods.find((method) => method.isFinal && method.status === "ACTIVE")?.id ?? activeMethods(methods)[0]?.id ?? ""; }

export function archiveMethod(methods: SavedMethod[], methodId: string, now = new Date().toISOString()): SavedMethod[] {
  return methods.map((method) => {
    if (method.id !== methodId) return method;
    if (method.isFinal) throw new Error("Final method tidak dapat diarsipkan.");
    return { ...method, status: "ARCHIVED", archivedAt: now, archivedReason: "Archived by user." };
  });
}

export function restoreMethod(methods: SavedMethod[], methodId: string): SavedMethod[] {
  return methods.map((method) => method.id === methodId
    ? { ...method, status: "ACTIVE", archivedAt: undefined, archivedReason: undefined }
    : method);
}

export function isRunnableMethod(method: SavedMethod | undefined) { return Boolean(method && method.status === "ACTIVE"); }
export function selectedLotForMethod(method: SavedMethod | undefined, requestedLot: string) { return method?.isFinal ? method.lot.toFixed(2) : requestedLot; }
export function canArchiveMethod(method: SavedMethod | undefined) { return Boolean(method && !method.isFinal); }
export function finalMethodInvariant(methods: SavedMethod[]) { return methods.filter((method) => method.isFinal && method.status === "ACTIVE").length === 1 && methods.some((method) => method.id === FINAL_METHOD.id && method.status === "ACTIVE"); }
