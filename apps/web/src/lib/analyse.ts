/** The Analyser's payload (API /analyse, services/api analyse.py) and its CoNLL-U export (P4.3, ANA-28, Q06). */

export type Label = { ar: string; en: string; tag: string };
export type Segment = { kind: "prefix" | "stem" | "suffix"; text: string; index: number; label?: Label; root?: string; features?: Record<string, unknown> };
export type Candidate = {
  lemma: { slug: string; ar: string; pos: string } | null;
  root: { key: string; spaced: string; translit: string } | null;
  pattern: { slug: string; ar: string } | null;
  pos: string | null;
  features: Record<string, Label | boolean | Record<string, unknown> | undefined> | null;
  segments: Segment[] | null;
  gloss_en: string | null;
  count: number;
  share: number;
  confidence: number;
  location: string | null;
};
export type TokenKind = "gold" | "form" | "clitic" | "pattern" | "particle" | "none";
export type AnalysedToken = {
  surface: string;
  key: string;
  kind: TokenKind;
  confidence: number;
  candidates: Candidate[];
  clitics: string[];
  stem?: string;
  particle?: Candidate;
  location?: string | null;
  /** the verse a Quranic token stands in (a reference, a range or a placed phrase) */
  verse_key?: string;
};
export type Analysis = {
  text: string;
  source: { kind: "quran" | "free"; verse_key: string | null; whole_verse: boolean };
  tokens: AnalysedToken[];
  counts: { tokens: number; roots: number; to_review: number };
  truncated: boolean;
};

/** The design's own sample phrase, prefilled on a first visit (ANA-03). Here, not in the screen: the server page reads it. */
export const SAMPLE = "إِنَّ العِلْمَ لَا يُدْرَكُ إِلَّا بِالتَّعَلُّمِ";

/** Below this a token is tinted and counted "to review" (ANA-08, ANA-18). */
export const REVIEW_BELOW = 0.8;

/** Universal POS for the corpus tags (UD Arabic conventions). */
const UPOS: Record<string, string> = {
  N: "NOUN", PN: "PROPN", ADJ: "ADJ", V: "VERB", IMPN: "NOUN", T: "ADV", LOC: "ADV",
  PRON: "PRON", DEM: "PRON", REL: "PRON", P: "ADP", CONJ: "CCONJ", SUB: "SCONJ",
  NEG: "PART", ACC: "PART", CERT: "PART", RES: "PART", INTG: "PART", COND: "SCONJ", FUT: "AUX",
  PRO: "PART", RET: "PART", EXP: "PART", INC: "PART", EXL: "PART", AMD: "PART", INT: "PART",
  EXH: "PART", ANS: "PART", SUR: "PART", AVR: "PART", SUP: "PART", INL: "X",
}; // prettier-ignore

/** Corpus feature tags → UD FEATS (name=value), sorted by name as UD requires. */
const FEATS: Record<string, Record<string, [string, string]>> = {
  case: { NOM: ["Case", "Nom"], ACC: ["Case", "Acc"], GEN: ["Case", "Gen"] },
  gender: { M: ["Gender", "Masc"], F: ["Gender", "Fem"] },
  number: { S: ["Number", "Sing"], D: ["Number", "Dual"], P: ["Number", "Plur"] },
  person: { "1": ["Person", "1"], "2": ["Person", "2"], "3": ["Person", "3"] },
  mood: { IND: ["Mood", "Ind"], SUBJ: ["Mood", "Sub"], JUS: ["Mood", "Jus"] },
  voice: { ACT: ["Voice", "Act"], PASS: ["Voice", "Pass"] },
  aspect: { PERF: ["Aspect", "Perf"], IMPF: ["Aspect", "Imp"], IMPV: ["Mood", "Imp"] },
};

function feats(c: Candidate | undefined, placed: boolean): string {
  // inflection is known only for a Quranic word read at its place
  const f = placed ? c?.features : null;
  if (!f) return "_";
  const out: string[] = [];
  for (const [k, map] of Object.entries(FEATS)) {
    const v = f[k] as Label | undefined;
    const hit = v && typeof v === "object" && "tag" in v ? map[String(v.tag)] : undefined;
    if (hit) out.push(`${hit[0]}=${hit[1]}`);
  }
  if (f.indefinite === true) out.push("Definite=Ind");
  return out.length ? out.sort().join("|") : "_";
}

const clean = (s: string) => s.replace(/[\t\n\r|=]/g, " ").trim() || "_";

/**
 * CoNLL-U for the analysis (UD Arabic conventions, ANA-Q06): `sent_id` and `text` comments, ten columns,
 * UPOS from the corpus tag, morphological features in FEATS, and Root, Pattern, Source, Confidence and the
 * Quran location in MISC (they are not UD features); a blank line ends the sentence. A token the reader
 * chose a candidate for exports that candidate.
 */
export function toConllu(a: Analysis, chosen: (t: AnalysedToken) => Candidate | undefined, sentId = "jadhr-analyse-1"): string {
  // Quranic tokens make one sentence per verse (sent_id = the verse); free text is one sentence
  const groups: { id: string; text: string; tokens: AnalysedToken[] }[] = [];
  for (const t of a.tokens) {
    const id = t.verse_key ? `quran-${t.verse_key}` : sentId;
    const g = groups[groups.length - 1];
    if (g && g.id === id) g.tokens.push(t);
    else groups.push({ id, text: "", tokens: [t] });
  }
  for (const g of groups) g.text = g.id === sentId ? a.text.replace(/\s+/g, " ") : g.tokens.map((t) => t.surface).join(" ");
  return groups.map((g) => sentence(a, g, chosen)).join("");
}

function sentence(a: Analysis, g: { id: string; text: string; tokens: AnalysedToken[] }, chosen: (t: AnalysedToken) => Candidate | undefined): string {
  const lines = [`# sent_id = ${g.id}`, `# text = ${g.text}`];
  g.tokens.forEach((t, i) => {
    const c = t.kind === "particle" ? t.particle : chosen(t);
    const pos = c?.pos ?? (t.kind === "particle" ? "P" : null);
    const misc: string[] = [];
    if (t.kind !== "particle" && c?.root) misc.push(`Root=${c.root.spaced.replace(/ /g, ".")}`);
    if (t.kind !== "particle" && c?.pattern) misc.push(`Pattern=${clean(c.pattern.ar)}`);
    misc.push(`Source=${t.kind === "gold" || (t.kind === "particle" && a.source.kind === "quran") ? "QAC" : `Jadhr-${t.kind}`}`);
    misc.push(`Confidence=${t.confidence.toFixed(2)}`);
    if (t.location) misc.push(`Loc=${t.location}`);
    lines.push([String(i + 1), clean(t.surface), c?.lemma ? clean(c.lemma.ar) : "_", pos ? (UPOS[pos] ?? "X") : "X", pos ?? "_", feats(c, t.kind === "gold"), "_", "_", "_", misc.join("|")].join("\t"));
  });
  return lines.join("\n") + "\n\n";
}
