"use client";

import { getMany, keys as idbKeys } from "idb-keyval";
import { deleteGraph, GRAPH_PREFIX, putGraph } from "@/lib/graph/persist";
import type { GraphDoc } from "@/lib/graph/types";
import { deleteText, LEGACY_PROGRESS, putText, TEXT_PREFIX, type UserText, userUri } from "@/lib/library/texts";
import { DEFAULT_PREFS, type Prefs, type Session, usePersonal, usePrefs } from "@/lib/reader/store";
import { useAnalyseChoices } from "@/lib/store/analyseChoices";
import { useAudio } from "@/lib/store/audio";
import { useNotebook } from "@/lib/store/notebook";
import { type ReviewCard, useReview } from "@/lib/store/review";
import { type Bookmark, type Note, useSaved } from "@/lib/store/saved";
import { type Change, canonical, type Local, type StoreName } from "./engine";

/**
 * How each local store reads as records and takes records from other devices (PLAN P6.2). Kept on the device
 * only: the curiosity trail of this visit, the recent-words history, panel widths and folds (they fit one
 * screen, not another), the theme, and the account's own session.
 */
export type Adapter = {
  read: () => Local | Promise<Local>;
  apply: (changes: Change[]) => unknown;
  /** the same records from a store's saved state rather than the live one (an exported file read back, plan B32) */
  of?: (state: unknown) => Local;
};

const entries = (xs: [string, unknown, number?][]): Local => new Map(xs.map(([k, value, at]) => [k, { value, at }]));
const split = (key: string) => {
  const i = key.indexOf(":");
  return [key.slice(0, i), key.slice(i + 1)] as const;
};

// ─── saved: stars and verse notes ─────────────────────────────────────────────

const savedOf = (state: unknown) => {
  const s = state as ReturnType<typeof useSaved.getState>;
  return entries([...s.bookmarks.map((b): [string, unknown, number] => [`b:${b.kind}:${b.key}`, b, b.at]), ...Object.entries(s.notes).map(([ref, n]): [string, unknown, number] => [`n:${ref}`, n, n.at])]);
};

const saved: Adapter = {
  read: () => savedOf(useSaved.getState()),
  of: savedOf,
  apply: (changes) =>
    useSaved.setState((s) => {
      const marks = new Map(s.bookmarks.map((b) => [`b:${b.kind}:${b.key}`, b]));
      const notes = { ...s.notes };
      for (const c of changes) {
        const [kind, rest] = split(c.key);
        if (kind === "b") {
          if (c.deleted) marks.delete(c.key);
          else marks.set(c.key, c.value as Bookmark);
        } else if (kind === "n") {
          if (c.deleted) delete notes[rest];
          else notes[rest] = c.value as Note;
        }
      }
      return { bookmarks: [...marks.values()].sort((a, b) => b.at - a.at), notes };
    }),
};

// ─── personal: word states, positions, proposals, trails kept, links, topics, furthest verses ───

const FLAGS = ["onboarded", "visited", "hubPromptHidden"] as const;

const personalOf = (state: unknown) => {
  const s = state as ReturnType<typeof usePersonal.getState>;
  const out: [string, unknown, number?][] = [
    ...Object.entries(s.wordStates).map(([k, v]): [string, unknown] => [`w:${k}`, v]),
    ...Object.entries(s.progress).map(([k, v]): [string, unknown, number] => [`p:${k}`, v, v.at]),
    ...s.proposals.map((p): [string, unknown, number] => [`pr:${p.id}`, p, p.ts]),
    ...s.savedTrails.map((t): [string, unknown, number] => [`t:${t.id}`, t, t.ts]),
    ...Object.entries(s.links).map(([k, v]): [string, unknown] => [`l:${k}`, v]),
    ...s.topics.map((t): [string, unknown, number] => [`tp:${t.id}`, t, t.ts]),
    ...Object.entries(s.verseTopics).map(([k, v]): [string, unknown] => [`vt:${k}`, v]),
    ...Object.entries(s.read).map(([k, v]): [string, unknown] => [`r:${k}`, v]),
    ...FLAGS.filter((f) => s[f]).map((f): [string, unknown] => [`f:${f}`, true]),
  ];
  return entries(out);
};

