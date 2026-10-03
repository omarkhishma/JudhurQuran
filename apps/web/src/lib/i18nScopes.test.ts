import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCOPES } from "./i18nScopes";

const SRC = path.resolve(__dirname, "..");
const APP = path.join(SRC, "app", "[locale]");
const IMPORT = /(?:import|export)[^'"]*?from\s+["']([^"']+)["']|import\(["']([^"']+)["']\)/g;
// a component asks for its copy with useTranslations("…"); getTranslations runs on the server, which reads every namespace
const CLIENT_NS = /useTranslations\(\s*"([a-zA-Z]+)"/g;

function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? path.join(SRC, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext;
  return null;
}

function reachable(starts: string[]): Set<string> {
  const seen = new Set<string>();
  const ns = new Set<string>();
  const stack = [...starts];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(CLIENT_NS)) ns.add(m[1]);
    for (const m of s.matchAll(IMPORT)) {
      const r = resolve(f, m[1] ?? m[2]);
      if (r) stack.push(r);
    }
  }
  return ns;
}

function entries(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...entries(p));
    else if (/^(page|layout|loading|error|not-found)\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

describe("the copy each route group sends to the browser (lib/i18nScopes)", () => {
  for (const [group, scope] of [["(app)", SCOPES.app], ["(reader)", SCOPES.reader], ["(site)", SCOPES.site]] as const) {
    it(`${group} sends every namespace its components ask for`, () => {
      const needed = reachable(entries(path.join(APP, group)));
      const missing = [...needed].filter((n) => !(scope as readonly string[]).includes(n) && !(SCOPES.root as readonly string[]).includes(n));
      expect(missing, `namespaces ${group} needs but does not send`).toEqual([]);
    });
  }
  it("the root sends what the locale layout, its error and not-found pages ask for", () => {
    const needed = reachable(["layout.tsx", "error.tsx", "not-found.tsx"].map((f) => path.join(APP, f)).filter((f) => existsSync(f)));
    expect([...needed].filter((n) => !(SCOPES.root as readonly string[]).includes(n))).toEqual([]);
  });
});
