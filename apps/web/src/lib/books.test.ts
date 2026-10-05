import { describe, expect, it } from "vitest";
import { pagesAt } from "./books";

describe("the printed page of a place in a paragraph (B56)", () => {
  const meta = { pages: [[1, 23], [1, 26]] as [number, number][], breaks: [[63, 1, 24, 24], [400, 1, 25, 26]] as [number, number, number, number][] };

  it("is the paragraph's first page before its first turn, and each turn's page after it", () => {
    expect(pagesAt(meta, 0)).toEqual({ v: 1, from: 23, to: 23 });
    expect(pagesAt(meta, 62)).toEqual({ v: 1, from: 23, to: 23 });
    expect(pagesAt(meta, 63)).toEqual({ v: 1, from: 24, to: 24 });
    expect(pagesAt(meta, 399)).toEqual({ v: 1, from: 24, to: 24 });
  });

  it("is a range after a turn whose run holds a page with no turn of its own", () => {
    expect(pagesAt(meta, 500)).toEqual({ v: 1, from: 25, to: 26 });
  });

  it("is the paragraph's range where its turns are not marked, and nothing it cannot say", () => {
    expect(pagesAt({ pages: [[2, 10], [2, 11]] }, 5)).toEqual({ v: 2, from: 10, to: 11 });
    expect(pagesAt({ pages: [[2, 10], [2, 10]] }, 5)).toEqual({ v: 2, from: 10, to: 10 });
    expect(pagesAt({ pages: [[2, 400], [3, 1]] }, 5)).toBeNull();
    expect(pagesAt({}, 5)).toBeNull();
  });
});
