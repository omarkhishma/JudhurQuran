import { describe, expect, it } from "vitest";
import { findCards } from "./find";
import type { GraphNode } from "./types";
import type { VerseText } from "./verseText";

const card = (id: string, data: GraphNode["data"]): GraphNode => ({ id, type: "card", position: { x: 0, y: 0 }, data });
const nodes = [
  card("root:علم", { kind: "root", ar: "ع ل م", rootKey: "علم", sub: "ʿ-l-m" }),
  card("lemma:ilm", { kind: "lemma", slug: "ilm", ar: "عِلْم", forms: [{ form: "العلم", count: 28 }] }),
  card("verse:1:2", { kind: "verse", verse: { key: "1:2" }, places: ["1:2:4"] }),
  card("note:x", { kind: "note", text: "ملاحظة عن الرحمة" }),
  card("frame:a", { kind: "frame", title: "مجموعة العلم" }),
  card("pattern:x", { kind: "pattern", ar: "فِعْل", fields: [{ id: "f", kind: "tags", label: "وسوم", value: ["مصدر"] }, { id: "g", kind: "image", label: "صورة", value: "0123456789abcdef01234567" }] }),
];
const v12: VerseText = { key: "1:2", surah: 1, ayah: 2, surah_name_ar: "الفاتحة", surah_name_translit: "", tokens: [{ text: "ٱلْحَمْدُ" }, { text: "لِلَّهِ" }, { text: "رَبِّ" }, { text: "ٱلْعَٰلَمِينَ" }], words: [] };
const verseOf = (k: string) => (k === "1:2" ? v12 : undefined);

describe("find a card on the map (EDT-035, QAN-15)", () => {
  it("folds Arabic: marks, alef forms and tāʾ marbūṭa", () => {
    expect(findCards(nodes, "علم", verseOf)).toEqual(["root:علم", "lemma:ilm", "verse:1:2"]);
    expect(findCards(nodes, "عِلْمٌ", verseOf)).toEqual(["root:علم", "lemma:ilm", "verse:1:2"]);
    expect(findCards(nodes, "الرحمه", verseOf)).toEqual(["note:x"]);
    expect(findCards(nodes, "الحمد", verseOf)).toEqual(["verse:1:2"]);
    // the mushaf's dagger alef read as everyday spelling
    expect(findCards(nodes, "العالمين", verseOf)).toEqual(["verse:1:2"]);
  });
  it("reads verse references in either digits, root letters spaced or not, and transliteration", () => {
    expect(findCards(nodes, "١:٢", verseOf)).toEqual(["verse:1:2"]);
    expect(findCards(nodes, "1:2:4", verseOf)).toEqual(["verse:1:2"]);
    expect(findCards(nodes, "ع ل م", verseOf)).toEqual(["root:علم"]);
    expect(findCards(nodes, "ʿ-L-M", verseOf)).toEqual(["root:علم"]);
    expect(findCards(nodes, "  ", verseOf)).toEqual([]);
  });
  it("finds what the reader wrote in a card's fields, and never a group (EDT-147)", () => {
    expect(findCards(nodes, "مصدر", verseOf)).toEqual(["pattern:x"]);
    expect(findCards(nodes, "0123456789", verseOf)).toEqual([]);
    expect(findCards(nodes, "مجموعة", verseOf)).toEqual([]);
  });
});
