import { describe, expect, it } from "vitest";
import { findWord, fold } from "./findWord";

const marked = (text: string, word: string) => findWord(text, word).map(([a, b]) => text.slice(a, b));

describe("findWord (B3)", () => {
  it("finds the word whatever its vowels and its hamza's seat", () => {
    expect(marked("قوله: الرَّحْمَنِ الرَّحِيمِ، اسمان", "الرحمن")).toEqual(["الرَّحْمَنِ"]);
    expect(marked("وأَنزل الله", "انزل")).toEqual(["وأَنزل"]);
    expect(fold("ٱلرَّحْمَٰنِ").s).toBe("الرحمن");
  });
  it("takes a glued و ف ب ك ل with it, and never a longer word", () => {
    expect(marked("فالحمد لله، والحمدُ كله", "الحمد")).toEqual(["فالحمد", "والحمدُ"]);
    expect(marked("المحمود محمود", "محمود")).toEqual(["محمود"]);
    expect(marked("رحمته", "رحمة")).toEqual([]);
  });
  it("finds the word without its article, but not inside the article's own form", () => {
    expect(marked("الكتاب: أي كتاب الله", "الكتاب")).toEqual(["الكتاب", "كتاب"]);
    expect(marked("ذلك الكتاب", "الكتاب")).toEqual(["الكتاب"]);
  });
  it("marks nothing for a letter or two", () => {
    expect(findWord("و قال", "و")).toEqual([]);
  });
});
