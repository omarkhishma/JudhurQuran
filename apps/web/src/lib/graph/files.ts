"use client";

import { del, get, getMany, keys, set } from "idb-keyval";
import { storageFrozen } from "@/lib/store/safeStorage";
import { GRAPH_PREFIX } from "./persist";
import { FILE_ID } from "./sanitize";
import type { GraphNodeData } from "./types";

/**
 * Files a reader puts in a card's audio, image or file field (EDT-102), kept in this browser as data URLs under
 * `jadhr-graph-file:{id}` — beside the maps, not in them, so a map stays small to save, sync and share. They are
 * part of this browser's data (its export, its import, its deletion) but do not travel with sync or a share link:
 * a field whose file is not here says so. A map's JSON export carries the files it holds, and its import restores
 * them. A file no map holds any more is removed a day later (sweepFiles).
 */
export const FILE_PREFIX = "jadhr-graph-file:";
export const MAX_FILE = 5 * 1024 * 1024;
/** the largest map file read: its cards and the files its fields carry */
export const MAX_MAP_IMPORT = 50 * 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;

/** `at`: when it was kept here (a file kept before it was recorded counts as old) */
export type StoredFile = { name: string; type: string; url: string; at?: number };

export async function putFile(file: File): Promise<string> {
  if (file.size > MAX_FILE) throw new Error("too-large");
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const id = crypto.randomUUID().replace(/-/g, "");
  if (!storageFrozen()) await set(FILE_PREFIX + id, { name: file.name.slice(0, 200), type: file.type, url, at: Date.now() } satisfies StoredFile);
  return id;
}

export const getFile = (id: string) => get<StoredFile>(FILE_PREFIX + id);
export const restoreFile = (id: string, f: StoredFile) => (storageFrozen() ? Promise.resolve() : set(FILE_PREFIX + id, f));
export const deleteFile = (id: string) => del(FILE_PREFIX + id);

/** A file read back from an export, only if it is what a field holds: a data URL of a reasonable size. */
export function cleanStoredFile(x: unknown): StoredFile | null {
  const f = (x && typeof x === "object" ? x : null) as Record<string, unknown> | null;
  if (!f || typeof f.url !== "string" || !/^data:[\w.+/-]*;base64,/.test(f.url) || f.url.length > MAX_FILE * 1.4) return null;
  return { name: typeof f.name === "string" ? f.name.slice(0, 200) : "file", type: typeof f.type === "string" ? f.type.slice(0, 100) : "", url: f.url, at: Date.now() };
}

/** The ids of the files a map's cards hold in their fields. */
export function fileIds(nodes: readonly { data?: Pick<GraphNodeData, "fields"> }[]): string[] {
  const ids = new Set<string>();
  for (const n of nodes)
    for (const f of n.data?.fields ?? []) if ((f.kind === "audio" || f.kind === "image" || f.kind === "file") && typeof f.value === "string" && FILE_ID.test(f.value)) ids.add(f.value);
  return [...ids];
}

/** The files a map holds that are in this browser, for its JSON export. */
export async function bundleFiles(nodes: readonly { data?: Pick<GraphNodeData, "fields"> }[]): Promise<Record<string, StoredFile>> {
  const ids = fileIds(nodes);
  const out: Record<string, StoredFile> = {};
  if (!ids.length) return out;
  const got = await getMany<StoredFile | undefined>(ids.map((id) => FILE_PREFIX + id));
  ids.forEach((id, i) => {
    const f = got[i];
    if (f) out[id] = { name: f.name, type: f.type, url: f.url };
  });
  return out;
}

/** The files an export carries, kept here — only those its cards hold, each only as a data URL. Returns how many. */
export async function restoreFiles(raw: unknown, nodes: readonly { data?: Pick<GraphNodeData, "fields"> }[]): Promise<number> {
  const files = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  let n = 0;
  for (const id of fileIds(nodes)) {
    const f = cleanStoredFile(files[id]);
    if (!f) continue;
    await restoreFile(id, f);
    n++;
  }
  return n;
}

/** Files no map in this browser holds, a day after they were kept: a field removed, a map deleted. The day leaves
 * room for undo and for a map still open in another tab and not yet saved. */
export async function sweepFiles(now = Date.now()): Promise<number> {
  if (storageFrozen()) return 0;
  const all = (await keys()).map(String);
  const files = all.filter((k) => k.startsWith(FILE_PREFIX));
  if (!files.length) return 0;
  const maps = await getMany<{ nodes?: { data?: Pick<GraphNodeData, "fields"> }[] } | undefined>(all.filter((k) => k.startsWith(GRAPH_PREFIX)));
  const held = new Set(maps.flatMap((m) => (Array.isArray(m?.nodes) ? fileIds(m.nodes) : [])));
  const stored = await getMany<StoredFile | undefined>(files);
  let n = 0;
  for (let i = 0; i < files.length; i++) {
    if (held.has(files[i].slice(FILE_PREFIX.length)) || now - (stored[i]?.at ?? 0) < DAY) continue;
    await del(files[i]);
    n++;
  }
  return n;
}
