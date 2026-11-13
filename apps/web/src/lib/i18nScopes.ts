import type { AbstractIntlMessages } from "next-intl";

/**
 * The message namespaces each route group sends to the browser (the server reads every one). Sending all of them
 * put 31 KB of compressed copy into every page, and al-Baqara past its 300 KB budget; a group now sends what the
 * components reachable from its pages ask for. `i18nScopes.test.ts` recomputes that from the imports and fails when
 * a list falls behind the code. A dotted name ("hub.dest") sends that part of a namespace only.
 */
export const SCOPES = {
  root: ["common"],
  app: ["account", "board", "common", "graph", "hub.dest", "nav", "search"],
  reader: ["account", "audio", "board", "common", "contrib", "notebook", "panel", "rd", "review", "wordContrib"],
  site: ["account", "analyse", "ask", "audio", "board", "books", "changelog", "charts", "classroom", "common", "concordance", "contrib", "dataset", "dictionary", "explore", "graph", "hadith", "hub", "lexicon", "library", "me", "nav", "notebook", "ops", "panel", "rd", "review", "rootTexts", "roots", "saved", "search", "stats", "surah", "transparency", "wordContrib", "workbench"],
} as const;

export function pick(messages: AbstractIntlMessages, names: readonly string[]): AbstractIntlMessages {
  const out: AbstractIntlMessages = {};
  for (const name of names) {
    const parts = name.split(".");
    let from: unknown = messages;
    for (const p of parts) from = from && typeof from === "object" ? (from as AbstractIntlMessages)[p] : undefined;
    if (from === undefined) continue;
    let to = out;
    for (const p of parts.slice(0, -1)) to = (to[p] ??= {}) as AbstractIntlMessages;
    to[parts[parts.length - 1]] = from as AbstractIntlMessages;
  }
  return out;
}

/** Whether a scope sends a namespace a component asks for: the namespace itself, or a part of it that holds it. */
export function covers(scope: readonly string[], ns: string): boolean {
  return scope.some((s) => ns === s || ns.startsWith(s + "."));
}
