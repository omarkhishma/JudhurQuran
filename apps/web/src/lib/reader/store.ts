"use client";

/**
 * Reader v5 state (design 03 §3.12). Session state lives in one store; preferences and personal data
 * persist locally (local-first, law L6) under jadhr-* keys and will sync to the account in P6.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Seed } from "@/lib/graph/seedCodec";

export type Mode = "empty" | "word" | "verse" | "index" | "surah";
export type Selection = { slug: string; at: string | null };
export type SectionId = "senses" | "family" | "patterns" | "lexica" | "timeline" | "usage";
export const SECTIONS: SectionId[] = ["senses", "family", "patterns", "lexica", "timeline", "usage"];
export type CiteTarget =
  | { kind: "word"; slug: string; label: string; at?: string | null }
  | { kind: "root"; key: string; label: string }
  | { kind: "verse"; key: string; label: string }
  | {
      kind: "article";
      slug: string;
      label: string;
      dict: { title_ar: string; title_en: string; author_ar: string; author_en: string };
      root: { spaced: string; translit: string };
      page: string | null;
    };
export type SuggestTarget = { kind: "edit" | "sense" | "error"; slug: string; label: string; ordinal?: number; current: string };

type ReaderState = {
  mode: Mode;
  ask: boolean;
  review: boolean;
  selection: Selection | null;
  verse: string | null;
  history: Selection[];
  cursor: number;
  sheet: "half" | "full";
  railOverlay: boolean;
  omnibox: boolean;
  cite: CiteTarget | null;
  handoff: Seed | null;
  suggest: SuggestTarget | null;
  trailMap: boolean;
  focusRoot: string | null;
  toast: { text: string; id: number } | null;
  scrollTo: SectionId | null;
  onbBeat: number; // onboarding beat; session state so it survives the jump to the demo sūra

  openWord: (sel: Selection, opts?: { fromHistory?: boolean }) => void;
  openVerse: (key: string) => void;
  setMode: (m: Mode) => void;
  back: () => void;
  forward: () => void;
  setAsk: (on: boolean) => void;
  setReview: (on: boolean) => void;
  setSheet: (s: "half" | "full") => void;
  setRailOverlay: (on: boolean) => void;
  setOmnibox: (on: boolean) => void;
  setCite: (t: CiteTarget | null) => void;
  setHandoff: (s: Seed | null) => void;
  setSuggest: (t: SuggestTarget | null) => void;
  setTrailMap: (on: boolean) => void;
  setFocusRoot: (k: string | null) => void;
  showToast: (text: string) => void;
  jumpTo: (s: SectionId | null) => void;
  closeEntry: () => void;
  setOnbBeat: (n: number) => void;
};

const HISTORY_CAP = 30;

export const useReader = create<ReaderState>((set, get) => ({
  mode: "empty",
  ask: false,
  review: false,
  selection: null,
  verse: null,
  history: [],
  cursor: -1,
  sheet: "half",
  railOverlay: false,
  omnibox: false,
  cite: null,
  handoff: null,
  suggest: null,
  trailMap: false,
  focusRoot: null,
  toast: null,
  scrollTo: null,
  onbBeat: 0,

  openWord: (sel, opts) => {
    const s = get();
    let { history, cursor } = s;
    if (!opts?.fromHistory) {
      const cur = history[cursor];
      if (!cur || cur.slug !== sel.slug || cur.at !== sel.at) {
        // a new selection truncates forward history (RDR-191), capped at 30
        history = [...history.slice(0, cursor + 1), sel].slice(-HISTORY_CAP);
        cursor = history.length - 1;
      }
    }
    // choosing any word while onboarding shows its first beat moves it to the second (RDR-406)
    set({ selection: sel, verse: null, mode: "word", history, cursor, ask: false, sheet: "half", onbBeat: s.onbBeat === 0 ? 1 : s.onbBeat });
    if (sel.slug) usePersonal.getState().recordTrail("word", sel.slug);
  },
  openVerse: (key) => {
    set({ verse: key, selection: null, mode: "verse", ask: false, sheet: "half" });
    usePersonal.getState().recordTrail("verse", key);
  },
  setMode: (m) => set({ mode: m }),
  back: () => {
    const { cursor, history } = get();
    if (cursor <= 0) return;
    set({ cursor: cursor - 1, selection: history[cursor - 1], mode: "word", verse: null });
  },
  forward: () => {
    const { cursor, history } = get();
    if (cursor >= history.length - 1) return;
    set({ cursor: cursor + 1, selection: history[cursor + 1], mode: "word", verse: null });
  },
  setAsk: (on) => set({ ask: on }),
  setReview: (on) => set({ review: on }),
  setSheet: (sheet) => set({ sheet }),
  setRailOverlay: (on) => set({ railOverlay: on }),
  setOmnibox: (on) => set({ omnibox: on }),
  setCite: (cite) => set({ cite }),
  setHandoff: (handoff) => set({ handoff }),
  setSuggest: (suggest) => set({ suggest }),
  setTrailMap: (trailMap) => set({ trailMap }),
  setFocusRoot: (focusRoot) => {
    set({ focusRoot });
    if (focusRoot) usePersonal.getState().recordTrail("root", focusRoot);
  },
  showToast: (text) => set({ toast: { text, id: Date.now() } }),
  jumpTo: (scrollTo) => {
    if (scrollTo) usePrefs.getState().openLayer(scrollTo);
    set({ scrollTo });
  },
  closeEntry: () => set({ selection: null, verse: null, mode: "empty" }),
  setOnbBeat: (onbBeat) => set({ onbBeat }),
}));

export type Prefs = {
  size: number; // reading text multiplier: floor 0.8, cap 1.6 (RDR-116 reconciled with the spec)
  translitLine: boolean | null; // null → locale default (off in Arabic, on in English)
  translationLine: boolean | null; // null → locale default
  muyassarLine: boolean; // al-Muyassar's plain Arabic explanation under each verse (Arabic UI option)
  imlaeiLine: boolean; // D7: the verse in standard spelling, labelled, under the mushaf text (never instead of it)
  tintRoot: boolean; // underline the open word's root family (RDR-038)
  grammarBand: boolean; // RDR-039
  wordStates: boolean; // D20: an opt-in study mode, off by default on the Quran
  panelTabs: boolean; // RDR-042
  explainTerms: boolean; // RDR-043
  dictOff: Record<string, boolean>;
  railOpen: boolean;
  panelOpen: boolean;
  panelW: number;
  lexMode: "list" | "compare" | "apparatus";
  compare: string[];
  layerOpen: Record<SectionId, boolean>;
  translation: string;
  tafsirs: string[];
  reciter: string | null;
};

type PrefsState = Prefs & {
  set: (p: Partial<Prefs>) => void;
  openLayer: (s: SectionId) => void;
  toggleLayer: (s: SectionId) => void;
};

export const DEFAULT_PREFS: Prefs = {
  size: 1,
  translitLine: null,
  translationLine: null,
  muyassarLine: false,
  imlaeiLine: false,
  tintRoot: true,
  grammarBand: false,
  wordStates: false,
  panelTabs: false,
  explainTerms: true,
  dictOff: {},
  railOpen: true,
  panelOpen: true,
  panelW: 420,
  lexMode: "list",
  compare: ["mufradat", "maqayis", "lisan"],
  layerOpen: { senses: true, family: true, patterns: false, lexica: false, timeline: false, usage: false },
  translation: "saheeh",
  tafsirs: ["muyassar", "saadi", "ibn-kathir", "tabari", "qurtubi", "baghawi", "mukhtasar"],
  reciter: null,
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,
      set: (p) => set(p),
      openLayer: (s) => set((st) => ({ layerOpen: { ...st.layerOpen, [s]: true } })),
      toggleLayer: (s) =>
        set((st) => {
          const next = { ...st.layerOpen, [s]: !st.layerOpen[s] };
          // never a fully-folded panel (RDR-577): folding the last open layer keeps Meanings open
          if (!Object.values(next).some(Boolean)) next.senses = true;
          return { layerOpen: next };
        }),
    }),
    {
      name: "jadhr-prefs",
      version: 2,
      migrate: (old) => ({ ...DEFAULT_PREFS, ...((old as Partial<Prefs>) ?? {}) }),
    },
  ),
);

export type WordState = "new" | "learning" | "known";
/** A step of the curiosity trail: a word (lemma slug), a verse (2:255) or a root (علم) — RDR-568. */
export type TrailStep = { kind: "word" | "verse" | "root"; id: string; ts: number };
export type ProgressEntry = { chapter: number; passage: number; at: number };
export type SavedTrail = { id: string; steps: TrailStep[]; ts: number };
export type Proposal = {
  id: string;
  kind: "edit" | "sense" | "error";
  slug: string;
  label: string;
  ordinal: number | null;
  current: string;
  text: string;
  why: string;
  sources: string[];
  status: "pending";
  ts: number;
};

