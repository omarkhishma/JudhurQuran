import { describe, expect, it } from "vitest";
import { dueOrder, isDue, type ReviewCard, schedule } from "./review";

const DAY = 86_400_000;
const T = Date.UTC(2026, 9, 3);

describe("the review scheduler (P5.3, RDR-359)", () => {
  it("lengthens the interval on each good recall: one day, three days, then by the ease", () => {
    const a = schedule(undefined, "علم", "good", T);
    expect([a.interval, a.reps, a.due]).toEqual([1, 1, T + DAY]);
    const b = schedule(a, "علم", "good", a.due);
    expect([b.interval, b.reps]).toEqual([3, 2]);
    const c = schedule(b, "علم", "good", b.due);
    expect(c.interval).toBe(Math.round(3 * c.ease));
    expect(c.ease).toBeGreaterThan(2.5);
  });

  it("brings a forgotten family back within minutes, first of all, and lowers its ease to no less than 1.3", () => {
    let card: ReviewCard | undefined = schedule(undefined, "علم", "good", T);
    for (let i = 0; i < 12; i++) card = schedule(card, "علم", "forgot", T);
    expect(card!.reps).toBe(0);
    expect(card!.lapses).toBe(12);
    expect(card!.ease).toBe(1.3);
    expect(card!.due - T).toBe(10 * 60_000);
  });

  it("holds a partial recall near its interval", () => {
    const a = schedule(schedule(schedule(undefined, "r", "good", T), "r", "good", T), "r", "good", T);
    const p = schedule(a, "r", "partial", T);
    expect(p.interval).toBe(Math.max(1, Math.round(a.interval * 1.2)));
    expect(p.ease).toBeLessThan(a.ease);
  });

  it("orders a session: forgotten first, then overdue, then never reviewed; not-due roots wait", () => {
    const cards: Record<string, ReviewCard> = {
      a: { ...schedule(undefined, "a", "good", T - 5 * DAY) }, // due T-4d
      b: { ...schedule(undefined, "b", "forgot", T - DAY) }, // forgotten, due long ago
      c: { ...schedule(undefined, "c", "good", T) }, // due tomorrow
    };
    expect(dueOrder(["n", "a", "b", "c"], cards, T)).toEqual(["b", "a", "n"]);
    expect(isDue(cards.c, T)).toBe(false);
    expect(isDue(undefined, T)).toBe(true);
  });
});
