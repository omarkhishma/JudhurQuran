import { describe, expect, it } from "vitest";
import type { Local } from "./engine";
import { compare } from "./importCompare";

const local = (xs: [string, unknown][]): Local => new Map(xs.map(([k, value]) => [k, { value }]));

describe("an exported file read back (plan B32)", () => {
  it("adds what is new here, leaves what is the same, and sets aside what differs — whatever order its keys were written in", () => {
    const theirs = local([["b:a", { label: "a", at: 1 }], ["b:b", { at: 2, label: "b" }], ["b:c", { label: "c2" }]]);
    const mine = local([["b:b", { label: "b", at: 2 }], ["b:c", { label: "c1" }], ["b:d", { label: "d" }]]);
    const c = compare(theirs, mine);
    expect(c.add.map((x) => x.key)).toEqual(["b:a"]);
    expect(c.differ).toEqual([{ key: "b:c", value: { label: "c2" }, deleted: false }]);
    expect(c.same).toBe(1);
  });

  it("never reads a record missing from the file as deleted", () => {
    const c = compare(local([]), local([["b:d", 1]]));
    expect([c.add, c.differ, c.same]).toEqual([[], [], 0]);
    expect([...c.add, ...c.differ].some((x) => x.deleted)).toBe(false);
  });
});
