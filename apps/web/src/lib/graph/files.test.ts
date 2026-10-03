import { describe, expect, it } from "vitest";
import { cleanStoredFile, fileIds, MAX_FILE } from "./files";

const id = "0123456789abcdef0123456789abcdef";

describe("field files", () => {
  it("are named only by a file field's id", () => {
    const nodes = [
      { data: { fields: [{ id: "f1", kind: "image" as const, label: "i", value: id }, { id: "f2", kind: "text" as const, label: "t", value: id }] } },
      { data: { fields: [{ id: "f3", kind: "file" as const, label: "f", value: "../../etc" }, { id: "f4", kind: "audio" as const, label: "a", value: id }] } },
      { data: {} },
    ];
    expect(fileIds(nodes)).toEqual([id]);
  });

  it("come back from an export only as data URLs of a field's size", () => {
    expect(cleanStoredFile({ name: "a.png", type: "image/png", url: "data:image/png;base64,AAAA" })).toMatchObject({ name: "a.png", type: "image/png", url: "data:image/png;base64,AAAA" });
    expect(cleanStoredFile({ name: "x", url: "javascript:alert(1)" })).toBeNull();
    expect(cleanStoredFile({ name: "x", url: "https://example.com/a.png" })).toBeNull();
    expect(cleanStoredFile({ name: "x", url: `data:image/png;base64,${"A".repeat(MAX_FILE * 1.5)}` })).toBeNull();
    expect(cleanStoredFile(null)).toBeNull();
  });
});
