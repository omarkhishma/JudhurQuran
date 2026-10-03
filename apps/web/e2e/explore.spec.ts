import { expect, test } from "@playwright/test";
import { api, ar, arCount, expectNoHorizontalScroll } from "./helpers";

/** Explore (P5.2, inventory COL with the Quran notes COL-Q01…Q07, design 06 §6.2). Numbers come from the API. */

type Wotd = { date: string; lemma: { slug: string; ar: { full: string } }; root: { key: string; ar_spaced: string }; attestation: { surah: { number: number }; ayah: number; tokens: string[]; token_from: number; token_to: number } };
type SetCard = { id: string; item_count: number; root_count: number; slugs: string[]; title_ar: string };
type SetDetail = SetCard & { items: { slug: string; ar: { full: string }; root: { key: string } | null }[]; occurrences: number; quote: { attribution_ar: string } | null };

const mecca = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const seed = (extra: Record<string, unknown>) => ({ state: { visited: true, onboarded: true, wordStates: {}, trail: [], progress: {}, proposals: [], savedTrails: [], ...extra }, version: 2 });
const words = (n: number) => arCount(n, { one: "كلمة واحدة", two: "كلمتان", few: "# كلمات", many: "# كلمة", other: "# كلمة" });

test("the word of the day: Mecca's date with the Hijri one, its root, and its first verse with the word marked (COL-03…10, Q01, Q02)", async ({ page, isMobile }) => {
  const w = await api<Wotd>(page, `/word-of-the-day?date=${mecca()}`);
  await page.goto("/explore");
  const card = page.locator(".wotd-card");
  await expect(card.locator(".wotd-word")).toHaveText(w.lemma.ar.full);
  const d = new Date(`${w.date}T12:00:00+03:00`);
  const hijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" }).format(d);
  await expect(card.locator(".wotd-label")).toContainText(hijri);
  await expect(card.getByRole("link", { name: `الجذر ${w.root.ar_spaced}` })).toHaveAttribute("href", `/roots/${encodeURIComponent(w.root.key)}`);
  const at = w.attestation;
  await expect(card.locator(".wotd-mark")).toHaveText(at.tokens.slice(at.token_from - 1, at.token_to));
  await expect(card.locator(`a[href="/quran/${at.surah.number}/${at.ayah}"]`)).toBeVisible();
  await expect(card.locator(".wotd-word")).toHaveAttribute("href", `/read?mode=ask&q=${encodeURIComponent(w.lemma.ar.full)}`);
  if (isMobile) await expectNoHorizontalScroll(page);
});

test("progress counts words met and how much of the Quran they cover, with no streak (COL-11…13, Q04)", async ({ page }) => {
  await page.addInitScript((v) => localStorage.setItem("jadhr-personal", JSON.stringify(v)), seed({ wordStates: { ilm: "known", qala: "learning", kitab: "new" } }));
  const r = await page.request.post("/api/v1/lemmas/coverage", { data: { slugs: ["ilm", "qala"] } });
  const cov = (await r.json()) as { roots: number; coverage: number };
  await page.goto("/explore");
  const card = page.getByRole("region", { name: "تقدّمك" });
  await expect(card).toContainText("كلمتان لقيتهما");
  await expect(card).toContainText(`تعرف ${ar(1)} • تتعلّم ${ar(1)}`);
  // the roots only once known: never a ٠ that means "loading" (COL-11)
  await expect(card).toContainText(`من ${arCount(cov.roots, { one: "جذر واحد", two: "جذرين", few: "# جذور", many: "# جذرًا", other: "# جذر" })}`);
  await expect(card).toContainText(new Intl.NumberFormat("ar-EG", { style: "percent", maximumFractionDigits: 1 }).format(cov.coverage));
  await expect(card).toContainText("لا عدّاد أيام");
});

test("the sets: counted from the data, what the reader has met, and a set opens on its own URL that Back leaves (COL-14…18, 45)", async ({ page }) => {
  const sets = (await api<{ data: SetCard[] }>(page, "/collections")).data;
  await page.addInitScript((v) => localStorage.setItem("jadhr-personal", JSON.stringify(v)), seed({ wordStates: { ilm: "known" } }));
  await page.goto("/explore");
  const cards = page.locator(".set-card");
  await expect(cards).toHaveCount(sets.length);
  const ilm = sets.find((s) => s.id === "ilm")!;
  const card = cards.filter({ hasText: ilm.title_ar });
  await expect(card).toContainText(words(ilm.item_count));
  await expect(card).toContainText(`لقيت ${ar(1)} من ${ar(ilm.item_count)}`);
  await card.click();
  await expect(page).toHaveURL(/\/explore\?set=ilm$/);
  await expect(page.locator(".set-item")).toHaveCount(ilm.item_count);
  await page.goBack();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.locator(".set-card")).toHaveCount(sets.length);
});

