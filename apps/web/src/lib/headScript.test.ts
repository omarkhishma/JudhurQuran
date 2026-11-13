import { describe, expect, it } from "vitest";
import { themeScript } from "./headScript";

type Storage = (e: { key: string; newValue: string | null }) => void;

/**
 * The head script parses and sets what this browser keeps on <html> (a syntax error there once took the theme down).
 * The handles let a test turn the device dark and choose in another tab.
 */
function load(stored: Record<string, string>, { path = "/quran/1", search = "", deviceDark = false } = {}) {
  const dataset: Record<string, string> = {};
  const media = { matches: deviceDark, change: () => {} };
  const storage: Storage[] = [];
  new Function("location", "localStorage", "document", "addEventListener", "matchMedia", themeScript)(
    { pathname: path, search },
    { getItem: (k: string) => stored[k] ?? null },
    { documentElement: { dataset } },
    (type: string, f: Storage) => {
      if (type === "storage") storage.splice(storage.length, 0, f);
    },
    () => ({
      get matches() {
        return media.matches;
      },
      addEventListener: (_: string, f: () => void) => (media.change = f),
    }),
  );
  return {
    dataset,
    device(dark: boolean) {
      media.matches = dark;
      media.change();
    },
    otherTab(value: string | null) {
      if (value === null) delete stored["jadhr-theme"];
      else stored["jadhr-theme"] = value;
      for (const f of storage) f({ key: "jadhr-theme", newValue: value });
    },
  };
}
const run = (stored: Record<string, string>, path?: string, search?: string) => load(stored, { path, search }).dataset;

describe("the head script", () => {
  it("parses", () => {
    expect(() => new Function(themeScript)).not.toThrow();
  });
  it("sets the theme, the digits, the contrast and the spacing kept in this browser", () => {
    expect(run({ "jadhr-theme": "dark", "jadhr-digits": "latin", "jadhr-contrast": "more", "jadhr-spacing": "wide" })).toEqual({ theme: "dark", digits: "latin", contrast: "more", spacing: "wide" });
    expect(run({})).toEqual({ theme: "light" });
    expect(run({ "jadhr-contrast": "bogus", "jadhr-spacing": "huge" })).toEqual({ theme: "light" });
  });
  it("follows the device while the reader has not chosen, and the reader's choice over it", () => {
    expect(load({}, { deviceDark: true }).dataset.theme).toBe("dark");
    expect(load({ "jadhr-theme": "light" }, { deviceDark: true }).dataset.theme).toBe("light");
    const page = load({});
    expect(page.dataset.theme).toBe("light");
    page.device(true);
    expect(page.dataset.theme).toBe("dark");
    // another tab chooses light: the device no longer leads
    page.otherTab("light");
    expect(page.dataset.theme).toBe("light");
    page.device(false);
    page.device(true);
    expect(page.dataset.theme).toBe("light");
    // the choice cleared there: back to the device's
    page.otherTab(null);
    expect(page.dataset.theme).toBe("dark");
  });
  it("takes an embed's theme from its address", () => {
    expect(run({ "jadhr-theme": "light" }, "/embed/g/x", "?theme=dark").theme).toBe("dark");
  });
});
