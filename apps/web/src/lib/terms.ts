/**
 * The technical terms the interface marks for a plain-language card (handoff §3.6). Their names and
 * explanations live in data/glossary.yaml and are served by the API (/api/v1/glossary) — one source for
 * every screen and for the editors (P2.6); this module only names them and maps corpus tags onto them.
 */

export type TermId =
  | "root" | "lemma" | "wazn" | "verbForm" | "formOne" | "derivedForm" | "activeParticiple" | "passiveParticiple"
  | "verbalNoun" | "perfect" | "imperfect" | "imperative" | "passiveVoice" | "nominative" | "accusative"
  | "genitive" | "jussive" | "prefix" | "suffix" | "stem" | "noRoot" | "tashkeel" | "rasm" | "imlaei"
  | "concordance" | "occurrences" | "lexicon" | "gharib" | "variant" | "gloss" | "transliteration"
  | "form2" | "form3" | "form4" | "form5" | "form6" | "form7" | "form8" | "form9" | "form10"
  | "pronoun" | "particle" | "muqattaat" | "nounOfPlace" | "intensive" | "adjective" | "definite"
  | "sense" | "corpus" | "lexicalLevel"
  | "wujuh" | "furuq" | "addad" | "asbab" | "makkiMadani"
  | "layerContextual" | "layerLexical" | "layerSemantic" | "layerMorphological" | "layerGrammatical"; // prettier-ignore

/** Corpus verb form number → its card. */
export const FORM_TERM: Partial<Record<number, TermId>> = {
  2: "form2", 3: "form3", 4: "form4", 5: "form5", 6: "form6", 7: "form7", 8: "form8", 9: "form9", 10: "form10",
}; // prettier-ignore

/** Corpus feature tags → the term that explains them. */
export const TAG_TERM: Record<string, TermId> = {
  PERF: "perfect", IMPF: "imperfect", IMPV: "imperative", PASS: "passiveVoice",
  ACT_PCPL: "activeParticiple", PASS_PCPL: "passiveParticiple", VN: "verbalNoun",
  NOM: "nominative", ACC: "accusative", GEN: "genitive", IND: "nominative", SUBJ: "accusative", JUS: "jussive",
}; // prettier-ignore
