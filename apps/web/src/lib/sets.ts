/** Sets of words a reader or a teacher makes (B29; API /sets/evaluate, /classroom/…/sets): a title and a rule, the
 * words always computed from the rule — a root, patterns, the most frequent content words, the function words, the
 * words claimed as foreign — never typed in, so a set cannot hold what its rule does not yield. */

import { authFetch } from "@/lib/account/store";
import type { Colour, SetItem } from "@/lib/collections";

export type RuleKind = "root" | "patterns" | "frequent" | "function_words" | "loanwords";
export type SetRule = { root?: string[]; patterns?: string[]; pos?: string[]; derivation?: string; frequent?: true; function_words?: true; loanwords?: true; surah?: number; limit?: number };
export type EvaluatedSet = { rule: SetRule; items: SetItem[]; item_count: number; root_count: number; roots: { key: string; spaced: string; translit: string }[]; occurrences: number; scope_words: number; coverage: number };
export type ClassSet = { id: string; title: string; rule: SetRule; created_at: string };
export type ClassSetDetail = ClassSet & EvaluatedSet & { class: { id: string; name: string }; role: "instructor" | "member" };

export const RULE_KINDS: RuleKind[] = ["root", "patterns", "frequent", "function_words", "loanwords"];
export const LIMIT_MAX = 100;

export const kindOf = (r: SetRule): RuleKind => RULE_KINDS.find((k) => r[k]) ?? "frequent";

/** A set's colour says what kind of object its rule gathers, as the curated sets' do. */
export const colourOf = (r: SetRule): Colour => ({ root: "root", patterns: "form", frequent: "word", function_words: "desc", loanwords: "amber" } as const)[kindOf(r)];

/** The words a rule yields, read from the data now; the rule goes in a body, never an address (a reader's own). */
export async function evaluateSet(rule: SetRule): Promise<EvaluatedSet> {
  const r = await fetch("/api/v1/sets/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rule }) });
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { error?: { code?: string } } | null;
    throw new Error(body?.error?.code ?? String(r.status));
  }
  return (await r.json()) as EvaluatedSet;
}

const base = "/classroom";
export const classSets = (classId: string) => authFetch<{ role: "instructor" | "member"; data: ClassSet[] }>(`${base}/classes/${encodeURIComponent(classId)}/sets`);
export const addClassSet = (classId: string, title: string, rule: SetRule) => authFetch<ClassSet>(`${base}/classes/${encodeURIComponent(classId)}/sets`, { method: "POST", body: JSON.stringify({ title, rule }) });
export const classSet = (id: string) => authFetch<ClassSetDetail>(`${base}/sets/${encodeURIComponent(id)}`);
export const dropClassSet = (id: string) => authFetch<void>(`${base}/sets/${encodeURIComponent(id)}`, { method: "DELETE" });

/** Roots as a reader types them — «ع ل م، كتب» — one key each, spaces dropped. */
export const parseRoots = (text: string) => [...new Set(text.split(/[،,؛;\n]+/).map((x) => x.replace(/\s+/g, "")).filter(Boolean))];
