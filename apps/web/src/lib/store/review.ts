"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeJSONStorage } from "./safeStorage";

/**
 * The review scheduler (PLAN P5.3, RDR-359, data model 07: interval and ease in the SM-2 manner): one card per
 * root, kept in this browser like everything personal (L6). The prototype kept grades for a session and threw
 * them away; here a grade decides when the root comes back. A forgotten family returns within minutes, so it
 * comes back first in the next session — the promise the design's summary makes.
 */
/** The spec's four grades (P2.0, RDR-351): again, hard, good, easy — named for a family of words. */
export type Grade = "forgot" | "partial" | "good" | "easy";
export type ReviewCard = { root: string; ease: number; interval: number; due: number; reps: number; lapses: number; last: number; grade: Grade };

const DAY = 86_400_000;
const RELEARN = 10 * 60_000;
const QUALITY: Record<Grade, number> = { forgot: 1, partial: 3, good: 4, easy: 5 };

/** The next state of a card after a grade (SM-2: ease moves by quality — good keeps it, easy raises it, hard
 * lowers it — never under 1.3; easy also goes further than good). */
export function schedule(card: ReviewCard | undefined, root: string, g: Grade, now: number): ReviewCard {
  const prev = card ?? { root, ease: 2.5, interval: 0, due: now, reps: 0, lapses: 0, last: now, grade: g };
  const q = QUALITY[g];
  const ease = Math.max(1.3, +(prev.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))).toFixed(2));
  if (g === "forgot") return { root, ease, interval: 0, due: now + RELEARN, reps: 0, lapses: prev.lapses + 1, last: now, grade: g };
  const good = prev.reps === 0 ? 1 : prev.reps === 1 ? 3 : Math.max(1, Math.round(prev.interval * ease));
  const interval = g === "partial" ? Math.max(1, Math.round(prev.interval * 1.2)) : g === "easy" ? Math.max(good + 1, Math.round(good * 1.3), 4) : good;
  return { root, ease, interval, due: now + interval * DAY, reps: prev.reps + 1, lapses: prev.lapses, last: now, grade: g };
}

export const isDue = (card: ReviewCard | undefined, now: number) => !card || card.due <= now;

/** Due roots first: families forgotten last time, then the most overdue, then roots never reviewed. */
export function dueOrder(roots: string[], cards: Record<string, ReviewCard>, now: number): string[] {
  const rank = (r: string) => {
    const c = cards[r];
    if (!c) return [2, 0];
    return [c.grade === "forgot" ? 0 : 1, c.due];
  };
  return roots.filter((r) => isDue(cards[r], now)).sort((a, b) => {
    const [x1, y1] = rank(a);
    const [x2, y2] = rank(b);
    return x1 - x2 || y1 - y2;
  });
}

type ReviewState = { cards: Record<string, ReviewCard>; grade: (root: string, g: Grade) => void };

export const useReview = create<ReviewState>()(
  persist(
    (set) => ({
      cards: {},
      grade: (root, g) => set((s) => ({ cards: { ...s.cards, [root]: schedule(s.cards[root], root, g, Date.now()) } })),
    }),
    { name: "jadhr-review", storage: safeJSONStorage, version: 1 },
  ),
);
