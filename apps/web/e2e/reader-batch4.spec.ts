import { expect, type Page, test } from "@playwright/test";
import { api, arKey } from "./helpers";

/** Verse furniture that is not a control (RDR-547) and proposals on glosses and morphology (RDR-567). */

const BASE = { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [] as unknown[], savedTrails: [] };
const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet");
const seed = (page: Page, prefs?: Record<string, unknown>) =>
  page.addInitScript(
    ([s, p]) => {
      if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: s, version: 1 }));
      if (p) localStorage.setItem("jadhr-prefs", JSON.stringify({ state: p, version: 2 }));
    },
    [BASE, prefs ?? null] as const,
  );
const SAJDA = "۩";

test("the sajda sign stands beside its word, not inside it, and the words read back as stored (RDR-547)", async ({ page, context, browserName, isMobile }) => {
  const desktopClipboard = browserName === "chromium" && !isMobile;
  if (desktopClipboard) await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await seed(page);
  const v = await api<{ tokens: { text: string }[] }>(page, "/verses/32:15");
  expect(v.tokens.some((t) => t.text.endsWith(SAJDA))).toBeTruthy();
  await page.goto("/quran/32#v15");
  const verse = page.locator('[data-verse="32:15"]');
  const mark = verse.locator(".sajda-mark");
  await expect(mark).toHaveCount(1);
  await expect(mark).toHaveAttribute("aria-label", "موضع سجدة التلاوة");
  await expect(verse.locator("button.w", { hasText: SAJDA })).toHaveCount(0);
  // what is drawn joins back to the stored tokens, letter for letter (L1)
  const shown = await verse.locator(".w").evaluateAll((els) =>
    els.map((w) => (w.textContent ?? "") + (w.nextElementSibling?.getAttribute("data-furniture") === "sajda" ? (w.nextElementSibling.textContent ?? "") : "")),
  );
  expect(shown).toEqual(v.tokens.map((t) => t.text));
  // the sign opens nothing
  await mark.click();
  await expect(page).not.toHaveURL(/[?&]w=/);
  if (desktopClipboard) {
    await page.locator('[data-verse-btn="32:15"]').click();
    await verse.locator('.ptool[data-tool="copy"]').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain(v.tokens.map((t) => t.text).join(" "));
  }
});

test("waqf signs stay on the word they are written on (RDR-547)", async ({ page }) => {
  await seed(page);
  const v = await api<{ tokens: { text: string }[] }>(page, "/verses/2:2");
  const withSign = v.tokens.find((t) => /[ۖ-ۜ]$/.test(t.text));
  expect(withSign, "2:2 carries a waqf sign").toBeTruthy();
  await page.goto("/quran/2#v2");
  await expect(page.locator('[data-verse="2:2"] button.w', { hasText: withSign!.text })).toHaveCount(1);
});

type Lbl = { ar: string };
type Word = { root: { ar_spaced: string } | null; occurrence: { location: string; gloss_en: string | null; features: { case?: Lbl | null } } };

test("a gloss and a morphology tag can be proposed for this place, and nothing reaches the Quranic text (RDR-567)", async ({ page }) => {
  const w = await api<Word>(page, "/words/ilm?at=20:114:17&limit=0");
  expect(w.occurrence.gloss_en).toBeTruthy();
  expect(w.occurrence.features.case?.ar).toBeTruthy();
  await seed(page, { layerOpen: { senses: true, family: false, patterns: false, lexica: false, timeline: false, usage: false } });
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  const p = panel(page);

  await p.locator('[data-section="senses"]').getByRole("button", { name: "اقترح معنى حرفيًا أدق" }).first().click();
  const g = page.getByRole("dialog", { name: "اقترح معنى حرفيًا أدق" });
  await expect(g).toContainText(arKey("20:114:17"));
  await expect(g).toContainText(w.occurrence.gloss_en!);
  await expect(g).toContainText("أما النص القرآني نفسه فلا يدخل في أي اقتراح");
  const send = g.getByRole("button", { name: "أرسل للمراجعة" });
  await expect(send).toBeDisabled(); // the wording still equals the current gloss
  await g.locator("textarea").fill("knowledge, here: what God teaches");
  await expect(send).toBeDisabled(); // a reason is required
  await g.getByRole("textbox", { name: /السبب والمصدر/ }).fill("سبب للاختبار");
  await send.click();
  // signed out: kept here, and sign-in asked for after the writing, never before (P7, 10 §4.4)
  await expect(g.getByRole("status")).toContainText("حُفظ اقتراحك على هذا الجهاز");
  await g.getByRole("button", { name: "ليس الآن" }).click();
  await expect(g).toHaveCount(0);

  await p.getByRole("button", { name: "اقترح تصحيحًا" }).click();
  const m = page.getByRole("dialog", { name: "اقترح تصحيحًا للتحليل الصرفي" });
  const field = m.locator("select");
  const options = await field.locator("option").allInnerTexts();
  expect(options.slice(0, 3)).toEqual(["الجذر", "الصيغة المعجمية", "النوع"]);
  await expect(m).toContainText(w.root!.ar_spaced);
  await field.selectOption({ label: "الحالة الإعرابية" });
  await expect(m).toContainText(w.occurrence.features.case!.ar);
  await m.locator("textarea").fill("حالة أخرى");
  await m.getByRole("textbox", { name: /السبب والمصدر/ }).fill("سبب للاختبار");
  await expect(m).toContainText("نُسب إليك");
  await m.getByRole("button", { name: "أرسل للمراجعة" }).click();
  await m.getByRole("button", { name: "ليس الآن" }).click();

  const box = p.getByRole("region", { name: "ما اقترحته" });
  await expect(box).toContainText("معنى الكلمة • 20:114:17");
  await expect(box).toContainText("تصحيح صرفي • الحالة الإعرابية • 20:114:17");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state.proposals);
  expect(stored).toEqual([
    expect.objectContaining({ kind: "gloss", slug: "ilm", at: "20:114:17", current: w.occurrence.gloss_en, status: "pending" }),
    expect.objectContaining({ kind: "morphology", slug: "ilm", at: "20:114:17", field: "gCase", current: w.occurrence.features.case!.ar, text: "حالة أخرى" }),
  ]);
});
