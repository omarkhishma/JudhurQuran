import { describe, expect, it } from "vitest";
import { upgrade } from "./migrate";
import { embedPath, embedSnippet, mapCitation, slugify } from "./publishedShared";
import vectors from "./slug-vectors.json";

describe("a published map's address (P8.5, QAN-23)", () => {
  // the same cases the API's tests read (services/api/tests/test_published_api.py): the browser shows the address the
  // API will make
  for (const v of vectors as { input: string; slug: string; why: string }[])
    it(`${v.why}`, () => {
      expect(slugify(v.input)).toBe(v.slug.normalize("NFC"));
    });
  it("keeps at most 60 characters, never ending on a hyphen", () => {
    const s = slugify("ab-".repeat(40));
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("the embed and the citation (EDT-332, EDT-333)", () => {
  it("puts the display options in the frame's address and names the frame for screen readers", () => {
    expect(embedPath("عائلة-العلم", { entry: false, folded: true, dark: true, version: 2 })).toBe(`/embed/g/${encodeURIComponent("عائلة-العلم")}?entry=0&folded=1&theme=dark&v=2`);
    const html = embedSnippet("https://jadhr.org", "/en", "x-map", 'A "quoted" <map>', { entry: true, folded: false, dark: false });
    expect(html).toContain('src="https://jadhr.org/en/embed/g/x-map?entry=1&folded=0&theme=light"');
    expect(html).toContain('title="A &quot;quoted&quot; &lt;map>"');
  });
  it("cites a version by its own address, with the author's name or the anonymous one", () => {
    const m = { slug: "عائلة-العلم", version: 3, title: "عائلة علم", author: { name: null }, published_at: "2026-10-04T10:00:00Z" };
    const at = "https://jadhr.org/g/x?v=3";
    expect(mapCitation("arabic", m, at, { ar: "قارئ في جذر", en: "A Jadhr reader" })).toBe("قارئ في جذر. «عائلة علم». خريطة في جذر، الإصدار 3، 2026-10-04. https://jadhr.org/g/x?v=3");
    const bib = mapCitation("bibtex", { ...m, author: { name: "Omar" } }, at, { ar: "", en: "" });
    // a BibTeX key takes no Arabic letters
    expect(bib.split("\n")[0]).toMatch(/^@misc\{jadhr_map_[0-9a-z]+_v3,$/);
    expect(bib).toContain("author = {Omar}");
    expect(mapCitation("ris", m, at, { ar: "", en: "A Jadhr reader" })).toContain("ET  - 3");
  });
});

describe("a published document read as any map is (EDT-277, EDT-291, HWF-53)", () => {
  it("takes a link written as a [source, target] pair as well as an object", async () => {
    const nodes = [
      { id: "note:a", position: { x: 0, y: 0 }, data: { kind: "note", text: "أ" } },
      { id: "note:b", position: { x: 1, y: 1 }, data: { kind: "note", text: "ب" } },
      { id: "note:c", position: { x: 2, y: 2 }, data: { kind: "note", text: "ج" } },
    ];
    const got = await upgrade(2, "free", nodes, [["note:a", "note:b"], { id: "e2", source: "note:b", target: "note:c", data: { rel: "next" } }]);
    expect(got.edges.map((e) => [e.source, e.target])).toEqual([
      ["note:a", "note:b"],
      ["note:b", "note:c"],
    ]);
    expect(got.skippedEdges).toBe(0);
  });
});
