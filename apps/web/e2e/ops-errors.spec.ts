import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { drop, person, sql, tag } from "./board";

/**
 * What went wrong, on a page of the board's (B61, PLAN P12): the error counts of the last days by kind and place, for
 * the board's administrators only — a reader is told who it is for, an editor too — linked from the workbench.
 */

test("the board's administrators read what went wrong; anyone else is told who it is for (B61)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "the page is the same on the phone; its layout is checked at 390 px in the axe step below");
  test.setTimeout(180_000); // two people signed in, and the page read at two widths in two themes
  const t = tag();
  const mark = `TypeError e2e ${t.replace(/[0-9]/g, (d) => "abcdefghij"[Number(d)])}`;
  const admin = await person(browser, `e2e-ops-admin-${t}@example.org`, "admin");
  const editor = await person(browser, `e2e-ops-editor-${t}@example.org`, "editor");
  try {
    // an error a page met, as a page reports it
    expect((await admin.page.request.post("/api/v1/ops/errors", { data: { kind: "TypeError", message: mark, place: "/quran/2?w=ilm", release: "2026.10.0" } })).status()).toBe(204);

    await editor.page.goto("/workbench/errors");
    await expect(editor.page.getByRole("heading", { level: 1 })).toHaveText("ما تعطّل");
    await expect(editor.page.getByText("هذه الصفحة لمديري هيئة التحرير.")).toBeVisible();

    await admin.page.goto("/workbench");
    await admin.page.getByRole("link", { name: "ما تعطّل" }).click();
    await expect(admin.page).toHaveURL(/\/workbench\/errors$/);
    const period = admin.page.getByRole("group", { name: "المدة" });
    await period.getByRole("button", { name: "اليوم" }).click();
    await expect(period.getByRole("button", { name: "اليوم" })).toHaveAttribute("aria-pressed", "true");
    const row = admin.page.locator("li").filter({ hasText: mark });
    await expect(row).toHaveCount(1);
    // the page's path without its query, the release, how often
    await expect(row).toContainText("/quran/2");
    await expect(row).not.toContainText("w=ilm");
    await expect(row).toContainText("الإصدار 2026.10.0");
    await expect(admin.page.getByRole("status")).toContainText("الصفحات:");

    for (const [width, theme] of [[1440, "light"], [1440, "dark"], [390, "light"], [390, "dark"]] as const) {
      await admin.page.setViewportSize({ width, height: 900 });
      await admin.page.evaluate((th) => localStorage.setItem("jadhr-theme", th), theme);
      await admin.page.reload();
      await expect(admin.page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(admin.page.locator("li").filter({ hasText: mark })).toHaveCount(1);
      const results = await new AxeBuilder({ page: admin.page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`), `${width} ${theme}`).toEqual([]);
      expect(await admin.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width} no sideways scroll`).toBe(true);
    }
  } finally {
    sql(`delete from ops.errors where message = '${mark}'`);
    await drop(admin);
    await drop(editor);
  }
});

test("signed out, the page asks for a sign-in (B61)", async ({ page }) => {
  await page.goto("/workbench/errors");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ما تعطّل");
  await expect(page.getByRole("link", { name: "دخول" }).last()).toHaveAttribute("href", "/signin?next=/workbench/errors");
});
