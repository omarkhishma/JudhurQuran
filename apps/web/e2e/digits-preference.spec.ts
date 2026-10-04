import { expect, type Page, test } from "@playwright/test";

/**
 * The digits preference (SHL-Q05, Q10): by the language, or ١٢٣ or 123 on every page — set in the profile or the
 * reader's preferences, kept in this browser, on before the page paints, the text itself unchanged. The shapes are
 * compared as drawn: the chosen digits drawn by the swap face equal the other digits drawn by the interface's font.
 */

/** Draw `a` in the swap face and `b` in the interface's own face; true when the two drawings are identical. */
async function drawnAlike(page: Page, swap: string, a: string, b: string): Promise<boolean> {
  return page.evaluate(
    async ([swap, a, b]) => {
      await document.fonts.load(`32px "${swap}"`, a);
      const ui = getComputedStyle(document.documentElement).getPropertyValue("--font-plex-arabic").trim();
      await document.fonts.load(`32px ${ui}`, b);
      const draw = (font: string, s: string) => {
        const c = document.createElement("canvas");
        c.width = 200;
        c.height = 60;
        const x = c.getContext("2d")!;
        x.font = `32px ${font}`;
        x.fillText(s, 10, 45);
        return Array.from(x.getImageData(0, 0, 200, 60).data).join(",");
      };
      const one = draw(`"${swap}"`, a);
      return one === draw(ui, b) && one !== draw(ui, a);
    },
    [swap, a, b] as const,
  );
}

test("Western digits on every page of the Arabic interface, chosen in the profile, kept, on before paint (SHL-Q05)", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 }));
  });
  await page.goto("/me");
  const pref = page.getByRole("group", { name: "الأرقام" }).first();
  await expect(pref.getByRole("button", { name: /حسب لغة الواجهة/ })).toHaveAttribute("aria-pressed", "true");
  await pref.getByRole("button", { name: /الأرقام العربية الغربية/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-digits", "latin");
  // the Arabic-Indic digits the page writes are drawn as 123, by a face made of the interface's own Western digits
  expect(await drawnAlike(page, "Jadhr Latin Digits", "٢٥٥", "255")).toBe(true);
  // another page, from the server: set before it paints, the text unchanged
  const html = await (await page.request.get("/quran/1")).text();
  expect(html).not.toContain('data-digits="latin"');
  await page.goto("/quran/1");
  await expect(page.locator("html")).toHaveAttribute("data-digits", "latin");
  const count = page.locator(".reader-meta, header").getByText(/[٠-٩]/).first();
  await expect(count).toBeVisible();
  expect(await count.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"Jadhr Latin Digits"/);
  // the mushaf's own numbers keep its font
  const word = page.locator('.w[data-w="1:1:1"]');
  expect(await word.evaluate((el) => getComputedStyle(el).fontFamily)).not.toMatch(/Jadhr/);
  // back to the language's digits
  await page.goto("/me");
  await page.getByRole("group", { name: "الأرقام" }).first().getByRole("button", { name: /حسب لغة الواجهة/ }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-digits", /./);
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-digits", /./);
});

test("Arabic-Indic digits in the English interface, from the reader's preferences; samples and fields drawn as written (SHL-Q05)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the Reading popover opens from the ⋯ menu on phones; the profile's control is the same");
  await page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 }));
  });
  await page.goto("/en/quran/1");
  await page.getByRole("button", { name: "Reading", exact: true }).click();
  const dlg = page.getByRole("dialog", { name: "Reading preferences" });
  await dlg.getByRole("button", { name: /Arabic-Indic digits/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-digits", "arabic");
  expect(await drawnAlike(page, "Jadhr Arabic Digits", "255", "٢٥٥")).toBe(true);
  // the samples of the choice read as written
  expect(await dlg.getByRole("button", { name: /Western digits/ }).evaluate((el) => getComputedStyle(el).fontFamily)).not.toMatch(/Jadhr/);
  // and so does a field the reader types in
  expect(await page.locator("input").first().evaluate((el) => getComputedStyle(el).fontFamily)).not.toMatch(/Jadhr/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-digits", "arabic");
});
