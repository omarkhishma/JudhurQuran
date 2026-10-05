import type { AbstractIntlMessages } from "next-intl";

/**
 * The message namespaces each route group sends to the browser (the server reads every one). Sending all of them
 * put 31 KB of compressed copy into every page, and al-Baqara past its 300 KB budget; a group now sends what the
 * components reachable from its pages ask for. `i18nScopes.test.ts` recomputes that from the imports and fails when
 * a list falls behind the code.
 */
export const SCOPES = {
  root: ["common"],
  app: ["account", "board", "common", "graph", "nav", "search"],
  reader: ["account", "audio", "board", "common", "contrib", "notebook", "panel", "rd", "review", "wordContrib"],
  site: ["account", "analyse", "audio", "board", "books", "changelog", "classroom", "common", "concordance", "contrib", "dataset", "dictionary", "explore", "graph", "hadith", "hub", "lexicon", "library", "me", "nav", "notebook", "ops", "panel", "rd", "review", "rootTexts", "roots", "saved", "search", "surah", "transparency", "wordContrib", "workbench"],
} as const;

export function pick(messages: AbstractIntlMessages, names: readonly string[]): AbstractIntlMessages {
  return Object.fromEntries(names.filter((n) => n in messages).map((n) => [n, messages[n]]));
}