const personal: Adapter = {
  read: () => personalOf(usePersonal.getState()),
  of: personalOf,
  apply: (changes) =>
    usePersonal.setState((s) => {
      const wordStates = { ...s.wordStates };
      const progress = { ...s.progress };
      const links = { ...s.links };
      const verseTopics = { ...s.verseTopics };
      const read = { ...s.read };
      const proposals = new Map(s.proposals.map((p) => [p.id, p]));
      const savedTrails = new Map(s.savedTrails.map((t) => [t.id, t]));
      const topics = new Map(s.topics.map((t) => [t.id, t]));
      const next: Partial<typeof s> = {};
      const put = <T>(m: Record<string, T>, k: string, c: Change) => {
        if (c.deleted) delete m[k];
        else m[k] = c.value as T;
      };
      const putList = <T>(m: Map<string, T>, k: string, c: Change) => {
        if (c.deleted) m.delete(k);
        else m.set(k, c.value as T);
      };
      for (const c of changes) {
        const [kind, k] = split(c.key);
        if (kind === "w") put(wordStates, k, c);
        // a place another device kept before identifiers (text:<id>) arrives under the text's identifier (P1.7a); its
        // removal, which that device's move sends, never removes the place now kept under the identifier
        else if (kind === "p" && k.startsWith(LEGACY_PROGRESS)) {
          if (!c.deleted) progress[userUri(k.slice(LEGACY_PROGRESS.length))] ??= c.value as (typeof progress)[string];
        } else if (kind === "p") put(progress, k, c);
        else if (kind === "l") put(links, k, c);
        else if (kind === "vt") put(verseTopics, k, c);
        // the furthest verse read only moves forward, whichever device read further (RDR-071)
        else if (kind === "r") read[k] = c.deleted ? (read[k] ?? 0) : Math.max(read[k] ?? 0, c.value as number);
        else if (kind === "pr") putList(proposals, k, c);
        else if (kind === "t") putList(savedTrails, k, c);
        else if (kind === "tp") putList(topics, k, c);
        else if (kind === "f" && (FLAGS as readonly string[]).includes(k) && !c.deleted) next[k as (typeof FLAGS)[number]] = true;
      }
      return {
        ...next,
        wordStates,
        progress,
        links,
        verseTopics,
        read,
        proposals: [...proposals.values()].sort((a, b) => a.ts - b.ts),
        savedTrails: [...savedTrails.values()].sort((a, b) => a.ts - b.ts),
        topics: [...topics.values()].sort((a, b) => a.ts - b.ts),
      };
    }),
};

// ─── journal: what the reader looked up — a record per day, text and device, every root met with when, and the
// last place looked up — synced only when the reader turns that on (NTB-Q02, audit 11 F3) ───

const journalOf = (device: string) => (state: unknown) => {
  const s = state as ReturnType<typeof usePersonal.getState>;
  const out: [string, unknown, number?][] = [
    ...s.sessions.map((x): [string, unknown] => {
      const { device: from, ...session } = x;
      return [`s:${x.day}:${x.text}:${from ?? device}`, session];
    }),
    ...Object.entries(s.rootsMet ?? {}).map(([k, v]): [string, unknown] => [`rm:${k}`, v]),
  ];
  if (s.context) out.push(["ctx", s.context, s.context.ts]);
  if (s.contextClearedAt) out.push(["cc", s.contextClearedAt, s.contextClearedAt]);
  return entries(out);
};

