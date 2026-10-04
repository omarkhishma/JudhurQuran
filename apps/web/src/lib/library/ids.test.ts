import { describe, expect, it } from "vitest";
import { progressByIdentifier, userUri } from "./ids";

describe("a reader's text as an identifier (P1.7a)", () => {
  it("names the text, a passage and a word in the reader's own namespace", () => {
    expect(userUri("a1b2c3")).toBe("user:a1b2c3");
    expect(userUri("a1b2c3", 4)).toBe("user:a1b2c3:4");
    expect(userUri("a1b2c3", 4, 12)).toBe("user:a1b2c3:4:12");
    // a word only within a passage
    expect(userUri("a1b2c3", undefined, 12)).toBe("user:a1b2c3");
  });

  it("moves a place kept before identifiers to the text's identifier, the newer one kept", () => {
    const old = { at: 1, chapter: 1, passage: 3 };
    const now = { at: 2, chapter: 1, passage: 9 };
    expect(progressByIdentifier({ quran: now, "book:x": old, "text:abc": old })).toEqual({ quran: now, "book:x": old, "user:abc": old });
    expect(progressByIdentifier({ "text:abc": old, "user:abc": now })).toEqual({ "user:abc": now });
    expect(progressByIdentifier({})).toEqual({});
  });
});
