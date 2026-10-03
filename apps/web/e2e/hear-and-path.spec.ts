import { expect, test } from "@playwright/test";
import { api, ar, expectNoHorizontalScroll } from "./helpers";

/** Two proposals placed in P5 (PLAN §8): B4 "Hear the root" — every occurrence, slice after slice — and B5 a path
 * through the Quran's words by frequency, studied like a set and feeding the review. */

type Hear = { items: { location: string; verse_key: string; surface: string; audio: { url: string; start_ms: number } }[]; untimed: number; total: number };
type Path = { lessons: { n: number; roots: { spaced: string }[]; coverage: number; cumulative: number }[] };
type Lesson = { n: number; of: number; items: { slug: string; ar: { full: string } }[] };
const pct = (x: number) => new Intl.NumberFormat("ar-EG", { style: "percent", maximumFractionDigits: 1 }).format(x);

test.beforeEach(async ({ page }) => {
  // the recitations come from the recitation server; the test asks nothing of it
  await page.route("https://everyayah.com/**", (r) => r.fulfill({ status: 200, contentType: "audio/mpeg", body: "" }));
});

test("hear the root: every occurrence in the mushaf's order, each its own slice, stepped and stopped (B4)", async ({ page, isMobile }) => {
  const h = await api<Hear>(page, `/hear?root=${encodeURIComponent("علم")}`);
  await page.goto(`/roots/${encodeURIComponent("علم")}`);
  await page.getByRole("button", { name: "استمع إلى العائلة في القرآن كله" }).click();
  const player = page.getByRole("region", { name: "الاستماع إلى المواضع" });
  await expect(player).toContainText(`${ar(1)} من ${ar(h.items.length)}`);
  await expect(player).toContainText(h.items[0].surface);
  const el = page.locator("audio");
  await expect(el).toHaveAttribute("data-mode", "playlist");
  await expect(el).toHaveAttribute("data-src", h.items[0].audio.url);
  await player.getByRole("button", { name: "الموضع التالي" }).click();
  await expect(player).toContainText(`${ar(2)} من ${ar(h.items.length)}`);
  await expect(player).toContainText(h.items[1].surface);
  // the untimed are counted, not dropped silently
  if (h.untimed > 0) await expect(player).toContainText("بلا توقيت");
  if (isMobile) await expectNoHorizontalScroll(page);
  await player.getByRole("button", { name: "أوقف الاستماع" }).click();
  await expect(player).toHaveCount(0);
});