type PersonalState = {
  wordStates: Record<string, WordState>;
  trail: TrailStep[];
  progress: Record<string, ProgressEntry>;
  visited: boolean;
  onboarded: boolean;
  proposals: Proposal[];
  savedTrails: SavedTrail[];
  setWordState: (slug: string, s: WordState) => void;
  recordTrail: (kind: TrailStep["kind"], id: string) => void;
  truncateTrail: (index: number) => void;
  clearTrail: () => void;
  saveTrail: () => void;
  setProgress: (text: string, p: Omit<ProgressEntry, "at">) => void;
  markVisited: () => void;
  setOnboarded: () => void;
  addProposal: (p: Omit<Proposal, "id" | "status" | "ts">) => void;
};

const TRAIL_CAP = 40;

export const usePersonal = create<PersonalState>()(
  persist(
    (set) => ({
      wordStates: {},
      trail: [],
      progress: {},
      visited: false,
      onboarded: false,
      proposals: [],
      savedTrails: [],
      setWordState: (slug, s) => set((st) => ({ wordStates: { ...st.wordStates, [slug]: s } })),
      recordTrail: (kind, id) =>
        set((st) => {
          const last = st.trail[st.trail.length - 1];
          if (last?.kind === kind && last.id === id) return {}; // consecutive duplicates are not appended (RDR-587)
          return { trail: [...st.trail, { kind, id, ts: Date.now() }].slice(-TRAIL_CAP) };
        }),
      truncateTrail: (index) => set((st) => ({ trail: st.trail.slice(0, index + 1) })),
      clearTrail: () => set({ trail: [] }),
      // Kept on this device for the Notebook (P4.4); synced once accounts exist (P6).
      saveTrail: () => set((st) => (st.trail.length ? { savedTrails: [...st.savedTrails, { id: `t${Date.now()}`, steps: st.trail, ts: Date.now() }] } : {})),
      setProgress: (text, p) => set((st) => ({ progress: { ...st.progress, [text]: { ...p, at: Date.now() } } })),
      markVisited: () => set({ visited: true }),
      setOnboarded: () => set({ onboarded: true }),
      addProposal: (p) =>
        set((st) => ({ proposals: [...st.proposals, { ...p, id: `p${Date.now()}`, status: "pending" as const, ts: Date.now() }] })),
    }),
    { name: "jadhr-personal", version: 1 },
  ),
);
