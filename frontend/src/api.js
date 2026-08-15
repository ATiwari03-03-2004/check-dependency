export const API = "http://localhost:3000";

/**
 * The backend exposes file contents at GET /:filePath, so the whole absolute
 * path travels as one encoded path segment.
 */
export async function fetchSource(path) {
  const response = await fetch(`${API}/${encodeURIComponent(path)}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.contents !== "string") {
    throw new Error(body.error || `Could not read ${path}`);
  }
  return body.contents;
}
