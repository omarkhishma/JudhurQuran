import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { api, ar, arCount, expectNoHorizontalScroll } from "./helpers";

/** The hub (P5.1, inventory HUB with the Quran notes HUB-Q01…Q08, design 06 §6.1). */

type Wotd = { date: string; lemma: { slug: string; ar: { full: string } }; root: { key: string; ar_spaced: string } };
type Meta = { dataset: { version: string; counts: Record<string, number> } };

const mecca = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const seed = (extra: Record<string, unknown>) => ({ state: { visited: true, onboarded: true, wordStates: {}, trail: [], progress: {}, proposals: [], savedTrails: [], ...extra }, version: 2 });

test("the masthead: the root of the day for Mecca's date with its word, the name in Ibn Fāris's words, the premise", async ({ page, isMobile }) => {
  const w = await api<Wotd>(page, `/word-of-the-day?date=${mecca()}`);
  await page.goto("/");
  const glyph = page.locator(".hub-glyph");
  await expect(glyph).toHaveText(w.root.ar_spaced);
  await expect(glyph).toHaveAttribute("href", `/roots/${encodeURIComponent(w.root.key)}`);
  await expect(page.locator(".hub-rotd-cap")).toContainText(w.lemma.ar.full);
  await expect(page.locator(".hub-rotd-word")).toHaveAttribute("href", "/explore");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("اقرأ القرآن الكريم من جذور كلماته");
  const name = page.locator(".hub-name");
  await expect(name).toContainText("الجيم والذال والراء أصلٌ واحدٌ، وهو الأصل من كلِّ شئ");
  await expect(name).toContainText("ابن فارس، مقاييس اللغة ١/٤٣٦");
  if (isMobile) await expectNoHorizontalScroll(page);
});

test("search: the Quran's own queries, ⌘K back to the field while it shows, the omnibox once scrolled away", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcuts are a desktop affordance");
  await page.goto("/");
  const field = page.getByRole("search", { name: "ابحث في القرآن" }).getByRole("textbox");
  // the examples teach the Quran's queries as links, at every width
  const tries = page.locator(".hub-try");
  await expect(tries).toHaveText(["عِلْم", "ع ل م", "٢:٢٥٥", "البقرة ٢٥٥"]);
  await expect(tries.nth(3)).toHaveAttribute("href", `/search?q=${encodeURIComponent("البقرة ٢٥٥")}`);
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("ControlOrMeta+k");
  await expect(field).toBeFocused();
  await expect(page.getByRole("dialog", { name: "البحث في القرآن الكريم" })).toHaveCount(0);
  await page.locator(".hub-prompt, .hub-all").last().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog", { name: "البحث في القرآن الكريم" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.scrollTo(0, 0));
  await field.fill("البقرة ٢٥٥");
  await field.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=/);
  expect(decodeURIComponent(new URL(page.url()).searchParams.get("q") ?? "")).toBe("البقرة ٢٥٥");
});

test("pick up where you left off: sūra and verse, word and root; Clear hides it and keeps the reading", async ({ page }) => {
  await page.addInitScript((v) => { if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify(v)); }, seed({ progress: { quran: { chapter: 18, passage: 10, at: Date.now() } }, context: { word: "ilm", wordAr: "عِلْم", root: "علم", verse: "18:10", ts: Date.now() } }));
  await page.goto("/");
  const strip = page.getByRole("region", { name: "تابع من حيث توقفت" });
  await expect(strip.locator('[data-kind="text"]')).toHaveText(`سورة الكهف • الآية ${ar(10)}`);
  await expect(strip.locator('[data-kind="text"]')).toHaveAttribute("href", "/quran/18#v10");
  await expect(strip.locator('[data-kind="word"]')).toHaveAttribute("href", "/read?w=ilm");
  await expect(strip.locator('[data-kind="root"]')).toHaveAttribute("href", `/concordance?root=${encodeURIComponent("علم")}`);
  await expect(strip.locator('[data-kind="root"]')).toContainText("ع ل م");
  await strip.getByRole("button", { name: "امسح" }).click();
  await expect(strip).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "تابع من حيث توقفت" })).toHaveCount(0);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state);
  expect(kept.progress.quran).toMatchObject({ chapter: 18, passage: 10 });
  expect(kept.context).toBeNull();
});

test("a first visit has nothing to resume, so there is no strip", async ({ page }) => {
  await page.addInitScript((v) => localStorage.setItem("jadhr-personal", JSON.stringify(v)), seed({}));
  await page.goto("/");
  await expect(page.locator(".hub-glyph")).toBeVisible();
  await expect(page.getByRole("region", { name: "تابع من حيث توقفت" })).toHaveCount(0);
});

