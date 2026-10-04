/**
 * Every surface of the platform, for the hub's "everything" grid (HUB-10…27, 47, Q05, Q06): each with a
 * purpose line the reader can see (not a tooltip) and, while it is still being built, the phase that builds
 * it — for us: the reader sees "being built", not a plan code — so nothing is promised as working before it
 * does. Keys index the `hub.dest` messages. No design exploration codes, and no type colours: those classify
 * linguistic objects only (02 §2.1, HUB-50).
 */
export type Destination = { key: string; href: string | null; phase?: string };

export const DESTINATIONS: Destination[] = [
  { key: "read", href: "/read" },
  { key: "ask", href: "/read?mode=ask" },
  { key: "explore", href: "/explore" },
  { key: "library", href: "/library" },
  { key: "lookup", href: "/read?mode=lookup" },
  { key: "roots", href: "/roots" },
  { key: "concordance", href: "/concordance" },
  { key: "analyser", href: "/analyse" },
  { key: "search", href: "/search" },
  { key: "graph", href: "/graph" },
  { key: "split", href: "/split" },
  { key: "review", href: "/read?mode=review" },
  { key: "notebook", href: "/notebook" },
  { key: "saved", href: "/saved" },
  { key: "reviewQueue", href: "/review" },
  { key: "classroom", href: "/classroom", phase: "P9" },
  { key: "published", href: null, phase: "P8" },
  { key: "profile", href: "/me" },
  { key: "api", href: "/developers" },
  { key: "sources", href: "/sources" },
];
