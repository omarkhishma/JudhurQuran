/**
 * Find glossary terms inside running text (RDR-273, RDR-563): one pattern of every label, longest
 * first so «الفعل المزيد» wins over «الفعل» and "Form II" over "Form I", metacharacters escaped, and
 * Unicode-aware edges — JavaScript's `\b` only knows ASCII letters, so it would match «الأمر» inside
 * «الأمرين». A term matches only when no letter or combining mark touches either side.
 */
export type Run = { text: string; term?: string };

export function splitTerms(text: string, labels: { key: string; label: string }[]): Run[] {
  const usable = labels.filter((l) => l.label.trim().length > 1);
  if (!text || !usable.length) return [{ text }];
  const byLabel = new Map(usable.map((l) => [l.label.toLocaleLowerCase(), l.key]));
  const alternatives = [...byLabel.keys()].sort((a, b) => b.length - a.length).map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(?<![\\p{L}\\p{M}])(${alternatives.join("|")})(?![\\p{L}\\p{M}])`, "giu");
  const out: Run[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at) });
    out.push({ text: m[0], term: byLabel.get(m[0].toLocaleLowerCase()) });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
