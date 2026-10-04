import { describe, expect, it } from "vitest";
import { localized, snippet } from "./seo";

describe("snippet", () => {
  it("keeps a short text whole, its spaces as one and no outer space", () => {
    expect(snippet(" إِنَّمَا  الْأَعْمَالُ\nبِالنِّيَّاتِ ")).toBe("إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ");
    expect(snippet("a b")).toBe("a b");
  });
  it("cuts a long text on a whole word, with an ellipsis, within the limit", () => {
    const s = snippet("word ".repeat(60));
    expect(s.length).toBeLessThanOrEqual(160);
    expect(s.endsWith("word…")).toBe(true);
  });
  it("cuts inside a word only when no space comes late enough", () => {
    expect(snippet("x".repeat(200), 20)).toBe(`${"x".repeat(19)}…`);
  });
});

describe("localized", () => {
  it("names Arabic at the bare path and English under /en", () => {
    expect(localized("en", "/")).toEqual({ canonical: "/en", languages: { ar: "/", en: "/en", "x-default": "/" } });
    expect(localized("ar", "/hadith")).toEqual({ canonical: "/hadith", languages: { ar: "/hadith", en: "/en/hadith", "x-default": "/hadith" } });
  });
});
