/** Readable message of anything that was thrown or passed to a rejection handler. */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
