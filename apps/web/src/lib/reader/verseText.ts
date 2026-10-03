/**
 * Verse furniture split off a word for display only (RDR-547). The sajda sign ۩ ends the stored word
 * it follows; the reader draws it beside the word button as a non-interactive mark, so the button holds
 * the word alone. Joining the two gives back the stored token unchanged (L1).
 */
export const SAJDA = "۩";

export function splitFurniture(text: string): { word: string; sajda: boolean } {
  return text.endsWith(SAJDA) ? { word: text.slice(0, -SAJDA.length), sajda: true } : { word: text, sajda: false };
}

/** A rendered word as stored: its button's text plus a sajda sign drawn after it. */
export function tokenText(w: Element): string {
  const next = w.nextElementSibling;
  const tail = next instanceof HTMLElement && next.dataset.furniture === "sajda" ? (next.textContent ?? "") : "";
  return (w.textContent ?? "") + tail;
}
