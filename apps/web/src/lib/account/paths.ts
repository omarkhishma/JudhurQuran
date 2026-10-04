/**
 * Where a reader goes after signing in: only a path on this site (security review L3). A path the browser would read
 * as another site's — "//evil.com", "/\evil.com", or one with a tab or a line break that the URL parser drops
 * ("/\t/evil.com" becomes "//evil.com") — goes to the account page instead. The API checks the same (accounts.py
 * `safe_return`).
 */
export function sitePath(p: unknown, fallback = "/me"): string {
  if (typeof p !== "string" || p.length > 300 || !p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return fallback;
  // no control character, no white space of any kind
  if (/[\u0000-\u0020\u007f-\u009f\s]/.test(p)) return fallback;
  try {
    const base = "https://site.invalid";
    return new URL(p, base).origin === base ? p : fallback;
  } catch {
    return fallback;
  }
}
