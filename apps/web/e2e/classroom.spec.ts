import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { drop, person, tag } from "./board";

/**
 * The classroom (P9.1; CLS-01, 02, 26, Q01…Q03, Q07): an instructor makes a class and gives its link; a reader is told
 * what the instructor will see and what never, agrees and joins; the instructor adds a lesson of verses and roots,
 * which the member reads and takes away as a file; the file opens with no account; the member's own choice shows in
 * the roster; leaving takes them out. Real accounts through the development outbox.
 */

const axeIds = async (page: import("@playwright/test").Page, scope: string) =>
  (await new AxeBuilder({ page }).include(scope).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 3).join(" | ")}`);

test("a class made, joined by consent, given a lesson that travels as a file, and left (P9.1)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "two accounts in desktop windows; the pages' phone layout is read in screenshots");
  test.setTimeout(150_000);
  const t = tag();
  const teacher = await person(browser, `e2e-cls-t-${t}@example.org`, "instructor");
  const learner = await person(browser, `e2e-cls-l-${t}@example.org`);
  await teacher.page.request.patch("/api/v1/me", { headers: teacher.h, data: { display_name: `المعلمة ${t.slice(-4)}` } });
  await learner.page.request.patch("/api/v1/me", { headers: learner.h, data: { display_name: `الطالب ${t.slice(-4)}` } });
  try {
    // the instructor: a class, its link
    await teacher.page.goto("/classroom");
    await teacher.page.getByRole("textbox", { name: "اسم الصف" }).fill("حلقة الفجر");
    await teacher.page.getByRole("button", { name: "أنشئ الصف" }).click();
    await expect(teacher.page).toHaveURL(/\/classroom\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    const classUrl = new URL(teacher.page.url()).pathname;
    await expect(teacher.page.getByRole("heading", { level: 1 })).toContainText("حلقة الفجر");
    const link = await teacher.page.getByRole("textbox", { name: "رابط الانضمام" }).inputValue();
    expect(link).toMatch(/\/classroom\/join\/[a-z0-9]{10}$/);
    expect(await axeIds(teacher.page, "main")).toEqual([]);

    // the reader: told first, joins only by agreeing
    await learner.page.goto(new URL(link).pathname);
    await expect(learner.page.getByText("ما سيراه المعلم", { exact: true })).toBeVisible();
    await expect(learner.page.getByText("ما لن يراه أبدا", { exact: true })).toBeVisible();
    await expect(learner.page.getByText(/ولا يظهر عدد عن كلمة حتى يكون في الصف ٥ طلاب على الأقل/)).toBeVisible();
    const join = learner.page.getByRole("button", { name: "انضم", exact: true });
    await expect(join).toBeDisabled();
    expect(await axeIds(learner.page, "main")).toEqual([]);
    await learner.page.getByRole("checkbox", { name: /قرأت ما سيراه المعلم/ }).check();
    await join.click();
    await expect(learner.page).toHaveURL(new RegExp(`${classUrl}$`), { timeout: 15_000 });
    await expect(learner.page.getByText(/يعلّمه المعلمة/)).toBeVisible();

    // the instructor adds a lesson: al-Fātiḥa 1–7 and a root
    await teacher.page.reload();
    await expect(teacher.page.getByText("طالب واحد")).toBeVisible();
    await teacher.page.getByRole("textbox", { name: "عنوان الدرس" }).fill("الحمد في الفاتحة");
    await teacher.page.getByRole("textbox", { name: "الجذور (اختياري)" }).fill("ح م د");
    await teacher.page.getByRole("button", { name: "أضف الدرس" }).click();
    await expect(teacher.page.getByRole("status").filter({ hasText: "أضيف الدرس." })).toBeVisible();

    // the member reads it, and takes it away as a file
    await learner.page.reload();
    const row = learner.page.locator("li").filter({ hasText: "الحمد في الفاتحة" });
    await expect(row).toContainText("٧ آيات");
    await expect(row.getByRole("link", { name: "اقرأ الفاتحة ١–٧" })).toHaveAttribute("href", /\/quran\/1\/1$/);
    await expect(row.getByRole("link", { name: "ح م د" })).toBeVisible();
    const [download] = await Promise.all([learner.page.waitForEvent("download"), row.getByRole("button", { name: "نزّله ملفا" }).click()]);
    const file = Buffer.concat(await (await download.createReadStream()).toArray()).toString("utf8");
    const pack = JSON.parse(file) as { format: string; verses: string[]; roots: { key: string }[] };
    expect([pack.format, pack.verses.length, pack.roots.map((r) => r.key)]).toEqual(["jadhr-lesson-pack", 7, ["حمد"]]);
    expect(file).not.toContain("الطالب");

    // the file opens with no account, in a browser of its own
    const anon = await (await browser.newContext()).newPage();
    await anon.goto("/classroom");
    await anon.locator('input[type="file"]').setInputFiles({ name: "lesson.json", mimeType: "application/json", buffer: Buffer.from(file) });
    await expect(anon.getByRole("heading", { name: "الحمد في الفاتحة" })).toBeVisible();
    await expect(anon.getByRole("link", { name: "اقرأ الفاتحة ١–٧" })).toBeVisible();
    await anon.context().close();

    // the member's own choice, seen in the roster
    await learner.page.getByRole("checkbox", { name: /أظهر تفاصيلي للمعلم/ }).check();
    await expect(learner.page.getByRole("status").filter({ hasText: "تظهر تفاصيلك للمعلم الآن." })).toBeVisible();
    await teacher.page.reload();
    await expect(teacher.page.locator("li").filter({ hasText: "الطالب" })).toContainText("يظهر تفاصيله");
    expect(await axeIds(learner.page, "main")).toEqual([]);

    // leaving: out of the class, and out of the roster
    await learner.page.getByRole("button", { name: "غادر الصف" }).click();
    await learner.page.getByRole("button", { name: /انقر مرة أخرى: تغادر/ }).click();
    await expect(learner.page).toHaveURL(/\/classroom$/);
    await expect(learner.page.getByText("لم تنضم إلى صف.", { exact: false })).toBeVisible();
    await teacher.page.reload();
    await expect(teacher.page.getByText("لم ينضم أحد بعد.")).toBeVisible();
  } finally {
    await drop(teacher);
    await drop(learner);
  }
});

test("signed out, the classroom says what it is and opens a lesson file; a join link asks for a sign-in (P9.1)", async ({ page }) => {
  await page.goto("/classroom");
  await expect(page.getByRole("heading", { name: "الصف", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "ادخل" })).toHaveAttribute("href", /\/signin\?next=%2Fclassroom/);
  await page.locator('input[type="file"]').setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"format":"other"}') });
  await expect(page.getByRole("status").filter({ hasText: "ليس هذا ملف درس من جذر." })).toBeVisible();
  expect(await axeIds(page, "main")).toEqual([]);
  await page.goto("/classroom/join/abcdefghjk");
  await expect(page.getByRole("link", { name: "ادخل" })).toHaveAttribute("href", /next=%2Fclassroom%2Fjoin%2Fabcdefghjk/);
});
