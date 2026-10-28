const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /failed to load module script/i,
  /unable to preload css/i,
  /loading chunk [\w-]+ failed/i,
  /chunkloaderror/i,
];

/**
 * Detects common errors caused by a stale or unavailable lazy-loaded asset.
 * It intentionally does not classify generic network errors as chunk failures.
 */
export function isDynamicImportLoadError(error: unknown): boolean {
  let message = '';

  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === 'object' && 'message' in error) {
    const candidateMessage = (error as { message?: unknown }).message;
    if (typeof candidateMessage === 'string') message = candidateMessage;
  }

  return DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}
