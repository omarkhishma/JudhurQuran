import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ar from "../messages/ar.json";
import en from "../messages/en.json";

/** A message with a rich tag («<term>…</term>») shown through plain t() prints the tag itself on screen;
 * every such message must go through t.rich (the corpus credit did, in three places). */
function tagged(messages: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [ns, v] of Object.entries(messages)) {
    if (!v || typeof v !== "object") continue;
    for (const [k, s] of Object.entries(v as Record<string, unknown>)) if (typeof s === "string" && /<\w+>/.test(s)) out.push(`${ns}.${k}`);
  }
  return out;
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : /\.tsx?$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });
}

describe("messages with rich tags", () => {
  const keys = [...new Set([...tagged(ar), ...tagged(en)])].map((k) => k.split(".")[1]);
  it("exist (the check below is not vacuous)", () => {
    expect(keys).toContain("corpusGlossCredit");
  });
  it("are never passed to a plain t()", () => {
    const root = join(__dirname, "..");
    const bad: string[] = [];
    for (const file of sources(root)) {
      const text = readFileSync(file, "utf8");
      for (const k of keys) if (new RegExp(`(?<![\\w.])t[a-z]?\\(\\s*["'\`]${k}["'\`]`).test(text)) bad.push(`${file.slice(root.length + 1)}: ${k}`);
    }
    expect(bad).toEqual([]);
  });
});
