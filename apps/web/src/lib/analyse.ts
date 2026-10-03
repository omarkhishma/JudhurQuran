/** The Analyser's payload (API /analyse, services/api analyse.py) and its CoNLL-U export (P4.3, ANA-28, Q06). */

export type Label = { ar: string; en: string; tag: string };
export type Segment = { kind: "prefix" | "stem" | "suffix"; text: string; index: number; label?: Label; root?: string; features?: Record<string, Label | undefined> };
export type Candidate = {
  lemma: { slug: string; ar: string; pos: string } | null;
  root: { key: string; spaced: string; translit: string } | null;
  pattern: { slug: string; ar: string } | null;
  pos: string | null;
  features: Record<string, Label | boolean | Record<string, unknown> | undefined> | null;
  segments: Segment[] | null;
  gloss_en: string | null;
  /** the word's transliteration where the corpus reads it (ANA-25) */
  translit?: string | null;
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

// participles and verbal nouns (ANA-30): UD Arabic writes them with VerbForm, a participle with its voice
const DERIVATION: Record<string, string[]> = { ACT_PCPL: ["VerbForm=Part", "Voice=Act"], PASS_PCPL: ["VerbForm=Part", "Voice=Pass"], VN: ["VerbForm=Vnoun"] };

function featList(c: Candidate | undefined, placed: boolean): string[] {
  // inflection is known only for a Quranic word read at its place
  const f = placed ? c?.features : null;
  if (!f) return [];
  const out: string[] = [];
  for (const [k, map] of Object.entries(FEATS)) {
    const v = f[k] as Label | undefined;
    const hit = v && typeof v === "object" && "tag" in v ? map[String(v.tag)] : undefined;
    if (hit) out.push(`${hit[0]}=${hit[1]}`);
  }
  const d = f.derivation as Label | undefined;
  for (const x of (d && DERIVATION[String(d.tag)]) ?? []) if (!out.some((o) => o.split("=")[0] === x.split("=")[0])) out.push(x);
  if (f.indefinite === true) out.push("Definite=Ind");
  return out;
}

const featStr = (xs: string[]) => (xs.length ? [...new Set(xs)].sort().join("|") : "_");

function feats(c: Candidate | undefined, placed: boolean): string {
  return featStr(featList(c, placed));
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

/** One syntactic word of a CoNLL-U sentence. */
type Part = { form: string; lemma: string; upos: string; xpos: string; feats: string; misc: string[] };

// proclitics by the corpus's prefix tag (UD Arabic): conjunctions, prepositions, the future «سَ», particles
const PREFIX_POS: Record<string, [string, string]> = {
  "bi+": ["ADP", "P"], "ka+": ["ADP", "P"], "ta+": ["ADP", "P"], "sa+": ["AUX", "FUT"], "ya+": ["PART", "VOC"], "ha+": ["PART", "ATT"],
}; // prettier-ignore
const PREFIX_FUNCTION: Record<string, string> = { CONJ: "CCONJ", REM: "CCONJ", RSLT: "CCONJ", CAUS: "SCONJ", CIRC: "SCONJ", PRP: "SCONJ", P: "ADP" };
function prefixPos(tag: string): [string, string] {
  if (PREFIX_POS[tag]) return PREFIX_POS[tag];
  const f = tag.match(/:([A-Z]+)\+$/)?.[1] ?? "X";
  return [PREFIX_FUNCTION[f] ?? "PART", f];
}

/** «PRON:3MP» → Gender=Masc|Number=Plur|Person=3, and the person-gender-number to compare with a verb's. */
function pron(tag: string): { feats: string; pgn: { p: string; g: string; n: string } } | null {
  const m = tag.match(/PRON:(\d)([MF]?)([SDP])/);
  if (!m) return null;
  const xs = [`Person=${m[1]}`, `Number=${FEATS.number[m[3]][1]}`, ...(m[2] ? [`Gender=${FEATS.gender[m[2]][1]}`] : [])];
  return { feats: featStr(xs), pgn: { p: m[1], g: m[2], n: m[3] } };
}

// the letters a free-text clitic was read as (analyse.py _PREFIXES / _SUFFIXES), the article kept on its word
const PROCLITIC: Record<string, [string, string]> = { "و": ["CCONJ", "CONJ"], "ف": ["CCONJ", "CONJ"], "ب": ["ADP", "P"], "ك": ["ADP", "P"], "ل": ["ADP", "P"], "س": ["AUX", "FUT"] };
const ENCLITIC: Record<string, string> = { "ه": "3MS", "ها": "3FS", "هما": "3D", "هم": "3MP", "هن": "3FP", "ك": "2S", "كما": "2D", "كم": "2MP", "كن": "2FP", "ني": "1S", "ي": "1S", "نا": "1P", "تم": "2MP", "تما": "2D" };

/**
 * A token as UD Arabic tokenises it (ANA-Q06): proclitics and object or possessive pronouns are words of
 * their own under a multiword-token range; the article stays on its word (Definite=Def); a verb's subject
 * suffix, which agrees with the verb, stays on the verb. Quranic words split by the corpus's segments; a
 * free-text word by the clitics it was read with.
 */
function split(t: AnalysedToken, c: Candidate | undefined, whole: Part, placed: boolean): Part[] {
  const segs = c?.segments;
  if (segs && segs.length > 1 && (t.kind === "gold" || t.kind === "form" || t.kind === "particle")) {
    const si = segs.findIndex((s) => s.kind === "stem");
    if (si < 0) return [whole];
    const stem = segs[si];
    let form = stem.text;
    let definite = false;
    const pre: Part[] = [];
    for (const s of segs.slice(0, si)) {
      const tag = s.label?.tag ?? "";
      if (tag === "Al+") {
        form = s.text + form;
        definite = true;
        continue;
      }
      const [u, x] = prefixPos(tag);
      pre.push({ form: s.text, lemma: clean(s.text), upos: u, xpos: x, feats: "_", misc: [] });
    }
    const sf = stem.features ?? {};
    const stemPos = sf.pos?.tag ?? c?.pos;
    const post: Part[] = [];
    segs.slice(si + 1).forEach((s, k) => {
      const tag = s.label?.tag ?? "";
      const pr = pron(tag);
      // the verb's own subject: its first suffix, agreeing with it in person and number (and gender when both give it)
      const agrees = !!pr && stemPos === "V" && k === 0 && pr.pgn.p === String(sf.person?.tag ?? "") && pr.pgn.n === String(sf.number?.tag ?? "") && (!pr.pgn.g || !sf.gender?.tag || pr.pgn.g === String(sf.gender.tag));
      if (agrees || tag === "+n:EMPH" || tag === "+VOC") {
        form += s.text;
        return;
      }
      post.push(pr ? { form: s.text, lemma: clean(s.text), upos: "PRON", xpos: "PRON", feats: pr.feats, misc: [] } : { form: s.text, lemma: clean(s.text), upos: "PART", xpos: tag.replace(/[+:]/g, "") || "_", feats: "_", misc: [] });
    });
    if (!pre.length && !post.length) return [whole];
    const fs = featList(c, placed);
    return [...pre, { ...whole, form, feats: featStr(definite && !fs.includes("Definite=Ind") ? [...fs, "Definite=Def"] : fs) }, ...post];
  }
  if (t.kind === "clitic" && t.clitics.length && t.stem) {
    const [p, s] = [t.clitics.find((x) => t.key.startsWith(x)) ?? "", t.clitics.find((x) => !t.key.startsWith(x) && t.key.endsWith(x)) ?? ""];
    // «وال»/«بال»: letters, then the article; «لل»/«ولل»: the preposition ل, then the article whose alif fell
    const article = p.endsWith("ال") || p.endsWith("لل") ? "ال" : "";
    const letters = p.endsWith("ال") ? p.slice(0, -2) : p.endsWith("لل") ? p.slice(0, -1) : p;
    const pre: Part[] = [...letters].map((ch) => {
      const [u, x] = PROCLITIC[ch] ?? ["PART", "_"];
      return { form: ch, lemma: ch, upos: u, xpos: x, feats: "_", misc: [] };
    });
    const post: Part[] = s ? [{ form: s, lemma: s, upos: "PRON", xpos: "PRON", feats: pron(`PRON:${ENCLITIC[s] ?? ""}`)?.feats ?? "_", misc: [] }] : [];
    if (!pre.length && !post.length) return [whole];
    return [...pre, { ...whole, form: article + t.stem }, ...post];
  }
  return [whole];
}

function sentence(a: Analysis, g: { id: string; text: string; tokens: AnalysedToken[] }, chosen: (t: AnalysedToken) => Candidate | undefined): string {
  const lines = [`# sent_id = ${g.id}`, `# text = ${g.text}`];
  const row = (id: number, p: Part) => [String(id), clean(p.form), p.lemma, p.upos, p.xpos, p.feats, "_", "_", "_", p.misc.length ? p.misc.join("|") : "_"].join("\t");
  let id = 0;
  for (const t of g.tokens) {
    const c = t.kind === "particle" ? t.particle : chosen(t);
    const pos = c?.pos ?? (t.kind === "particle" ? "P" : null);
    const misc: string[] = [];
    if (t.kind !== "particle" && c?.root) misc.push(`Root=${c.root.spaced.replace(/ /g, ".")}`);
    if (t.kind !== "particle" && c?.pattern) misc.push(`Pattern=${clean(c.pattern.ar)}`);
    misc.push(`Source=${t.kind === "gold" || (t.kind === "particle" && a.source.kind === "quran") ? "QAC" : `Jadhr-${t.kind}`}`);
    misc.push(`Confidence=${t.confidence.toFixed(2)}`);
    if (t.location) misc.push(`Loc=${t.location}`);
    const placed = t.kind === "gold";
    const whole: Part = { form: t.surface, lemma: c?.lemma ? clean(c.lemma.ar) : "_", upos: pos ? (UPOS[pos] ?? "X") : "X", xpos: pos ?? "_", feats: feats(c, placed), misc };
    const parts = split(t, c, whole, placed);
    // a multiword token: the range line with the surface, then each syntactic word (UD §Tokenization)
    if (parts.length > 1) lines.push([`${id + 1}-${id + parts.length}`, clean(t.surface), "_", "_", "_", "_", "_", "_", "_", "_"].join("\t"));
    for (const p of parts) lines.push(row(++id, p));
  }
  return lines.join("\n") + "\n\n";
}
