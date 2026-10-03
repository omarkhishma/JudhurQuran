"use client";

import { del, get, set } from "idb-keyval";

/**
 * The reader's own texts (P4.4, LIB-34, D9a): private, kept in this browser's IndexedDB until accounts exist,
 * never sent anywhere except to be read word by word (POST /analyse/tokens, not stored there).
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
const KEY = (id: string) => `jadhr-text:${id}`;

export async function listTexts(): Promise<UserTextMeta[]> {
  return ((await get<UserTextMeta[]>(INDEX)) ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

export async function loadText(id: string): Promise<UserText | undefined> {
  return get<UserText>(KEY(id));
}

export async function saveText(t: UserText): Promise<void> {
  const doc = { ...t, updatedAt: Date.now() };
  await set(KEY(t.id), doc);
  const meta: UserTextMeta = { id: doc.id, title: doc.title, words: doc.words, lemmas: doc.lemmas, passageCount: doc.passages.length, review: doc.review, unknown: doc.unknown, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
  const index = (await listTexts()).filter((x) => x.id !== t.id);
  index.push(meta);
  await set(INDEX, index);
}

export async function deleteText(id: string): Promise<void> {
  await del(KEY(id));
  await set(INDEX, (await listTexts()).filter((x) => x.id !== id));
}

export const newTextId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
