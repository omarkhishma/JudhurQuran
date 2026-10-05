import { describe, expect, it } from "vitest";
import { themeScript } from "./headScript";

/** The head script parses and sets what this browser keeps on <html> (a syntax error there once took the theme down). */
function run(stored: Record<string, string>, path = "/quran/1", search = "") {
  const dataset: Record<string, string> = {};
  const env = {
    location: { pathname: path, search },
    localStorage: { getItem: (k: string) => stored[k] ?? null },
    document: { documentElement: { dataset } },
    addEventListener: () => {},
  };
  new Function("location", "localStorage", "document", "addEventListener", themeScript)(env.location, env.localStorage, env.document, env.addEventListener);
  return dataset;
}

describe("the head script", () => {
  it("parses", () => {
    expect(() => new Function(themeScript)).not.toThrow();
  });
  it("sets the theme, the digits, the contrast and the spacing kept in this browser", () => {
    expect(run({ "jadhr-theme": "dark", "jadhr-digits": "latin", "jadhr-contrast": "more", "jadhr-spacing": "wide" })).toEqual({ theme: "dark", digits: "latin", contrast: "more", spacing: "wide" });
    expect(run({})).toEqual({ theme: "light" });
    expect(run({ "jadhr-contrast": "bogus", "jadhr-spacing": "huge" })).toEqual({ theme: "light" });
  });
  it("takes an embed's theme from its address", () => {
    expect(run({ "jadhr-theme": "light" }, "/embed/g/x", "?theme=dark").theme).toBe("dark");
  });
});
