/**
 * The UI is served by the same Express process that does the scanning, so every
 * call is same-origin and needs no host. In `npm run dev` Vite proxies /api
 * through to the server instead (see vite.config.js).
 */
export const API = "/api";

/**
 * The backend exposes file contents at GET /api/file/:filePath, so the whole
 * absolute path travels as one encoded path segment.
 */
export async function fetchSource(path) {
  const response = await fetch(`${API}/file/${encodeURIComponent(path)}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.contents !== "string") {
    throw new Error(body.error || `Could not read ${path}`);
  }
  return body.contents;
}
