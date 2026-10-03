/** Kind and tag per dictionary (design 03 §3.5.4, RDR-047…056; the editor's Meaning, EDT-178): what each lexicon is,
 * as modern editors catalogue its scope and transmission — not a ranking of authority. */
export const DICT_KIND: Record<string, { kind: "earliest" | "general" | "root" | "interpretive" | "english"; tag: string }> = {
  ayn: { kind: "earliest", tag: "earliest" },
  tahdhib: { kind: "general", tag: "general" },
  sihah: { kind: "general", tag: "selective" },
  maqayis: { kind: "root", tag: "rootSemantic" },
  mufradat: { kind: "interpretive", tag: "interpretive" },
  "ibn-qutaybah-gharib": { kind: "interpretive", tag: "gharib" },
  lisan: { kind: "general", tag: "comprehensive" },
  qamus: { kind: "general", tag: "concise" },
  taj: { kind: "general", tag: "encyclopedic" },
  lane: { kind: "english", tag: "english" },
};
