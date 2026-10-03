"use client";

import { del, get, set, update } from "idb-keyval";
import { DOCS_EVENT } from "@/lib/graph/persist";
import { storageFrozen } from "@/lib/store/safeStorage";

/**
 * The reader's own texts (P4.4, LIB-34, D9a): private, kept in this browser's IndexedDB, sent to be read word by
 * word (POST /analyse/tokens, not stored there) and, when the reader signs in, synced to the account (P6).
 */
export type FormResult = { kind: "form" | "clitic" | "pattern" | "particle" | "none"; confidence: number; lemma: string | null; lemma_ar?: string | null; root: string | null; root_spaced?: string | null; gloss_en?: string | null };
export type UserText = {
  id: string;
  title: string;
  text: string;
  passages: string[];
  words: number;
  /** distinct lemma slugs the text holds, for "% known" by unique lemma (LIB-Q04) */
  lemmas: string[];
  /** how many passages, for the shelf's reading bar (LIB-13); absent on texts saved before it was kept */
  passageCount?: number;
  review: number;
  unknown: number;
  createdAt: number;
  updatedAt: number;
};
export type UserTextMeta = Omit<UserText, "text" | "passages">;

const INDEX = "jadhr-texts-index";
export const TEXT_PREFIX = "jadhr-text:";
const KEY = (id: string) => `${TEXT_PREFIX}${id}`;

export async function listTexts(): Promise<UserTextMeta[]> {
  return ((await get<UserTextMeta[]>(INDEX)) ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

export async function loadText(id: string): Promise<UserText | undefined> {
  return get<UserText>(KEY(id));
}

const changed = () => window.dispatchEvent(new Event(DOCS_EVENT));

export async function saveText(t: UserText): Promise<void> {
  await putText({ ...t, updatedAt: Date.now() });
  changed();
}

/** Store a text as it is, its time included (a text synced from another device keeps the time it was saved). The
 * index changes in one step, so two writes at once never drop each other's entry (audit 11 F12). */
export async function putText(doc: UserText): Promise<void> {
  if (storageFrozen()) return;
  await set(KEY(doc.id), doc);
  const meta: UserTextMeta = { id: doc.id, title: doc.title, words: doc.words, lemmas: doc.lemmas, passageCount: doc.passages.length, review: doc.review, unknown: doc.unknown, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
  await update<UserTextMeta[]>(INDEX, (index = []) => [...index.filter((x) => x.id !== doc.id), meta]);
}

export async function deleteText(id: string, quiet = false): Promise<void> {
  await del(KEY(id));
  await update<UserTextMeta[]>(INDEX, (index = []) => index.filter((x) => x.id !== id));
  if (!quiet) changed();
}

export const newTextId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
