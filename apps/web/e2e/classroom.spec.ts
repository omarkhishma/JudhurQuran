import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { drop, person, sql, tag } from "./board";

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
    // a refusal is said in the reader's language, never the API's English: al-Baqara whole and Āl ʿImrān whole are
    // more verses than a lesson holds
    await teacher.page.getByRole("textbox", { name: "عنوان الدرس" }).fill("أكثر مما يحمل درس");
    await teacher.page.getByRole("combobox", { name: "السورة" }).selectOption("2");
    await teacher.page.getByRole("button", { name: "+ مقطع آخر" }).click();
    await teacher.page.getByRole("combobox", { name: "السورة" }).nth(1).selectOption("3");
    await teacher.page.getByRole("button", { name: "أضف الدرس" }).click();
    await expect(teacher.page.getByRole("status").filter({ hasText: "راجع الآيات: من مقطع إلى عشرة، وثلاثمئة آية على الأكثر." })).toBeVisible();
    await expect(teacher.page.getByText(/three hundred|422/)).toHaveCount(0);
    await teacher.page.getByRole("button", { name: "احذف هذا المقطع" }).nth(1).click();
    await teacher.page.getByRole("combobox", { name: "السورة" }).selectOption("1");
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

test("a member's reader says when its reading counts for a lesson, and sends only counts for the lesson's verses (P9.2a)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "two accounts in desktop windows");
  test.setTimeout(150_000);
  const t = tag();
  const teacher = await person(browser, `e2e-sig-t-${t}@example.org`, "instructor");
  const learner = await person(browser, `e2e-sig-l-${t}@example.org`);
  try {
    const c = (await (await teacher.page.request.post("/api/v1/classroom/classes", { headers: teacher.h, data: { name: "حلقة" } })).json()) as { id: string; join_code: string };
    await learner.page.request.post(`/api/v1/classroom/join/${c.join_code}`, { headers: learner.h, data: { consent: "2026-10-04" } });
    const lesson = (await (await teacher.page.request.post(`/api/v1/classroom/classes/${c.id}/lessons`, { headers: teacher.h, data: { title: "مطلع الفاتحة", ranges: [{ surah: 1, from: 1, to: 4 }] } })).json()) as { id: string };
    const held = () => sql(`select location, kind, n from classroom.counts where lesson_id = '${lesson.id}' order by location, kind`);

    // the reader says so on the lesson's verses
    await learner.page.goto("/quran/1");
    const strip = learner.page.locator(".lesson-strip");
    await expect(strip).toContainText("مطلع الفاتحة");
    await expect(strip).toContainText("لا نصوصها");
    // a word looked up, and a note on a verse: counted, sent when the page is left
    await learner.page.locator('.w[data-w="1:2:3"]').click();
    // a lookup is the word's entry read: waited for before moving on
    await expect.poll(() => learner.page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "null")?.state?.context?.at), { timeout: 15_000 }).toBe("1:2:3");
    await learner.page.locator('[data-verse-btn="1:3"]').click();
    await learner.page.locator('[data-verse="1:3"] .ptool[data-tool="note"]').click();
    await learner.page.locator('[data-verse="1:3"] textarea').fill("رحمة تسع كل شيء");
    await learner.page.locator('[data-verse="1:3"]').getByRole("button", { name: "احفظ الملاحظة" }).click();
    // a word outside the lesson: nothing counted, nothing said
    await learner.page.goto("/quran/2");
    await expect(learner.page.locator(".lesson-strip")).toHaveCount(0);
    await learner.page.locator('.w[data-w="2:2:1"]').click();
    await learner.page.goto("/classroom");
    await expect.poll(held, { timeout: 15_000 }).toEqual(["1:2:3\tlookup\t1", "1:3:0\tnote\t1"]);
    // the note's words never left the browser
    expect(sql(`select count(*) from classroom.counts where lesson_id = '${lesson.id}' and location like '2:%'`)).toEqual(["0"]);

    // finished by the member's word, from the class's page
    await learner.page.goto(`/classroom/${c.id}`);
    await learner.page.getByRole("button", { name: "أتممت الدرس" }).click();
    await expect(learner.page.locator("li").filter({ hasText: "مطلع الفاتحة" })).toContainText("أتممته");
    expect(sql(`select finished_on is not null from classroom.progress where lesson_id = '${lesson.id}'`)).toEqual(["t"]);
  } finally {
    await drop(teacher);
    await drop(learner);
  }
});

