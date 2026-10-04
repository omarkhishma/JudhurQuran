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
  it("reads a word with its case ending as the word, and a longer word as another (P1.3a)", () => {
    const fatha = String.fromCharCode(0x064e);
    const sukun = String.fromCharCode(0x0652);
    expect(terms(`الأمر${fatha}`)).toEqual([`amr:الأمر${fatha}`]);
    // «الأمرَيْن»: the marks do not end the word; its letters go on
    expect(terms(`الأمر${fatha}ي${sukun}ن`)).toEqual([]);
  });
  it("is case-insensitive and keeps the text whole", () => {
    const runs = splitTerms("FORM II here", L);
    expect(runs.map((r) => r.text).join("")).toBe("FORM II here");
    expect(runs.find((r) => r.term)?.term).toBe("form2");
  });
  it("finds a term written with its vowels, hamza forms and tatweel, and shows the text as written (P1.3a)", () => {
    const fatha = String.fromCharCode(0x064e);
    const sukun = String.fromCharCode(0x0652);
    const kasra = String.fromCharCode(0x0650);
    const vowelled = (w: string) => [...w].map((c) => c + fatha).join("");
    const derived = `${vowelled("الفعل")} ${vowelled("المزيد")}`;
    expect(terms(`هذا ${derived} هنا`)).toEqual([`derived:${derived}`]);
    // alef wasla and a sukun: «ٱلْأَمْرِ»
    const amr = `${String.fromCharCode(0x0671)}ل${sukun}أ${fatha}م${sukun}ر${kasra}`;
    expect(terms(`فعل ${amr}`)).toEqual([`amr:${amr}`]);
    // tatweel inside a word does not hide it
    expect(terms(`الأمـــر`)).toEqual(["amr:الأمـــر"]);
    // and the edges hold with the marks: a clitic or a suffix still makes another word
    expect(terms(`و${amr}`)).toEqual([]);
    expect(terms(`${amr}ين`)).toEqual([]);
  });
});
