import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/", "/quran", "/quran/1", "/quran/2/255", "/word/2:255:23", `/roots/${encodeURIComponent("علم")}`, "/search?q=%D8%B5%D8%A8%D8%B1", "/concordance", "/concordance?view=dist", "/about", "/sources", "/saved", "/en", "/en/word/1:1:1", "/analyse", "/analyse?q=2%3A255&view=interlinear", "/library", "/library/text/missing", "/explore", "/notebook"];

for (const path of PAGES) {
  test(`axe: ${decodeURIComponent(path)}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(
      serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`),
      "serious or critical accessibility violations",
    ).toEqual([]);
  });
}

// Dark theme: its own tokens, checked on the pages that use the most colours.
for (const path of ["/quran/2/255", "/word/2:255:23", `/roots/${encodeURIComponent("علم")}`, "/search?q=%D8%B5%D8%A8%D8%B1", "/concordance?view=dist", "/en"]) {
  test(`axe dark: ${decodeURIComponent(path)}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("jadhr-theme", "dark"));
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
}


// The states a page reaches by use (P5.6, audit 10): a set, the study deck, the review overlay, the journal, a note
// open, the sign-in sheet — each in both themes.
const NOTE = { id: "n1", title: "عن العلم", body: "انظر @2:255 و@ع ل م", tags: ["درس"], created: 1759000000000, updated: 1759000000000, links: { roots: ["علم"], verses: ["2:255"], words: [] } };
const SEED = {
  "jadhr-personal": { state: { visited: true, onboarded: true, wordStates: { Eilom: "known" }, sessions: [{ day: new Date().toLocaleDateString("en-CA"), text: "quran", words: ["Eilom"], roots: ["علم"], verses: ["2:255"], lookups: 3 }] }, version: 2 },
  "jadhr-saved": { state: { bookmarks: [{ kind: "lemma", key: "Eilom", label: "عِلْم", at: 1 }], notes: {}, history: [] }, version: 2 },
  "jadhr-notebook": { state: { notes: [NOTE] }, version: 1 },
};
type Page = import("@playwright/test").Page;
const STATES: { name: string; path: string; act?: (page: Page) => Promise<void> }[] = [
  { name: "a set", path: "/explore?set=ilm" },
  {
    name: "the study deck",
    path: "/explore?set=ilm",
    act: async (page) => {
      await page.getByRole("button", { name: "ادرسها بالبطاقات" }).click();
      await page.getByRole("dialog").waitFor();
    },
  },
  { name: "the review overlay", path: "/quran/1?mode=review", act: async (page) => void (await page.locator(".review-card").waitFor()) },
  { name: "the journal", path: "/notebook?tab=journal" },
  { name: "an open note", path: "/notebook?note=n1", act: async (page) => void (await page.locator(".notebook-editor").waitFor()) },
  {
    name: "the sign-in sheet",
    path: "/explore",
    act: async (page) => {
      await page.getByRole("banner").getByRole("button", { name: "دخول" }).click();
      await page.getByRole("dialog").waitFor();
    },
  },
];
for (const theme of ["light", "dark"] as const)
  for (const s of STATES) {
    test(`axe ${theme}: ${s.name}`, async ({ page }) => {
      await page.addInitScript(
        ([seed, th]) => {
          if (sessionStorage.getItem("axe-seeded")) return;
          sessionStorage.setItem("axe-seeded", "1");
          for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
          localStorage.setItem("jadhr-theme", th);
        },
        [SEED, theme] as const,
      );
      await page.goto(s.path);
      await page.waitForLoadState("networkidle");
      await s.act?.(page);
      await page.waitForTimeout(400); // an overlay's entrance (≤ 160 ms) has finished: contrast is read at rest
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
  }
