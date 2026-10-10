/** The workbench's kinds of work, the books' layers and the states of the work (P3.0): shared by the server's page,
 * which reads the place from the address, and the browser's screens. */
export type Kind = "root_gloss" | "root_core" | "pattern_function" | "pattern_plain" | "sense_list" | "glossary" | "topic" | "context_passages" | "context_word" | "word_relations" | "verdict";
export const KINDS: Exclude<Kind, "verdict">[] = ["root_gloss", "root_core", "pattern_function", "pattern_plain", "sense_list", "glossary", "topic", "context_passages", "context_word", "word_relations"];
/** The administration's own kinds (P14, D31): an administrator publishes them directly; the board reviews them after. */
export const DIRECT: Kind[] = ["context_passages", "context_word", "word_relations"];
export const LAYERS = ["pattern_functions", "particle_entries", "mufradat_subentries", "gharib_meanings", "loanword_links", "relation_candidates", "topic_links", "topic_candidates", "entity_candidates"] as const;
export type Layer = (typeof LAYERS)[number];
export type State = "all" | "todo" | "open" | "review" | "approved";
export const STATES: State[] = ["all", "todo", "open", "review", "approved"];
