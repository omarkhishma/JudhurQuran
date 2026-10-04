import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { dynamicRoutes, STATIC } from "./routes";

/**
 * P12's accessibility floor, as a sweep: every route of the site, in Arabic and English and in both themes, and every
 * overlay a reader opens — the omnibox, the cite dialog, the hand-off to the map editor, the proposal form, the term
 * card, the sign-in sheet, the reading preferences — checked by axe against WCAG 2.1 AA; any serious or critical
 * violation fails, named with its page, its theme and where it is.
 */

test.describe.configure({ mode: "parallel" });
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const SEED = { state: { visited: true, onboarded: true }, version: 3 };

async function serious(page: Page): Promise<string[]> {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`);
}

for (const locale of ["ar", "en"] as const)
  for (const theme of ["light", "dark"] as const)
    test(`axe on every route in ${locale}, ${theme} (P12)`, async ({ browser, isMobile }) => {
      test.skip(isMobile, "one project runs the sweep");
      test.setTimeout(900_000);
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.addInitScript(([t, s]) => {
        try {
          localStorage.setItem("jadhr-theme", t);
          if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify(s));
        } catch {}
      }, [theme, SEED] as const);
      const page = await ctx.newPage();
      const failures: string[] = [];
      for (const r of [...STATIC, ...(await dynamicRoutes(page))]) {
        const path = locale === "ar" ? r : `/en${r === "/" ? "" : r}`;
        await page.goto(path, { waitUntil: "load" });
        await page.waitForLoadState("networkidle").catch(() => {});
        for (const v of await serious(page)) failures.push(`${path} ${theme}: ${v}`);
      }
      await ctx.close();
      expect(failures, failures.join("\n")).toEqual([]);
    });

type Overlay = { name: string; path: string; open: (page: Page) => Promise<void> };
const OVERLAYS: Overlay[] = [
  { name: "the omnibox", path: "/quran/1", open: async (p) => { await p.locator(".w").first().waitFor(); await p.keyboard.press("Control+k"); await p.getByRole("combobox", { name: "ابحث في كل شيء" }).fill("علم"); await p.getByRole("option").first().waitFor(); } },
  { name: "the cite dialog", path: "/quran/20?w=ilm&at=20:114:17", open: async (p) => { await p.locator(".reader-panel").getByRole("button", { name: "استشهد" }).first().click(); await p.getByRole("dialog", { name: "استشهد بهذا" }).waitFor(); } },
  { name: "the hand-off to the map editor", path: "/quran/20?w=ilm&at=20:114:17", open: async (p) => { await p.locator(".reader-panel").getByRole("button", { name: /افتح في الخريطة|الخريطة/ }).first().click(); await p.getByRole("dialog", { name: "سلّمه إلى محرر الخرائط" }).waitFor(); } },
  { name: "the proposal form", path: "/quran/20?w=ilm&at=20:114:17", open: async (p) => { await p.locator(".reader-panel").getByRole("button", { name: "اقترح معنى حرفيًا أدق" }).first().click(); await p.getByRole("dialog").first().waitFor(); } },
  { name: "the reading preferences", path: "/quran/1", open: async (p) => { await p.getByRole("button", { name: "القراءة", exact: true }).click(); await p.getByRole("dialog", { name: "تفضيلات القراءة" }).waitFor(); } },
  { name: "the sign-in sheet", path: "/", open: async (p) => { await p.getByRole("banner").getByRole("button", { name: "دخول" }).click(); await p.getByRole("dialog").first().waitFor(); } },
  { name: "the omnibox before a word is typed", path: "/quran/1", open: async (p) => { await p.locator(".w").first().waitFor(); await p.keyboard.press("Control+k"); await p.getByRole("combobox", { name: "ابحث في كل شيء" }).waitFor(); } },
  { name: "the panel's search with its results", path: "/quran/1", open: async (p) => { await p.getByRole("combobox", { name: /ابحث عن كلمة|كلمة بالتشكيل/ }).first().fill("علم"); await p.getByRole("option").first().waitFor(); } },
  { name: "the word panel beside a hadith", path: "/hadith/bukhari/1", open: async (p) => { await p.locator(".hadith-text button.w").first().click(); await p.getByRole("complementary", { name: "الكلمة" }).waitFor(); } },
];

for (const theme of ["light", "dark"] as const)
  for (const o of OVERLAYS)
    test(`axe ${theme}: ${o.name} (P12)`, async ({ page, isMobile }) => {
      test.skip(isMobile, "the desktop's overlays; the phone's sheet is checked by the reader's own tests");
      await page.addInitScript(([t, s]) => {
        localStorage.setItem("jadhr-theme", t);
        if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify(s));
      }, [theme, SEED] as const);
      await page.goto(o.path);
      await page.waitForLoadState("networkidle").catch(() => {});
      await o.open(page);
      await page.waitForTimeout(300);
      expect(await serious(page)).toEqual([]);
    });