test("in a set: root chips per word, Keep cycles learning → known → off and stars the word so it reaches review, particles say no root, the rule quoted (COL-32…38, 52, RDR-360)", async ({ page }) => {
  const doers = await api<SetDetail>(page, "/collections/doers");
  await page.goto("/explore?set=doers");
  const first = page.locator(".set-item").first();
  await expect(first.locator(".root-chip")).toHaveAttribute("href", `/concordance?root=${encodeURIComponent(doers.items[0].root!.key)}`);
  const keep = first.getByRole("button", { name: "احتفظ بها" });
  const state = () => page.evaluate((s) => JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state?.wordStates?.[s], doers.items[0].slug);
  const starred = () => page.evaluate((s) => (JSON.parse(localStorage.getItem("jadhr-saved") ?? "{}").state?.bookmarks ?? []).some((b: { kind: string; key: string }) => b.kind === "lemma" && b.key === s), doers.items[0].slug);
  await keep.click();
  await expect(first.getByRole("button", { name: "أتعلّمها" })).toBeVisible();
  expect([await state(), await starred()]).toEqual(["learning", true]);
  await first.getByRole("button", { name: "أتعلّمها" }).click();
  expect([await state(), await starred()]).toEqual(["known", true]);
  await first.getByRole("button", { name: "أعرفها ✓" }).click();
  expect([await state(), await starred()]).toEqual(["new", false]);
  await page.goto("/explore?set=particles");
  await expect(page.locator(".set-item").first()).toContainText("لا جذر");
  await page.goto("/explore?set=places");
  await expect(page.locator(".set-quote")).toContainText("الشافية");
  await expect(page.getByRole("link", { name: "اعرضها خريطة" })).toHaveAttribute("href", /^\/graph\/seed\?s=/);
});

test("the study deck: Space turns the card, → keeps (learning and starred), ← skips, and the end card leads to review (COL-39…43)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the keys are a desktop affordance; swipe and the buttons do the same on phones");
  const set = await api<SetDetail>(page, "/collections/ilm");
  await page.goto("/explore?set=ilm");
  await page.getByRole("button", { name: "ادرسها بالبطاقات" }).click();
  const deck = page.getByRole("dialog", { name: /بطاقات/ });
  const card = deck.getByRole("button", { name: "اقلب البطاقة" });
  await expect(card).toContainText(set.items[0].ar.full);
  await expect(card).toBeFocused();
  await page.keyboard.press(" ");
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight");
  await expect(deck).toContainText(`${ar(2)} من ${ar(set.items.length)}`);
  const stored = await page.evaluate(() => ({ p: JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state, s: JSON.parse(localStorage.getItem("jadhr-saved") ?? "{}").state }));
  expect(stored.p.wordStates[set.items[0].slug]).toBe("learning");
  expect(stored.s.bookmarks.some((b: { kind: string; key: string }) => b.kind === "lemma" && b.key === set.items[0].slug)).toBe(true);
  for (let i = 1; i < set.items.length; i++) await page.keyboard.press("ArrowLeft");
  await expect(deck.getByRole("status")).toContainText(`احتفظت بـ${ar(1)} وتخطّيت ${ar(set.items.length - 1)}`);
  await expect(deck.getByRole("link", { name: "اذهب إلى المراجعة" })).toHaveAttribute("href", "/read?mode=review");
});

test("the deck's buttons do the same on a phone, and nothing overflows (COL-41, COL-49)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.goto("/explore?set=frequent");
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "ادرسها بالبطاقات" }).click();
  const deck = page.getByRole("dialog", { name: /بطاقات/ });
  await deck.getByRole("button", { name: "احتفظ", exact: true }).click();
  await expect(deck).toContainText(`${ar(2)} من`);
  await expectNoHorizontalScroll(page);
});

test("the loanword set lists al-Suyūṭī's whole-word claims with its source, and an unknown set says so", async ({ page }) => {
  const set = await api<SetDetail>(page, "/collections/loanwords");
  expect(set.items.map((x) => x.slug)).not.toContain("rahman");
  await page.goto("/explore?set=loanwords");
  await expect(page.locator(".set-item")).toHaveCount(set.items.length);
  await expect(page.locator("main")).toContainText("المصدر: السيوطي");
  await page.goto("/explore?set=nothing-here");
  await expect(page.getByRole("alert").filter({ hasText: "لم نجد" })).toHaveText("لم نجد هذه المجموعة.");
});
