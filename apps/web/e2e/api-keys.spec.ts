import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { drop, person, tag } from "./board";

/**
 * Keys for the public API (P10.2b): made on the Profile, shown once, used on the public API at the key's own limit,
 * revoked there and then refused; the limits said as the API states them.
 */
test("an API key made on the Profile, shown once, used, and revoked (P10.2b)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "the account's phone layout is checked in profile.spec");
  const me = await person(browser, `e2e-keys-${tag()}@example.org`);
  const page = me.page;
  try {
    await page.goto("/me?tab=account");
    const card = page.getByRole("region", { name: "مفاتيح الواجهة البرمجية" });
    await expect(card).toContainText("بحد ١٢٠ طلبا في الدقيقة لكل عنوان");
    await expect(card).toContainText("لا مفاتيح بعد.");
    await card.getByRole("textbox", { name: "اسم المفتاح: ما الذي سيستعمله؟" }).fill("سكربت الفهرس");
    await card.getByRole("button", { name: "أنشئ مفتاحا" }).click();
    const value = card.getByRole("textbox", { name: "المفتاح", exact: true });
    await expect(value).toHaveValue(/^jk_[A-Za-z0-9_-]{32}$/);
    const key = await value.inputValue();
    await expect(card.locator(".account-row")).toContainText(key.slice(0, 10));
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations.map((v) => v.id)).toEqual([]);
    // the key reads at its own limit
    const ok = await page.request.get("/api/v1/public/quran/roots/علم", { headers: { "X-API-Key": key } });
    expect([ok.status(), ok.headers()["ratelimit-limit"]]).toEqual([200, "600"]);
    // shown once: gone after a reload
    await page.reload();
    await expect(card.getByRole("textbox", { name: "المفتاح", exact: true })).toHaveCount(0);
    await expect(card.locator(".account-row")).toContainText("آخر استعمال");
    // revoked in two steps, then refused
    await card.getByRole("button", { name: "ألغ المفتاح سكربت الفهرس" }).click();
    await card.getByRole("button", { name: "انقر مرة أخرى: يتوقف المفتاح" }).click();
    await expect(card.locator(".account-row")).toContainText("ملغى");
    const refused = await page.request.get("/api/v1/public/quran/roots/علم?x=1", { headers: { "X-API-Key": key } });
    expect(refused.status()).toBe(401);
  } finally {
    await drop(me);
  }
});
