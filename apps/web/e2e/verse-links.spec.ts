import { expect, type Page, test } from "@playwright/test";
import { api, ar } from "./helpers";

/** The reader's own verse links and topics (RDR-142, 145…147, 156, 157, 432, 483, 484, 555). */

const RETURNING = { state: { visited: true, onboarded: true, wordStates: {}, stars: {}, trail: [], progress: {}, proposals: [], savedTrails: [] }, version: 1 };
const personal = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state);

test.beforeEach(async ({ page }) => {
  // seed once: the script runs again on every navigation, and must not wipe what the test stored
  await page.addInitScript((r) => localStorage.getItem("jadhr-personal") || localStorage.setItem("jadhr-personal", JSON.stringify(r)), RETURNING);
});

test("a verse linked by its number shows a mark under it, the other verse shows it as incoming, and it can be undone", async ({ page }) => {
  await page.goto("/quran/1");
  await page.locator('[data-verse-btn="1:2"]').click();
  await page.locator('[data-verse="1:2"] [data-tool="links"]').click();
  const drawer = page.locator('[data-verse="1:2"] .drawer');
  await expect(drawer).toContainText("لم تربط هذه الآية");
  await drawer.getByRole("textbox", { name: /اربط بآية/ }).fill("٢:٢٥٥");
  await drawer.getByRole("button", { name: "اربط", exact: true }).click();
  await expect(drawer.locator(".link-row")).toHaveCount(1);
  await expect(drawer.locator(".link-row")).toContainText("٢:٢٥٥");
  // a number that is no verse is refused
  await drawer.getByRole("textbox", { name: /اربط بآية/ }).fill("٢:٩٩٩");
  await drawer.getByRole("button", { name: "اربط", exact: true }).click();
  await expect(drawer.getByRole("alert")).toContainText("لا آية بهذا الرقم");
  // stored with its text, so it never collides across texts (RDR-432)
  expect((await personal(page)).links).toEqual({ "quran:1:2": ["quran:2:255"] });
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-note="1:2"] .mark')).toHaveText("رابط واحد");
  await page.locator('[data-verse-btn="1:2"]').click();
  await expect(page.locator('[data-verse="1:2"] [data-tool="links"] .ptool-badge')).toHaveText(ar(1));

  // the other side
  await page.goto("/quran/2#v255");
  await page.locator('[data-verse-btn="2:255"]').click();
  await page.locator('[data-verse="2:255"] [data-tool="links"]').click();
  const other = page.locator('[data-verse="2:255"] .drawer');
  await expect(other).toContainText("آيات ربطتها بهذه");
  await expect(other.locator(".link-row")).toContainText("١:٢");

  // undo from the first verse
  await page.goto("/quran/1");
  await page.locator('[data-note="1:2"] .mark').click();
  await page.locator('[data-verse="1:2"] .drawer').getByRole("button", { name: "فكّ الربط" }).click();
  expect((await personal(page)).links).toEqual({});
  await expect(page.locator('[data-note="1:2"] .mark')).toHaveCount(0);
});

test("a topic of the reader's own gathers verses and shows under each", async ({ page }) => {
  await page.goto("/quran/1");
  await page.locator('[data-verse-btn="1:2"]').click();
  await page.locator('[data-verse="1:2"] [data-tool="topic"]').click();
  const drawer = page.locator('[data-verse="1:2"] .drawer');
  await expect(drawer).toContainText("لا مواضيع لك بعد");
  await drawer.getByRole("textbox", { name: "موضوع جديد" }).fill("الحمد");
  await drawer.getByRole("button", { name: "أضف" }).click();
  await expect(drawer.getByRole("button", { name: "الحمد" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-note="1:2"] .mark')).toHaveText("موضوع · الحمد");
  // the same topic offered on another verse
  await page.locator('[data-verse-btn="1:3"]').click();
  await page.locator('[data-verse="1:3"] [data-tool="topic"]').click();
  await page.locator('[data-verse="1:3"] .drawer').getByRole("button", { name: "الحمد" }).click();
  const st = await personal(page);
  expect(st.topics).toHaveLength(1);
  expect(st.verseTopics).toEqual({ "quran:1:2": [st.topics[0].id], "quran:1:3": [st.topics[0].id] });
  await page.reload();
  await expect(page.locator('[data-note="1:3"] .mark')).toHaveText("موضوع · الحمد");
});

test("the Roots tool counts the verse's distinct roots (RDR-145)", async ({ page }) => {
  const v = await api<{ words: { root: string | null }[] }>(page, "/verses/2:255");
  await page.goto("/quran/2#v255");
  await expect(page.locator('[data-verse="2:255"] [data-tool="roots"] .ptool-badge')).toHaveText(ar(new Set(v.words.map((w) => w.root).filter(Boolean)).size));
});
