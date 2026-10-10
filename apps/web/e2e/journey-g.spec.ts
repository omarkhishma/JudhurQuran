import { devices, expect, type Page, test } from "@playwright/test";
import { clean, drop, expire, person, tag } from "./board";

/**
 * Journey G, the owner's (P19, Phase 2; PV-01…07, PV-18…26): an administrator divides sūra al-Kawthar into its
 * passages, sets the word «الكوثر» its own context, and gives it a near and an opposite word — each through the
 * dashboard's tools, in force at once; then a reader, on the desktop and on a phone, taps the word in the text and
 * finds every layer of its meaning, the context the administration set with its verses, the near and opposite words,
 * its count, root and pattern, its topics, and the other words of its root, each leading to itself. `SHOTS=<dir>`
 * saves the reader's panel on both.
 */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
const shots = process.env.SHOTS;
const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet").first();

async function reader(page: Page, near: string, opposite: string, name: string) {
  await page.addInitScript((r) => localStorage.setItem("jadhr-personal", JSON.stringify(r)), RETURNING);
  await page.goto("/quran/108");
  // the reader taps the word in the text
  await page.locator('button.w[data-w="108:1:3"]').click();
  const p = panel(page);
  await expect(p.locator("h2").first()).toHaveText("كَوْثَر");
  // the data card: its context, its count, its root and its pattern, each a door to its layer
  const card = p.locator(".data-card");
  await expect(card).toContainText("من ١٠٨:١ إلى ١٠٨:٣");
  await expect(card).toContainText("ك ث ر");
  await expect(card).toContainText("مرة واحدة");
  // every layer of its meaning
  for (const layer of ["المعنى السياقي", "المعنى المعجمي", "المعنى الدلالي", "المعنى الصرفي", "المعنى النحوي", "القراءات والرسم"]) {
    await expect(p.locator(".meaning-layer-head", { hasText: layer })).toHaveCount(1);
  }
  // the context the administration set, its three verses drawn with the word marked
  const ctx = p.locator("#layer-contextual");
  await expect(ctx).toContainText("حدّدته إدارة جذر");
  await expect(ctx).toContainText("من ١٠٨:١ إلى ١٠٨:٣");
  await expect(ctx.locator(".ctx-verse")).toHaveCount(3);
  await expect(ctx.locator(".ctx-word")).toHaveCount(1);
  // the near and the opposite word the administration set
  const sem = p.locator("#layer-semantic");
  if ((await sem.locator(".meaning-layer-toggle").getAttribute("aria-expanded")) === "false") await sem.locator(".meaning-layer-toggle").click();
  await expect(sem).toContainText("كلمات قريبة المعنى");
  await expect(sem.locator(".word-chip", { hasText: near })).toHaveCount(1);
  await expect(sem.locator(".word-chip", { hasText: opposite })).toHaveCount(1);
  // the morphological layer names its pattern
  const morph = p.locator("#layer-morphological");
  if ((await morph.locator(".meaning-layer-toggle").getAttribute("aria-expanded")) === "false") await morph.locator(".meaning-layer-toggle").click();
  await expect(morph).toContainText("فَوْعَل");
  if (shots) {
    await ctx.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${shots}/journey-g-${name}.png` });
  }
  // no control inside another anywhere on the open panel (the layers' dotted names stand beside their toggles)
  expect(await page.locator("button button, a a, a button, button a").count()).toBe(0);
  // the other words of its root, each leading to itself
  const fam = p.locator(".layer", { hasText: "أسرة الجذر" }).first();
  const head = fam.locator(".layer-head").first();
  if ((await head.getAttribute("aria-expanded")) !== "true") await head.click();
  const chips = fam.locator(".word-chip");
  expect(await chips.count()).toBeGreaterThanOrEqual(5);
  const other = chips.filter({ hasNotText: "كَوْثَر" }).first();
  const otherAr = (await other.locator("span").first().innerText()).trim();
  await other.click();
  await expect(p.locator("h2").first()).toHaveText(otherAr);
  // its verses are listed in the Quran, each leading to its verse
  const inQuran = p.locator(".layer", { hasText: "في القرآن" }).first();
  const qh = inQuran.locator(".layer-head").first();
  if ((await qh.getAttribute("aria-expanded")) !== "true") await qh.click();
  await expect(inQuran.locator("a, button").first()).toBeVisible();
}

test("journey G: the administration sets a word's context and its near and opposite words; the reader finds them with every layer, on desktop and phone (P19)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "the administrator's account is made in a desktop window; the reader's phone is opened below");
  test.setTimeout(240_000);
  const a = await person(browser, `e2e-jg-${tag()}@example.org`, "admin");
  try {
    // 1. the sūra's passages, against the sources' boundaries: a new passage at verse 2
    await a.page.goto("/workbench?kind=context_passages&target=108");
    await expect(a.page.locator(".passage-verse")).toHaveCount(3);
    await a.page.getByRole("button", { name: "ابدأ مقطعًا عند الآية ٢" }).click();
    await a.page.getByRole("textbox", { name: "عنوان المقطع (اختياري)" }).first().fill("العطاء");
    await a.page.getByRole("button", { name: "احفظ وانشر" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "نُشر، ويراه القارئ الآن." })).toBeVisible();

    // 2. the word's own context: the whole sūra
    await a.page.goto("/workbench?kind=context_word&target=108:1:3");
    await expect(a.page.locator("#ctxw-h")).toBeVisible();
    await a.page.getByRole("textbox", { name: "من" }).fill("108:1");
    await a.page.getByRole("textbox", { name: "إلى" }).fill("108:3");
    await a.page.getByRole("button", { name: "احفظ وانشر" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "نُشر، ويراه القارئ الآن." })).toBeVisible();

    // 3. its near and opposite words, found by search
    await a.page.goto("/workbench?kind=word_relations&target=kawthar");
    await expect(a.page.locator("#rel-h")).toBeVisible();
    const pick = async (q: string, rel: string) => {
      await a.page.getByRole("searchbox", { name: "ابحث عن كلمة في القرآن" }).fill(q);
      await a.page.getByRole("button", { name: "ابحث", exact: true }).click();
      const found = a.page.locator('[aria-live="polite"] li').first();
      await expect(found).toBeVisible();
      const ar = (await found.locator("[lang=ar]").first().innerText()).trim();
      await found.getByRole("button", { name: rel }).click();
      return ar;
    };
    const near = await pick("خير", "قريبة المعنى");
    const opposite = await pick("أبتر", "مقابلة");
    await a.page.getByRole("button", { name: "احفظ وانشر" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "نُشر، ويراه القارئ الآن." })).toBeVisible();
    const rel = (await (await a.page.request.get("/api/v1/words/kawthar/relations")).json()) as { defined: Record<string, { by: string }[]> };
    expect(rel.defined.near?.[0]?.by).toBe("administration");
    expect(rel.defined.opposite?.[0]?.by).toBe("administration");
    await expire(a.page);

    // 4. a reader on the desktop, then on a phone
    const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await reader(await desk.newPage(), near, opposite, "desktop");
    await desk.close();
    const phone = await browser.newContext({ ...devices["Pixel 7"] });
    await reader(await phone.newPage(), near, opposite, "phone");
    await phone.close();
  } finally {
    clean([a.email]);
    await expire(a.page);
    await drop(a);
  }
});
