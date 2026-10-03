import type { AbstractIntlMessages } from "next-intl";

/**
 * The message namespaces each route group sends to the browser (the server reads every one). Sending all of them
 * put 31 KB of compressed copy into every page, and al-Baqara past its 300 KB budget; a group now sends what the
 * components reachable from its pages ask for. `i18nScopes.test.ts` recomputes that from the imports and fails when
 * a list falls behind the code.
 */
export const SCOPES = {
  root: ["common"],
  app: ["account", "common", "graph", "nav", "search"],
  reader: ["account", "audio", "common", "contrib", "graph", "notebook", "panel", "rd", "review", "wordContrib"],
  site: ["account", "analyse", "audio", "changelog", "common", "concordance", "contrib", "explore", "graph", "hub", "lexicon", "library", "me", "nav", "notebook", "panel", "rd", "review", "roots", "saved", "search", "surah", "wordContrib"],
} as const;

export function pick(messages: AbstractIntlMessages, names: readonly string[]): AbstractIntlMessages {
  return Object.fromEntries(names.filter((n) => n in messages).map((n) => [n, messages[n]]));
}
