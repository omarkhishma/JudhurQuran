/**
 * Every surface of the platform, for the hub's "everything" grid (HUB-10…27, 47, Q05, Q06): each with a
 * purpose line the reader can see (not a tooltip) and, while it is still being built, the phase that builds
 * it — for us: the reader sees "being built", not a plan code — so nothing is promised as working before it
 * does. Keys index the `hub.dest` messages. No design exploration codes, and no type colours: those classify
 * linguistic objects only (02 §2.1, HUB-50).
 */
export type DestinationGroup = "read" | "find" | "understand" | "draw" | "mine" | "others";
export type Destination = { key: string; href: string | null; phase?: string; group: DestinationGroup };

/** The groups the hub shows them in, in this order (audit 27 F06: twenty-six tiles of one weight, no grouping). */
export const DESTINATION_GROUPS: DestinationGroup[] = ["read", "find", "understand", "draw", "mine", "others"];

export const DESTINATIONS: Destination[] = [
  { key: "read", href: "/read", group: "read" },
  { key: "ask", href: "/read?mode=ask", group: "find" },
  { key: "askQuran", href: "/ask", group: "understand" },
  { key: "explore", href: "/explore", group: "read" },
  { key: "library", href: "/library", group: "read" },
  { key: "lookup", href: "/read?mode=lookup", group: "find" },
  { key: "roots", href: "/roots", group: "find" },
  { key: "dictionary", href: "/dictionary", group: "find" },
  { key: "hadith", href: "/hadith", group: "read" },
  { key: "books", href: "/books", group: "read" },
  { key: "concordance", href: "/concordance", group: "find" },
  { key: "analyser", href: "/analyse", group: "find" },
  { key: "stats", href: "/stats", group: "understand" },
  { key: "mindmap", href: "/mindmap", group: "understand" },
  { key: "search", href: "/search", group: "find" },
  { key: "graph", href: "/graph", group: "draw" },
  { key: "split", href: "/split", group: "draw" },
  { key: "review", href: "/read?mode=review", group: "mine" },
  { key: "notebook", href: "/notebook", group: "mine" },
  { key: "saved", href: "/saved", group: "mine" },
  { key: "reviewQueue", href: "/review", group: "others" },
  { key: "classroom", href: "/classroom", group: "others" },
  { key: "published", href: "/g", group: "draw" },
  { key: "profile", href: "/me", group: "mine" },
  { key: "api", href: "/developers", group: "others" },
  { key: "sources", href: "/sources", group: "others" },
];
