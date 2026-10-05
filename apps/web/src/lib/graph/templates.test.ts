import { describe, expect, it } from "vitest";
import { TEMPLATE_IDS, templateOf, templatesFor } from "./templates";

describe("a map type's fields (B37)", () => {
  it("are offered by the map's type to the cards they fit, and only to those", () => {
    expect(templatesFor("meaning", "lemma").map((t) => t.id)).toEqual(["semanticField", "difference"]);
    expect(templatesFor("meaning", "verse")).toEqual([]);
    expect(templatesFor("topic", "verse").map((t) => [t.id, t.kind])).toEqual([["axis", "select"]]);
    expect(templatesFor("free", "lemma")).toEqual([]);
    expect(templatesFor("root", "root")).toEqual([]);
  });
  it("are each found by its id, every id listed once", () => {
    for (const id of TEMPLATE_IDS) expect(templateOf(id).id).toBe(id);
    expect(new Set(TEMPLATE_IDS).size).toBe(TEMPLATE_IDS.length);
  });
});
