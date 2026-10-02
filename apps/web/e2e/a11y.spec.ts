import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/", "/quran", "/quran/1", "/quran/2/255", "/word/2:255:23", `/roots/${encodeURIComponent("علم")}`, "/search?q=%D8%B5%D8%A8%D8%B1", "/about", "/sources", "/saved", "/en", "/en/word/1:1:1"];

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
for (const path of ["/quran/2/255", "/word/2:255:23", `/roots/${encodeURIComponent("علم")}`, "/search?q=%D8%B5%D8%A8%D8%B1", "/en"]) {
  test(`axe dark: ${decodeURIComponent(path)}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("judhur-theme", "dark"));
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
}

