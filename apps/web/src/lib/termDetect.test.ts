import { describe, expect, it } from "vitest";
import { splitTerms } from "./termDetect";

const L = [
  { key: "form1", label: "Form I" },
  { key: "form2", label: "Form II" },
  { key: "perfect", label: "perfect" },
  { key: "imperfect", label: "imperfect" },
  { key: "amr", label: "الأمر" },
  { key: "derived", label: "الفعل المزيد" },
  { key: "verb", label: "الفعل" },
];

const terms = (text: string) => splitTerms(text, L).filter((r) => r.term).map((r) => `${r.term}:${r.text}`);

describe("splitTerms", () => {
  it("prefers the longest label", () => {
    expect(terms("a Form II verb, not Form I")).toEqual(["form2:Form II", "form1:Form I"]);
    expect(terms("هذا الفعل المزيد وذاك الفعل")).toEqual(["derived:الفعل المزيد", "verb:الفعل"]);
  });
  it("keeps English words whole", () => {
    expect(terms("the imperfect and the perfect")).toEqual(["imperfect:imperfect", "perfect:perfect"]);
    expect(terms("imperfection")).toEqual([]);
  });
  it("uses Unicode edges for Arabic, where \\b fails", () => {
    expect(terms("فعل الأمر")).toEqual(["amr:الأمر"]);
    expect(terms("الأمرين")).toEqual([]);
    expect(terms("والأمر")).toEqual([]); // a clitic joined to the word is part of it
    expect(terms("(الأمر)")).toEqual(["amr:الأمر"]);
  });
  it("treats combining marks as part of a word", () => {
    expect(terms("الأمرَ")).toEqual([]);
  });
  it("is case-insensitive and keeps the text whole", () => {
    const runs = splitTerms("FORM II here", L);
    expect(runs.map((r) => r.text).join("")).toBe("FORM II here");
    expect(runs.find((r) => r.term)?.term).toBe("form2");
  });
});
