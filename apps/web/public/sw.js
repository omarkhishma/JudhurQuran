/*
 * Jadhr's service worker (PLAN P12, offline scope): the pages a reader has read — a sūra, a hadith, a book's section,
 * their own text, a word's entry — and their saved items stay readable without a connection; everything else says it
 * needs one (/offline). Nothing here leaves the browser: it keeps copies of what this browser already fetched, never a
 * reader's account data (no request with credentials, nothing under /me, /auth, /sync, the board's or the classroom's).
 *
 * Pages and data: network first, the copy when the network fails. The build's own files (/_next/static, immutable):
 * the copy first. A page's copy is stored only once its own files are, so a page kept is a page that runs offline
 * (stored first, a copy taken offline before its scripts came drew its server HTML and never woke). Each cache keeps
 * its newest entries only.
 */
const VERSION = "v1";
const SHELL = `jadhr-shell-${VERSION}`;
const PAGES = `jadhr-pages-${VERSION}`;
const DATA = `jadhr-data-${VERSION}`;
const STATIC = `jadhr-static-${VERSION}`;
const KEEP = { [PAGES]: 60, [DATA]: 800, [STATIC]: 600 };
const OFFLINE = ["/offline", "/en/offline"];

// the reading pages kept for offline reading (with or without /en): the rest is not kept
const READING = /^\/(?:en\/)?(?:$|quran(?:\/|$)|read(?:\/|$)|word\/|roots\/|dictionary(?:\/|$)|hadith(?:\/|$)|books(?:\/|$)|library(?:\/|$)|saved$|notebook$|offline$)/;
// data never kept: the reader's account, the board, a class, maps being edited, proposals
const PRIVATE = /^\/api\/v1\/(?:me|auth|sync|editorial|board|contrib|classroom|graphs|published\/reports|analyse|review\/root|texts\/known)(?:\/|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      for (const url of OFFLINE) {
        try {
          const res = await fetch(url, { credentials: "omit" });
          if (res.ok) {
            await cache.put(url, res.clone());
            await keepAssets(await res.text());
          }
        } catch {}
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const mine = new Set([SHELL, PAGES, DATA, STATIC]);
      for (const name of await caches.keys()) if (name.startsWith("jadhr-") && !mine.has(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

/** Keep only the newest entries of a cache (insertion order is kept by the cache). */
async function trim(name) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP[name]))) await cache.delete(k);
}

const STATIC_URL = /\/_next\/static\/[^"'\s)\\]+/g;

/** A page's own files (its scripts, styles and the fonts its styles name), so the copy of the page runs as it did. */
async function keepAssets(html) {
  const urls = new Set((html.match(STATIC_URL) || []).map((u) => u.replace(/&amp;/g, "&")));
  if (!urls.size) return;
  const cache = await caches.open(STATIC);
  const fetchOne = async (u) => {
    if (await cache.match(u)) return null;
    try {
      const res = await fetch(u);
      if (!res.ok) return null;
      await cache.put(u, res.clone());
      return u.endsWith(".css") ? await res.text() : null;
    } catch {
      return null;
    }
  };
  const css = await Promise.all([...urls].map(fetchOne));
  // the fonts a stylesheet names (url(/_next/static/media/…))
  const fonts = new Set(css.filter(Boolean).flatMap((t) => t.match(STATIC_URL) || []));
  await Promise.all([...fonts].map(fetchOne));
  await trim(STATIC);
}

/** A page's key in the cache: its path and its query written one way (2:32:4 and 2%3A32%3A4 are one place). */
function pageKey(url) {
  const qs = new URLSearchParams(url.search).toString();
  return url.pathname + (qs ? `?${qs}` : "");
}

/** A page's copy, stored after its own files. */
async function keepPage(key, res) {
  await keepAssets(await res.clone().text());
  await (await caches.open(PAGES)).put(key, res);
  await trim(PAGES);
}

async function page(request, event) {
  const url = new URL(request.url);
  try {
    const res = await fetch(request);
    if (res.ok && READING.test(url.pathname) && !res.headers.get("cache-control")?.includes("no-store")) {
      // kept in the background, the worker held alive until it is
      event.waitUntil(keepPage(pageKey(url), res.clone()).catch(() => undefined));
    }
    return res;
  } catch {
    const copy = (await caches.match(pageKey(url), { cacheName: PAGES })) || (await caches.match(url.pathname, { cacheName: PAGES, ignoreSearch: true }));
    if (copy) return copy;
    const offline = url.pathname.startsWith("/en/") || url.pathname === "/en" ? "/en/offline" : "/offline";
    return (await caches.match(offline, { cacheName: SHELL })) || Response.error();
  }
}

async function data(request) {
  try {
    const res = await fetch(request);
    if (res.ok && !res.headers.get("cache-control")?.includes("no-store")) {
      const cache = await caches.open(DATA);
      await cache.put(request, res.clone());
      trim(DATA);
    }
    return res;
  } catch {
    // the same data asked another way (another place of the word, another page size) is better than nothing
    return (await caches.match(request, { cacheName: DATA })) || (await caches.match(request, { cacheName: DATA, ignoreSearch: true })) || Response.error();
  }
}

async function asset(request) {
  const copy = await caches.match(request, { cacheName: STATIC });
  if (copy) return copy;
  const res = await fetch(request);
  if (res.ok) {
    const cache = await caches.open(STATIC);
    await cache.put(request, res.clone());
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.headers.get("authorization")) return;
  if (req.mode === "navigate") return event.respondWith(page(req, event));
  // a client-side move to another page: without a connection, a plain failure makes the app load the page itself,
  // which the copy of that page answers
  if (req.headers.get("rsc") || url.searchParams.has("_rsc")) {
    return event.respondWith(fetch(req).catch(() => new Response("offline", { status: 503, headers: { "content-type": "text/plain" } })));
  }
  if (url.pathname.startsWith("/_next/static/")) return event.respondWith(asset(req));
  if (url.pathname.startsWith("/api/v1/") && !PRIVATE.test(url.pathname)) return event.respondWith(data(req));
});

/** The reader's saved items, kept for offline reading as they are saved (lib/offline.ts sends their addresses). */
self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "jadhr-keep" || !Array.isArray(msg.pages) || !Array.isArray(msg.data)) return;
  event.waitUntil(
    (async () => {
      for (const p of msg.pages.slice(0, 50)) {
        if (typeof p !== "string" || !p.startsWith("/") || !READING.test(p.split("?")[0])) continue;
        try {
          const res = await fetch(p);
          if (res.ok) await keepPage(pageKey(new URL(p, self.location.origin)), res);
        } catch {}
      }
      for (const d of msg.data.slice(0, 200)) {
        if (typeof d !== "string" || !d.startsWith("/api/v1/") || PRIVATE.test(d.split("?")[0])) continue;
        try {
          await data(new Request(d));
        } catch {}
      }
    })(),
  );
});
