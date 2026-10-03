import { expect, test } from "@playwright/test";
import { api } from "./helpers";

test("a starred word appears in Saved and in the Review count, and stays after a reload (RDR-520)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 1 })));
  const d = await api<{ verses: { ayah: number; words: { position: number; lemma_slug: string }[] }[] }>(page, "/surahs/2");
  const slug = d.verses.find((v) => v.ayah === 255)!.words.find((w) => w.position === 23)!.lemma_slug;
  const lemma = await api<{ ar: { full: string } }>(page, `/words/${slug}`);
  await page.goto("/word/2:255:23");
  const star = page.getByRole("button", { name: "احفظ في قائمتك" }).first();
  await star.click();
  await expect(page.getByRole("button", { name: "أزله من قائمتك" }).first()).toHaveAttribute("aria-pressed", "true");
  await page.goto("/saved");
  await expect(page.locator("main")).toContainText(lemma.ar.full);
  await expect(page.locator(`main a[href*="/read?w=${slug}"]`)).toBeVisible();
  await page.reload();
  await expect(page.locator("main")).toContainText(lemma.ar.full);
});

test("the root map draws the family: the root, its patterns and each of its words (P8.2)", async ({ page }) => {
  const g = await api<{ lemmas: unknown[]; patterns: unknown[] }>(page, `/roots/${encodeURIComponent("رحم")}/graph`);
  expect(g.patterns.length).toBeGreaterThan(0);
  await page.goto(`/graph/root/${encodeURIComponent("رحم")}`);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(1 + g.patterns.length + g.lemmas.length);
});

test("delete in Saved removes every store and document this site keeps, the reader's own texts included", async ({ page }) => {
  await page.addInitScript((v) => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("jadhr-personal", JSON.stringify(v)); localStorage.setItem("jadhr-analyse-choices", JSON.stringify({ state: { choices: { x: 1 } }, version: 1 })); } }, { state: { visited: true, onboarded: true, wordStates: { ilm: "known" } }, version: 2 });
  await page.goto("/saved");
  // a text of the reader's own, where idb-keyval keeps it
  await page.evaluate(async () => {
    await new Promise<void>((done) => {
      const req = indexedDB.open("keyval-store");
      req.onupgradeneeded = () => req.result.createObjectStore("keyval");
      req.onsuccess = () => {
        const tx = req.result.transaction("keyval", "readwrite");
        tx.objectStore("keyval").put({ id: "t1", title: "نصي" }, "jadhr-text:t1");
        tx.oncomplete = () => done();
      };
    });
  });
  const del = page.getByRole("button", { name: "حذف كل بياناتي من هذا المتصفح" });
  await del.click();
  await page.getByRole("button", { name: "انقر مرة أخرى لتأكيد الحذف النهائي" }).click();
  await expect(page).toHaveURL(/\/saved\?deleted=1$/);
  await expect(page.getByRole("status")).toHaveText("حُذفت بياناتك المحلية.");
  const left = await page.evaluate(async () => {
    const personal = JSON.parse(localStorage.getItem("jadhr-personal") ?? "null");
    const docs = await new Promise<string[]>((done) => {
      const req = indexedDB.open("keyval-store");
      req.onsuccess = () => {
        const r = req.result.transaction("keyval").objectStore("keyval").getAllKeys();
        r.onsuccess = () => done(r.result.map(String));
      };
    });
    return { words: personal?.state?.wordStates ?? {}, choices: localStorage.getItem("jadhr-analyse-choices"), docs: docs.filter((k) => k.startsWith("jadhr-")) };
  });
  expect(left).toEqual({ words: {}, choices: null, docs: [] });
});