/** A reader signed in through the development outbox with no browser of their own: their session, for the API. */
async function reader(req: APIRequestContext, email: string, name: string): Promise<Record<string, string>> {
  await req.post("/api/v1/auth/email", { data: { email, return_to: "/classroom", locale: "ar" } });
  let link = "";
  await expect
    .poll(async () => (link = ((await (await req.get(`/api/v1/auth/dev/outbox?email=${encodeURIComponent(email)}`)).json()) as { messages: { link: string }[] }).messages.at(-1)?.link ?? ""))
    .not.toBe("");
  const s = (await (await req.post("/api/v1/auth/verify", { data: { token: new URL(link).searchParams.get("token") } })).json()) as { session: string };
  const h = { Authorization: `Bearer ${s.session}` };
  await req.patch("/api/v1/me", { headers: h, data: { display_name: name } });
  return h;
}
async function forget(req: APIRequestContext, h: Record<string, string>) {
  const c = (await (await req.post("/api/v1/me/delete", { headers: h })).json().catch(() => ({}))) as { confirm?: string };
  if (c.confirm) await req.post("/api/v1/me/delete/confirm", { headers: h, data: { confirm: c.confirm } });
}

test("an instructor reads the class's heat above the floor, keeps lesson notes and reminds gently; a member sees what was kept of them (P9.2b)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "two accounts in desktop windows; the phone layout is read in screenshots");
  test.setTimeout(180_000);
  const t = tag();
  const teacher = await person(browser, `e2e-heat-t-${t}@example.org`, "instructor");
  const learner = await person(browser, `e2e-heat-l-${t}@example.org`);
  const req = teacher.page.request;
  await req.patch("/api/v1/me", { headers: learner.h, data: { display_name: `ليلى ${t.slice(-4)}` } });
  const others: Record<string, string>[] = [];
  try {
    for (let i = 0; i < 4; i++) others.push(await reader(req, `e2e-heat-k${i}-${t}@example.org`, `خفي ${i} ${t.slice(-4)}`));
    const c = (await (await req.post("/api/v1/classroom/classes", { headers: teacher.h, data: { name: "حلقة العصر" } })).json()) as { id: string; join_code: string };
    const join = (h: Record<string, string>, detail = false) => req.post(`/api/v1/classroom/join/${c.join_code}`, { headers: h, data: { consent: "2026-10-04", detail_opt_in: detail } });
    await join(learner.h, true); // the only one who chose to show their detail
    for (const h of others.slice(0, 3)) await join(h);
    const lesson = (await (await req.post(`/api/v1/classroom/classes/${c.id}/lessons`, { headers: teacher.h, data: { title: "ربوبية الفاتحة", ranges: [{ surah: 1, from: 1, to: 7 }], roots: ["حمد"] } })).json()) as { id: string };
    const url = `/api/v1/classroom/lessons/${lesson.id}`;
    const day = new Date().toISOString().slice(0, 10);
    const counts = (h: Record<string, string>, items: { location: string; kind: string; n?: number }[]) => req.post(`${url}/counts`, { headers: h, data: { day, items } });
    // رَبِّ looked up four times each by three learners, who each wrote a note on its verse; one learner alone on a word of 1:5
    for (const h of [learner.h, others[0], others[1]]) expect((await counts(h, [{ location: "1:2:3", kind: "lookup", n: 4 }, { location: "1:2:0", kind: "note" }])).status()).toBe(200);
    await counts(others[2], [{ location: "1:5:2", kind: "lookup" }]);
    await req.post(`${url}/progress`, { headers: others[0], data: { day, minutes: 2, finished: true } });
    await req.post(`${url}/progress`, { headers: others[1], data: { day, minutes: 12 } });

    // four members: under the floor, nothing about a word
    const page = teacher.page;
    await page.goto(`/classroom/lesson/${lesson.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ربوبية الفاتحة");
    await expect(page.getByRole("status").filter({ hasText: "في الصف ٤ من ٥ طلاب" })).toBeVisible();
    await expect(page.locator('[data-w="1:2:3"]')).not.toHaveAttribute("data-heat", /./);
    await expect(page.getByText("تظهر حين يبلغ الصف ٥ طلاب.")).toBeVisible();

    // a fifth: the heat appears under the words, the letters keep their colour
    await join(others[3]);
    await page.reload();
    const rabb = page.locator('[data-w="1:2:3"]');
    await expect(rabb).toHaveAttribute("data-heat", "3");
    await expect(rabb).toHaveAttribute("aria-label", /البحث: ٣ طلاب، ١٢ مرة/);
    await expect(page.locator('[data-w="1:5:2"]')).toHaveAttribute("data-heat", "few");
    await expect(page.locator('[data-w="1:5:2"]')).toHaveAttribute("aria-label", /من أقل من ٣ طلاب، فلا يذكر العدد/);
    const ink = (sel: string) => page.locator(sel).evaluate((e) => getComputedStyle(e).color);
    expect(await ink('[data-w="1:2:3"]')).toBe(await ink('[data-w="1:1:1"]'));
    // the class panel: computed, never sample numbers
    const panel = page.getByRole("region", { name: "الصف في هذا الدرس" });
    await expect(panel.getByRole("heading", { name: "الصف · ٥ طلاب" })).toBeVisible();
    await expect(panel.locator("li").filter({ hasText: "ر ب ب" })).toContainText("١٢");
    await expect(panel.getByText("٣ طلاب لم يفتحوا الدرس")).toBeVisible();
    await expect(panel.getByText("طالب واحد أتمه في أقل من ثلاث دقائق")).toBeVisible();
    expect(await panel.locator("text=خفي").count()).toBe(0); // no one named who did not choose it
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations.map((v) => v.id)).toEqual([]);

    // a word's card, and the word into the lesson notes; a line of the instructor's own, moved first
    await rabb.click();
    const card = page.getByRole("region", { name: /^الكلمة / });
    await expect(card).toContainText("٣ طلاب، ١٢ مرة");
    await expect(card).toContainText("٣ طلاب، ٣ ملاحظات");
    await card.getByRole("button", { name: "أضفها إلى ملاحظات الدرس" }).click();
    await expect(card.getByRole("button", { name: "في ملاحظات الدرس" })).toBeDisabled();
    const notes = panel.locator("ol > li");
    await expect(notes).toHaveCount(1);
    await panel.getByRole("textbox", { name: "ملاحظة للدرس" }).fill("نقف عند الربوبية قبل الحمد");
    await panel.getByRole("button", { name: "أضف", exact: true }).click();
    await expect(notes).toHaveCount(2);
    await notes.nth(1).getByRole("button", { name: "انقلها أعلى" }).click();
    await expect(notes.nth(0)).toContainText("نقف عند الربوبية");
    // the notes' layer sits on the verse, not a word
    await page.getByRole("group", { name: "الطبقة" }).getByRole("button", { name: "الملاحظات" }).click();
    await expect(page.locator("article").filter({ has: page.locator('[data-w="1:2:1"]') })).toContainText("الملاحظات على الآية: ٣ طلاب، ٣ ملاحظات");
    await expect(page.getByText("الملاحظات على الآية", { exact: true }).first()).toBeVisible();

    // a reminder: a notice on their own page, the instructor told how many
    await panel.getByRole("button", { name: "ذكّر من لم يفتحه" }).click();
    await expect(panel.getByRole("status").filter({ hasText: "أرسل التذكير إلى ٣ طلاب." })).toBeVisible();

    // the table: a row only for the one who chose, the others together; a cell focusing its pair
    await page.getByRole("group", { name: "العرض" }).getByRole("button", { name: "الجدول" }).click();
    const table = page.getByRole("table");
    await expect(table.getByRole("rowheader")).toHaveText([`ليلى ${t.slice(-4)}`, "البقية مجموعين (٤)"]);
    await expect(table).not.toContainText("خفي");
    await table.getByRole("button", { name: new RegExp(`ليلى ${t.slice(-4)} · ر ب ب: ٤`) }).click();
    await expect(page.getByRole("region", { name: "الطالب والجذر" })).toContainText("كلمات الجذر في الدرس");
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations.map((v) => v.id)).toEqual([]);

    // the member: reminded, the notes, what their reader sent, finished by their word
    const lp = learner.page;
    await lp.goto(`/classroom/lesson/${lesson.id}`);
    await expect(lp.getByText("ذكّرك معلمك بهذا الدرس.")).toBeVisible();
    const inotes = lp.getByRole("region", { name: "ملاحظات المعلم" });
    await expect(inotes.locator("li")).toHaveCount(2);
    await expect(inotes.locator("li").nth(1).locator(".quran")).not.toBeEmpty();
    const mine = lp.getByRole("table", { name: "ما أرسله قارئك لهذا الدرس" });
    await expect(mine.getByRole("row").filter({ hasText: "البحث" })).toContainText("٤");
    await expect(mine.getByRole("row").filter({ hasText: "الملاحظات على الآية" })).toContainText("١:٢");
    await lp.getByRole("button", { name: "أتممت الدرس" }).click();
    await expect(lp.getByRole("status").filter({ hasText: "سجل أنك أتممته." })).toBeVisible();
    expect(sql(`select finished_on is not null from classroom.progress p join accounts.users u on u.id = p.user_id where p.lesson_id = '${lesson.id}' and u.email = '${learner.email}'`)).toEqual(["t"]);
    expect((await new AxeBuilder({ page: lp }).include("main").analyze()).violations.map((v) => v.id)).toEqual([]);
    // the member never sees the class's numbers
    expect((await lp.request.get(`${url}/heat`, { headers: learner.h })).status()).toBe(403);
    // and once they leave the class, the lesson is not theirs any more
    await lp.request.delete(`/api/v1/classroom/classes/${c.id}/membership`, { headers: learner.h });
    await lp.reload();
    await expect(lp.getByRole("alert").filter({ hasText: "لا درس بهذا الرابط لك." })).toBeVisible();
    await expect(lp.getByRole("link", { name: "إلى الصف" })).toBeVisible();
  } finally {
    for (const h of others) await forget(req, h);
    await drop(teacher);
    await drop(learner);
  }
});

test("a lesson's page asks a signed-out reader to sign in (P9.2b)", async ({ page }) => {
  await page.goto("/classroom/lesson/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("link", { name: "ادخل" })).toHaveAttribute("href", /next=%2Fclassroom%2Flesson%2F00000000/);
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations.map((v) => v.id)).toEqual([]);
});