const journal = (device: string): Adapter => ({
  read: () => journalOf(device)(usePersonal.getState()),
  of: journalOf(device),
  apply: (changes) =>
    usePersonal.setState((s) => {
      const keyOf = (x: Session) => `s:${x.day}:${x.text}:${x.device ?? device}`;
      const by = new Map(s.sessions.map((x) => [keyOf(x), x]));
      const rootsMet = { ...s.rootsMet };
      const next: Partial<typeof s> = {};
      for (const c of changes) {
        if (c.key === "ctx") next.context = c.deleted ? null : (c.value as typeof s.context);
        else if (c.key === "cc") next.contextClearedAt = c.deleted ? 0 : Math.max(s.contextClearedAt, c.value as number);
        // a root met on any device was met: the earliest time stands
        else if (c.key.startsWith("rm:")) {
          if (!c.deleted) rootsMet[c.key.slice(3)] = Math.min(rootsMet[c.key.slice(3)] ?? Infinity, c.value as number);
        } else if (c.deleted) by.delete(c.key);
        else {
          const from = c.key.slice(c.key.lastIndexOf(":") + 1);
          // this device's own sessions, synced before a sign-out, come back as its own
          by.set(c.key, from === device ? { ...(c.value as Session), device: undefined } : { ...(c.value as Session), device: from });
        }
      }
      return { ...next, rootsMet, sessions: [...by.values()].sort((a, b) => a.day.localeCompare(b.day)) };
    }),
});

// ─── notebook, review ─────────────────────────────────────────────────────────

const notebookOf = (state: unknown) => entries((state as ReturnType<typeof useNotebook.getState>).notes.map((n): [string, unknown, number] => [`n:${n.id}`, n, n.updated]));
const notebook: Adapter = {
  read: () => notebookOf(useNotebook.getState()),
  of: notebookOf,
  apply: (changes) =>
    useNotebook.setState((s) => {
      const by = new Map(s.notes.map((n) => [n.id, n]));
      for (const c of changes) {
        const id = split(c.key)[1];
        if (c.deleted) by.delete(id);
        else by.set(id, c.value as (typeof s.notes)[number]);
      }
      return { notes: [...by.values()].sort((a, b) => a.created - b.created) };
    }),
};

const reviewOf = (state: unknown) => entries(Object.values((state as ReturnType<typeof useReview.getState>).cards).map((c): [string, unknown, number] => [`c:${c.root}`, c, c.last]));
const review: Adapter = {
  read: () => reviewOf(useReview.getState()),
  of: reviewOf,
  apply: (changes) =>
    useReview.setState((s) => {
      const cards = { ...s.cards };
      for (const c of changes) {
        const root = split(c.key)[1];
        if (c.deleted) delete cards[root];
        else cards[root] = c.value as ReviewCard;
      }
      return { cards };
    }),
};

// ─── settings: one record per choice that differs from the default (back to the default = removed) ───

/** Reading choices follow the reader; the panel's width, folds and open rails fit one screen and stay there. */
const SYNCED_PREFS = ["size", "translitLine", "translationLine", "muyassarLine", "imlaeiLine", "tintRoot", "grammarBand", "wordStates", "panelTabs", "explainTerms", "dictOff", "lexMode", "compare", "translation", "tafsirs", "reciter", "dueSignal"] as const satisfies readonly (keyof Prefs)[];

function choices<K extends string>(fields: readonly K[], defaults: Record<K, unknown>, get: () => Record<K, unknown>, set: (p: Partial<Record<K, unknown>>) => void): Adapter {
  const of = (state: unknown) => {
    const s = state as Record<K, unknown>;
    return entries(fields.filter((f) => canonical(s[f]) !== canonical(defaults[f])).map((f): [string, unknown] => [f, s[f]]));
  };
  return {
    read: () => of(get()),
    of,
    apply: (changes) => {
      const patch: Partial<Record<K, unknown>> = {};
      for (const c of changes) if ((fields as readonly string[]).includes(c.key)) patch[c.key as K] = c.deleted ? defaults[c.key as K] : c.value;
      set(patch);
    },
  };
}

