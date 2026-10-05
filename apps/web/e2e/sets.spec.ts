import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { drop, person, tag } from "./board";

/**
 * Sets a reader or a teacher makes (B29): a rule, never a list — the words it yields read from the data as it is
 * written and each time it is opened; a reader's kept in their browser, edited and deleted; a teacher's for a class,
 * read by its members on the class's page and in Explore. Every expectation read from the API.
 */

type Evaluated = { item_count: number; items: { slug: string; ar: { full: string }; in_surah?: number }[] };

const evaluate = async (page: Page, rule: object) => {
  const r = await page.request.post("/api/v1/sets/evaluate", { data: { rule } });
  expect(r.ok()).toBeTruthy();
  return (await r.json()) as Evaluated;
};

const seed = (page: Page) =>
  page.addInitScript(() => {
    if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 3 }));
  });

test("a reader makes a set by a rule, sees what it yields, keeps it, edits and deletes it (B29)", async ({ page }) => {
  await seed(page);
  const rule = { frequent: true, surah: 36, limit: 10 };
  const expected = await evaluate(page, rule);
  await page.goto("/explore");
  const mine = page.getByRole("region", { name: "مجموعاتي" });
  await mine.getByRole("button", { name: "مجموعة جديدة" }).click();
  await mine.getByRole("textbox", { name: "اسم المجموعة" }).fill("كلمات يس");
  await mine.getByRole("group", { name: "تُجمع كلماتها من" }).getByRole("button", { name: "الأكثر ورودًا" }).click();
  await mine.getByRole("combobox", { name: "في" }).selectOption("36");
  await mine.getByRole("spinbutton", { name: /عدد الكلمات/ }).fill("10");
  // what the rule yields, as it is written
  const preview = mine.getByRole("region", { name: "ما تعطيه القاعدة" });
  await expect(preview).toContainText(expected.items[0].ar.full);
  await expect(preview).toContainText(`من كلمات سورة يس`);
  await mine.getByRole("button", { name: "احفظ المجموعة" }).click();
  await expect(page).toHaveURL(/\/explore\?mine=s\d+$/);
  await expect(page.getByRole("heading", { level: 2, name: "كلمات يس" })).toBeVisible();
  await expect(page.locator(".set-items > li")).toHaveCount(expected.item_count);
  await expect(page.locator(".set-items > li").first()).toContainText(expected.items[0].ar.full);
  // each word with how often it stands in the sūra, the set's order
  await expect(page.locator(".set-items > li").first()).toContainText(`${new Intl.NumberFormat("ar-EG").format(expected.items[0].in_surah!)} في السورة`);
  await expect(page.locator(".set-view")).toContainText("أكثر كلمات المعنى ورودًا في سورة يس");
  // kept in this browser: there after a reload, and on the list
  await page.reload();
  await expect(page.locator(".set-items > li")).toHaveCount(expected.item_count);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state.sets);
  expect(kept).toEqual([expect.objectContaining({ title: "كلمات يس", rule })]);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  // edited: another rule, the words read again
  await page.getByRole("button", { name: "عدّل" }).click();
  await page.getByRole("group", { name: "تُجمع كلماتها من" }).getByRole("button", { name: "جذور" }).click();
  await page.getByRole("textbox", { name: /الجذور/ }).fill("ع ل م، ك ت ب");
  const roots = await evaluate(page, { root: ["علم", "كتب"], surah: 36, limit: 10 });
  await expect(page.getByRole("region", { name: "ما تعطيه القاعدة" })).toContainText(roots.items[0].ar.full);
  await page.getByRole("button", { name: "احفظ المجموعة" }).click();
  await expect(page.locator(".set-items > li")).toHaveCount(roots.item_count);
  // a root not in the Quran is said so, and nothing is saved
  await page.getByRole("button", { name: "عدّل" }).click();
  await page.getByRole("textbox", { name: /الجذور/ }).fill("ق ق ق");
  await expect(page.locator(".set-builder").getByRole("alert")).toContainText("أحد الجذور التي كتبتها ليس في القرآن.");
  await expect(page.getByRole("button", { name: "احفظ المجموعة" })).toBeDisabled();
  await page.getByRole("button", { name: "تراجع" }).click();
  // deleted, after asking
  await page.getByRole("button", { name: "احذف", exact: true }).click();
  await page.getByRole("button", { name: "احذفها نهائيًا" }).click();
  await expect(page).toHaveURL(/\/explore#explore-mine$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "{}").state.sets)).toEqual([]);
});

test("a teacher makes a set for a class; its members read it there and in Explore (B29)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "two accounts in desktop windows; the builder is read at 390 px in the reader's test");
  test.setTimeout(150_000);
  const t = tag();
  const teacher = await person(browser, `e2e-sets-t-${t}@example.org`, "instructor");
  const learner = await person(browser, `e2e-sets-l-${t}@example.org`);
  try {
    const c = (await (await teacher.page.request.post("/api/v1/classroom/classes", { headers: teacher.h, data: { name: "حلقة الجذور" } })).json()) as { id: string; join_code: string };
    await learner.page.request.post(`/api/v1/classroom/join/${c.join_code}`, { headers: learner.h, data: { consent: "2026-10-04" } });
    const expected = await evaluate(teacher.page, { root: ["رحم"] });
    await teacher.page.goto(`/classroom/${c.id}`);
    const sets = teacher.page.getByRole("region", { name: "مجموعات الكلمات" });
    await sets.getByRole("button", { name: "مجموعة جديدة" }).click();
    await sets.getByRole("textbox", { name: "اسم المجموعة" }).fill("أسرة الرحمة");
    await sets.getByRole("textbox", { name: /الجذور/ }).fill("ر ح م");
    await expect(sets.getByRole("region", { name: "ما تعطيه القاعدة" })).toContainText(expected.items[0].ar.full);
    await sets.getByRole("button", { name: "أضفها إلى الفصل" }).click();
    await expect(sets.getByRole("link", { name: /أسرة الرحمة/ })).toBeVisible();

    // the member: on the class's page, in Explore, and the set itself with its words
    await learner.page.goto(`/classroom/${c.id}`);
    await expect(learner.page.getByRole("region", { name: "مجموعات الكلمات" }).getByRole("link", { name: /أسرة الرحمة/ })).toBeVisible();
    await expect(learner.page.getByRole("region", { name: "مجموعات الكلمات" }).getByRole("button", { name: "مجموعة جديدة" })).toHaveCount(0);
    await learner.page.goto("/explore");
    const fromClasses = learner.page.getByRole("region", { name: "مجموعات فصولك" });
    await expect(fromClasses).toContainText("فصل حلقة الجذور");
    await fromClasses.getByRole("link", { name: /أسرة الرحمة/ }).click();
    await expect(learner.page).toHaveURL(/\/explore\?cset=[0-9a-f-]{36}$/);
    await expect(learner.page.locator(".set-items > li")).toHaveCount(expected.item_count);
    await expect(learner.page.locator(".set-view")).toContainText(`كلمات الجذور: ${["ر", "ح", "م"].join(" ")}`);
    await expect(learner.page.getByRole("button", { name: "احذف", exact: true })).toHaveCount(0);
    // why it holds these words: the class's set, by a rule
    await expect(learner.page.locator(".set-side")).toContainText("مجموعة لفصل «حلقة الجذور» بقاعدة");
  } finally {
    await drop(teacher);
    await drop(learner);
  }
});