test("the doors count from the data, and every surface is listed with its purpose and nothing leads to a missing page", async ({ page }) => {
  const meta = await api<Meta>(page, "/meta");
  const lexica = (await api<{ data: unknown[] }>(page, "/lexicon/works")).data.length;
  const c = meta.dataset.counts;
  await page.goto("/");
  const doors = page.getByRole("navigation", { name: "ثلاثة أبواب" });
  // each count agrees with its number, whatever the dataset holds (P2.4)
  const surahs = arCount(c.surahs, { one: "سورة واحدة", two: "سورتان", few: "# سور", many: "# سورة", other: "# سورة" });
  const verses = arCount(c.verses, { one: "آية واحدة", two: "آيتان", few: "# آيات", many: "# آية", other: "# آية" });
  const roots = arCount(c.roots, { one: "جذر واحد", two: "جذران", few: "# جذور", many: "# جذرًا", other: "# جذر" });
  const lemmas = arCount(c.lemmas, { one: "كلمة واحدة", two: "كلمتان", few: "# كلمات", many: "# كلمة", other: "# كلمة" });
  await expect(doors.getByRole("link", { name: /^اقرأ/ })).toContainText(`${surahs} و${verses}`);
  await expect(doors.getByRole("link", { name: /ابحث في المعجم/ })).toContainText(`${roots} و${lemmas}`);
  await expect(doors.getByRole("link", { name: /ابحث في المعجم/ })).toContainText(arCount(lexica, { one: "معجم واحد", two: "معجمان", few: "# معاجم", many: "# معجمًا", other: "# معجم" }));
  const tiles = page.locator(".hub-tile");
  await expect(tiles).toHaveCount(20);
  for (const tile of await tiles.all()) await expect(tile.locator(".hub-tile-purpose")).not.toBeEmpty();
  await expect(page.locator('.hub-tile[data-building] .hub-tile-phase').first()).toContainText("قيد البناء");
  const hrefs = await page.locator("a.hub-tile").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  for (const href of hrefs) {
    const r = await page.request.get(href);
    expect(r.status(), href).toBeLessThan(400);
  }
  await expect(page.locator("footer")).toContainText(meta.dataset.version);
});

test("the local-first note: what this browser holds, an export of every store, and Not now stays dismissed", async ({ page }) => {
  const saved = { state: { bookmarks: [{ kind: "lemma", key: "ilm", label: "عِلْم", at: 1 }, { kind: "verse", key: "2:255", label: "٢:٢٥٥", at: 2 }], notes: { "quran:2:255": { verse: "2:255", text: "آية الكرسي", at: 3 } }, history: [] }, version: 2 };
  await page.addInitScript(
    ([p, s]) => {
      if (localStorage.getItem("jadhr-personal")) return;
      localStorage.setItem("jadhr-personal", JSON.stringify(p));
      localStorage.setItem("jadhr-saved", JSON.stringify(s));
    },
    [seed({ wordStates: { ilm: "learning" } }), saved] as const,
  );
  await page.goto("/");
  const note = page.getByRole("region", { name: /على هذا الجهاز/ });
  await expect(note.getByRole("heading")).toHaveText("على هذا الجهاز: محفوظان وملاحظة واحدة");
  const [download] = await Promise.all([page.waitForEvent("download"), note.getByRole("button", { name: "صدّر بياناتي" }).click()]);
  const file = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(file.format).toBe("jadhr-local-1");
  expect(file.local["jadhr-saved"].state.notes["quran:2:255"].text).toBe("آية الكرسي");
  expect(file.local["jadhr-personal"].state.wordStates).toEqual({ ilm: "learning" });
  await note.getByRole("button", { name: "ليس الآن" }).click();
  await expect(note).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".hub-glyph")).toBeVisible();
  await expect(page.getByRole("region", { name: /على هذا الجهاز|كل ما هنا يعمل بلا حساب/ })).toHaveCount(0);
});

test("English: the same hub with the name glossed and Latin digits", async ({ page }) => {
  const meta = await api<Meta>(page, "/meta");
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Read the Quran through the roots of its words");
  await expect(page.locator(".hub-name")).toContainText("jadhr, “root”");
  await expect(page.getByRole("navigation", { name: "Three ways in" })).toContainText(`${meta.dataset.counts.surahs} sūras`);
});