const prefs = choices(SYNCED_PREFS, DEFAULT_PREFS, () => usePrefs.getState(), (p) => usePrefs.setState(p as Partial<Prefs>));

const AUDIO = ["reciter", "follow", "speed", "repeat"] as const;
const AUDIO_DEFAULTS = { reciter: "alafasy", follow: true, speed: 1, repeat: false };
const audio = choices(AUDIO, AUDIO_DEFAULTS, () => useAudio.getState(), (p) => useAudio.setState(p as Parameters<typeof useAudio.setState>[0]));

const analyseOf = (state: unknown) => entries(Object.entries((state as ReturnType<typeof useAnalyseChoices.getState>).choices).map(([k, v]): [string, unknown] => [k, v]));
const analyse: Adapter = {
  read: () => analyseOf(useAnalyseChoices.getState()),
  of: analyseOf,
  apply: (changes) =>
    useAnalyseChoices.setState((s) => {
      const out = { ...s.choices };
      for (const c of changes) {
        if (c.deleted) delete out[c.key];
        else out[c.key] = c.value as number;
      }
      return { choices: out };
    }),
};

// ─── documents in IndexedDB: graphs and the reader's own texts ────────────────

/** Documents found by their own keys, not by an index a moment's race could drop one from: a document missing from
 * the list would be sent as deleted (audit 11 F12). */
async function documents<T extends { id: string; updatedAt: number }>(prefix: string, tag: string): Promise<Local> {
  const found = (await idbKeys()).filter((k): k is string => typeof k === "string" && k.startsWith(prefix));
  const docs = await getMany<T>(found);
  return entries(docs.filter((d): d is T => !!d?.id).map((d): [string, unknown, number] => [`${tag}:${d.id}`, d, d.updatedAt]));
}

const graphs: Adapter = {
  read: () => documents<GraphDoc>(GRAPH_PREFIX, "g"),
  apply: async (changes) => {
    for (const c of changes) {
      const id = split(c.key)[1];
      if (c.deleted) await deleteGraph(id, true);
      else await putGraph(c.value as GraphDoc);
    }
  },
};

const texts: Adapter = {
  read: () => documents<UserText>(TEXT_PREFIX, "x"),
  apply: async (changes) => {
    for (const c of changes) {
      const id = split(c.key)[1];
      if (c.deleted) await deleteText(id, true);
      else await putText(c.value as UserText);
    }
  },
};

export function adapters(device: string): Record<StoreName, Adapter> {
  return { saved, personal, journal: journal(device), notebook, review, prefs, audio, analyse, graphs, texts };
}

type Watchable = { subscribe: (cb: (s: never, prev: never) => void) => () => void };
const watch = <S>(store: { subscribe: (cb: (s: S, prev: S) => void) => () => void }, pick: (s: S) => unknown[]) => ({ store: store as unknown as Watchable, pick: pick as (s: never) => unknown[] });

/** The stores sync watches, and the part of each that syncs — recitation's progress through a verse is not a change
 * worth sending (documents announce their changes with an event). */
export const WATCHED = [
  watch(useSaved, (s) => [s.bookmarks, s.notes]),
  watch(usePersonal, (s) => [s.wordStates, s.progress, s.proposals, s.savedTrails, s.links, s.topics, s.verseTopics, s.read, s.rootsMet, s.context, s.contextClearedAt, s.sessions, s.onboarded, s.visited, s.hubPromptHidden]),
  watch(useNotebook, (s) => [s.notes]),
  watch(useReview, (s) => [s.cards]),
  watch(usePrefs, (s) => SYNCED_PREFS.map((f) => s[f])),
  watch(useAudio, (s) => AUDIO.map((f) => s[f])),
  watch(useAnalyseChoices, (s) => [s.choices]),
];
