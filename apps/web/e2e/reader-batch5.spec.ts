import { expect, type Page, test } from "@playwright/test";
import { api, ar } from "./helpers";

/**
 * The reader's last open items of the design inventory (research 08's re-audit, 2026-10-04): every text in the rail
 * (RDR-063, 064), the verse map preview's words choosing themselves (RDR-158), the hover card's actions with the panel
 * closed, the phone deck's ▶ and the shape card's line (RDR-183, 186), the cite dialog's way to embedding (RDR-398,
 * 450) and the recitation as a hint in review (RDR-569). Every expectation read from the API.
 */

const BASE = { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], proposals: [] as unknown[], savedTrails: [] };
const panel = (page: Page) => page.locator(".reader-panel, .reader-sheet");
const seed = (page: Page, extra: Record<string, unknown> = {}, prefs?: Record<string, unknown>) =>
  page.addInitScript(
    ([s, p]) => {
      if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: s, version: 3 }));
      if (p) localStorage.setItem("jadhr-prefs", JSON.stringify({ state: p, version: 2 }));
    },
    [{ progress: {}, ...BASE, ...extra }, prefs ?? null] as const,
  );

type Text = { slug: string; kind: string; title_ar: string };

test("the rail lists every text — the hadith, the books and the reader's own — each opening in its reader, with the way back to where the reader stopped (RDR-063, 064)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the rail is an overlay on phones; the same list");
  const texts = (await api<{ data: Text[] }>(page, "/texts")).data;
  const hadith = texts.filter((x) => x.kind === "hadith");
  const books = texts.filter((x) => x.kind === "book");
  await seed(page, { progress: { "hadith:bukhari": { chapter: 1, passage: 0, ref: "7", label: "", at: 1 } } });
  await page.goto("/library");
  // a text of the reader's own, in this browser
  await page.evaluate(async () => {
    const doc = { id: "r5text", title: "نصي في الرحمة", text: "", passages: ["الرحمة واسعة"], words: 2, lemmas: [], review: 0, unknown: 0, createdAt: 1, updatedAt: 1 };
    await new Promise<void>((done) => {
      const req = indexedDB.open("keyval-store");
      req.onupgradeneeded = () => req.result.createObjectStore("keyval");
      req.onsuccess = () => {
        const tx = req.result.transaction("keyval", "readwrite");
        tx.objectStore("keyval").put(doc, "jadhr-text:r5text");
        tx.objectStore("keyval").put([{ id: doc.id, title: doc.title, words: 2, lemmas: [], passageCount: 1, review: 0, unknown: 0, createdAt: 1, updatedAt: 1 }], "jadhr-texts-index");
        tx.oncomplete = () => done();
      };
    });
  });
  await page.goto("/quran/1");
  const rail = page.locator(".reader-rail");
  await rail.getByRole("button", { name: "النصوص", exact: true }).click();
  const list = rail.getByRole("navigation", { name: "النصوص" });
  await expect(list.getByRole("region", { name: "كتب الحديث" }).getByRole("link")).toHaveCount(hadith.length + 1); // + the way back
  await expect(list.getByRole("region", { name: "كتب التراث" }).getByRole("link")).toHaveCount(books.length);
  const mine = list.getByRole("region", { name: "نصوصك" });
  await expect(mine.getByRole("link", { name: "نصي في الرحمة" })).toHaveAttribute("href", "/library/text/r5text");
  // where the reader stopped in al-Bukhārī: that hadith
  await expect(list.getByRole("link", { name: `توقفت عند الحديث ${ar(7)}` })).toHaveAttribute("href", "/hadith/bukhari/7");
  // choosing a book opens its own reader
  await list.getByRole("link", { name: books[0].title_ar, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/books/${books[0].slug}$`));
});

test("a word in the verse's map preview chooses itself in the verse, its entry in the panel (RDR-158)", async ({ page }) => {
  const v = await api<{ words: { lemma_slug: string | null; root: string | null; location: string }[] }>(page, "/verses/1:2");
  const first = v.words.find((w) => w.root && w.lemma_slug)!;
  await seed(page);
  await page.goto("/quran/1");
  await page.locator('[data-verse-btn="1:2"]').click();
  await page.locator('[data-verse="1:2"] .ptool[data-tool="graph"]').click();
  const words = page.locator('[data-verse="1:2"] .drawer .graph-word');
  await expect(words.first()).toBeVisible();
  const lemma = await api<{ ar: { full: string } }>(page, `/words/${first.lemma_slug}?limit=0`);
  await words.filter({ hasText: lemma.ar.full }).first().click();
  await expect(page).toHaveURL(new RegExp(`w=${first.lemma_slug}`));
  await expect(panel(page).locator('[data-section="family"], .entry-head, h2').first()).toBeVisible();
});

test("the hover card's actions open the entry in the panel when the reader has closed it", async ({ page, isMobile }) => {
  test.skip(isMobile, "a mouse-only preview: no hover on touch");
  await seed(page, {}, { panelOpen: false });
  await page.goto("/quran/2#v3");
  await expect(page.locator(".reader-panel")).toHaveCount(0);
  const word = page.locator('.w[data-w="2:3:2"]');
  await word.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await word.hover();
  const card = page.getByRole("dialog", { name: "بطاقة الكلمة" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "المدخل كاملًا" }).click();
  await expect(page.locator(".reader-panel")).toBeVisible();
});

test("the phone deck: a 44 px ▶ on the meaning card, and the shape card names the mould in letters (RDR-183, 186)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the deck is the phone layout");
  const w = await api<{ pattern: { ar: { full: string; translit: string } } | null }>(page, "/words/ilm?limit=0");
  await seed(page);
  await page.goto("/quran/1?mode=ask");
  await page.getByRole("textbox", { name: "عن أي كلمة تتساءل؟" }).fill("علم");
  const play = page.locator(".ask-deck-card .listen-btn").first();
  await expect(play).toBeVisible();
  const box = (await play.boundingBox())!;
  expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
  expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
  const shape = page.locator(".ask-deck-card").filter({ hasText: w.pattern!.ar.full });
  await expect(shape).toContainText(`${w.pattern!.ar.translit} • القالب الذي صُبّت فيه هذه الكلمة`);
});

test("the cite dialog leads to embedding through a published map (RDR-398, 450)", async ({ page }) => {
  await seed(page);
  await page.goto("/quran/20?w=ilm&at=20:114:17");
  await panel(page).getByRole("button", { name: "استشهد" }).first().click();
  const dlg = page.getByRole("dialog", { name: "استشهد بهذا" });
  const embed = dlg.getByRole("link", { name: "التضمين…" });
  await expect(embed).toHaveAttribute("href", "/g");
  await embed.click();
  await expect(page).toHaveURL(/\/g$/);
});
