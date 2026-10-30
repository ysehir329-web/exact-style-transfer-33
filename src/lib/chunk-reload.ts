// Recovers from stale code chunks (after a new publish or a dev-server re-bundle):
// when a lazily loaded page piece fails to import, reload the page once.
const KEY = "chunk-reload-at";
const WINDOW_MS = 10_000;

export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS/i.test(
    msg,
  );
}

/** Reloads once per 10s window. Returns true if a reload was triggered. */
export function reloadForChunkError(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // storage unavailable: still try a single reload
  }
  window.location.reload();
  return true;
}

export function installChunkReloadHandler() {
  if (typeof window === "undefined") return;
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForChunkError()) event.preventDefault();
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) reloadForChunkError();
  });
}
