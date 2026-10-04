import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { drop, person, tag } from "./board";

/**
 * Journey F, teaching (design 01 §1.5; PLAN P9.4): the classroom → a lesson assigned → the class's heat showing which
 * words and roots it looked up, confirmed or struggled with → the shared map with its live feed → the map opened in
 * the editor. With a test cohort above the floor: the instructor and one member through the screens (the instructor on
 * a phone in the phone run), four more members by the API, each joined by consent. Real accounts.
 */

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
const frameOf = (page: Page) => page.frameLocator("iframe.lesson-map-frame");

test("journey F: a class taught — a lesson assigned, the class's heat read, the shared map's live feed, the map opened in the editor (P9.4)", async ({ browser, isMobile }) => {
  test.setTimeout(240_000);
  const t = tag();
  const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
  const teacher = await person(browser, `e2e-jf-t-${t}@example.org`, "instructor", isMobile ? phone : undefined);
  const learner = await person(browser, `e2e-jf-l-${t}@example.org`);
  const req = teacher.page.request;
  const lname = `مريم ${t.slice(-4)}`;
  await req.patch("/api/v1/me", { headers: learner.h, data: { display_name: lname } });
  const cohort: Record<string, string>[] = [];
  const tp = teacher.page;
  const lp = learner.page;
  try {
    // the classroom: a class made, its link given
    await tp.goto("/classroom");
    await tp.getByRole("textbox", { name: "اسم الصف" }).fill("حلقة العصر");
    await tp.getByRole("button", { name: "أنشئ الصف" }).click();
    await expect(tp).toHaveURL(/\/classroom\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    const classUrl = new URL(tp.url()).pathname;
    const link = await tp.getByRole("textbox", { name: "رابط الانضمام" }).inputValue();
    const code = link.split("/").at(-1)!;

    // a member joins by the link, told first what the instructor will see, and chooses to show their detail
    await lp.goto(new URL(link).pathname);
    await lp.getByRole("checkbox", { name: /قرأت ما سيراه المعلم/ }).check();
    await lp.getByRole("checkbox", { name: /أظهر تفاصيلي للمعلم/ }).check();
    await lp.getByRole("button", { name: "انضم", exact: true }).click();
    await expect(lp).toHaveURL(new RegExp(`${classUrl}$`), { timeout: 15_000 });
    // the rest of the cohort joins by consent too
    for (let i = 0; i < 4; i++) {
      const h = await reader(req, `e2e-jf-k${i}-${t}@example.org`, `قارئ ${i} ${t.slice(-4)}`);
      cohort.push(h);
      expect((await req.post(`/api/v1/classroom/join/${code}`, { headers: h, data: { consent: "2026-10-04" } })).status()).toBe(201);
    }

    // a lesson assigned: al-Fātiḥa 1–7 and its root
    await tp.reload();
    await expect(tp.getByText("٥ طلاب")).toBeVisible();
    await tp.getByRole("textbox", { name: "عنوان الدرس" }).fill("الحمد في الفاتحة");
    await tp.getByRole("textbox", { name: "الجذور (اختياري)" }).fill("ح م د");
    await tp.getByRole("button", { name: "أضف الدرس" }).click();
    await expect(tp.getByRole("status").filter({ hasText: "أضيف الدرس." })).toBeVisible();
    const lessons = (await (await req.get(`/api/v1/classroom${classUrl.replace("/classroom", "/classes")}`, { headers: teacher.h })).json()) as { lessons: { id: string }[] };
    const lessonId = lessons.lessons[0].id;
    const url = `/api/v1/classroom/lessons/${lessonId}`;

    // the member reads it in the reader, which says it counts: a word looked up
    await lp.goto("/quran/1");
    await expect(lp.locator(".lesson-strip")).toContainText("الحمد في الفاتحة");
    await lp.locator('.w[data-w="1:2:3"]').click();
    await expect.poll(() => lp.evaluate(() => JSON.parse(localStorage.getItem("jadhr-personal") ?? "null")?.state?.context?.at), { timeout: 15_000 }).toBe("1:2:3");
    await lp.goto("/classroom");
    await expect.poll(async () => ((await (await req.get(`${url}/mine`, { headers: learner.h })).json()) as { counts: unknown[] }).counts.length, { timeout: 15_000 }).toBeGreaterThan(0);
    // the cohort's readers: looked up, confirmed in review, struggled with
    const day = new Date().toISOString().slice(0, 10);
    for (const h of cohort.slice(0, 3)) {
      await req.post(`${url}/counts`, { headers: h, data: { day, items: [{ location: "1:2:3", kind: "lookup", n: 3 }, { location: "1:1:1", kind: "confirm" }, { location: "1:4:1", kind: "struggle" }] } });
    }
    await req.post(`${url}/counts`, { headers: learner.h, data: { day, items: [{ location: "1:4:1", kind: "struggle" }] } });

    // the class's heat: words looked up, the roots, struggled with; the table of those who chose by the lesson's roots
    await tp.goto(classUrl);
    await tp.getByRole("link", { name: "كيف قرأه الصف" }).click();
    await expect(tp).toHaveURL(new RegExp(`/classroom/lesson/${lessonId}`));
    await expect(tp.locator('[data-w="1:2:3"]')).toHaveAttribute("data-heat", "3");
    const panel = tp.getByRole("region", { name: "الصف في هذا الدرس" });
    await expect(panel.locator("li").filter({ hasText: "ر ب ب" })).toContainText("١٠");
    const layers = tp.getByRole("group", { name: "الطبقة" });
    await layers.getByRole("button", { name: "التعثر" }).click();
    await expect(tp.locator('[data-w="1:4:1"]')).toHaveAttribute("data-heat", "3");
    await layers.getByRole("button", { name: "التأكيد" }).click();
    await expect(tp.locator('[data-w="1:1:1"]')).toHaveAttribute("data-heat", "2");
    await tp.getByRole("group", { name: "العرض" }).getByRole("button", { name: "الجدول" }).click();
    await layers.getByRole("button", { name: "التعثر" }).click();
    const table = tp.getByRole("table");
    await expect(table.getByRole("rowheader")).toHaveText([lname, "البقية مجموعين (٤)"]);
    await expect(table.getByRole("columnheader", { name: "م ل ك" })).toBeVisible();
    expect((await new AxeBuilder({ page: tp }).include("main").analyze()).violations.map((v) => v.id)).toEqual([]);

    // the shared map: made, its feed live — a member's proposal reaches it without a reload
    await tp.getByRole("tab", { name: "خريطة الدرس" }).click();
    await tp.getByRole("button", { name: "أنشئ خريطة الدرس" }).click();
    const tf = frameOf(tp);
    await expect(tf.locator(".react-flow__node")).toHaveCount(2, { timeout: 20_000 });
    await tp.getByRole("tab", { name: "النشاط" }).click();
    await lp.goto(`/classroom/lesson/${lessonId}?tab=map`);
    await lp.getByRole("button", { name: "اقترح إضافة" }).click();
    const lf = frameOf(lp);
    await expect(lf.locator(".react-flow__node")).toHaveCount(2, { timeout: 20_000 });
    await expect
      .poll(async () => {
        await lp.evaluate(() => (document.querySelector("iframe.lesson-map-frame") as HTMLIFrameElement).contentWindow!.postMessage({ type: "jadhr:add-root", root: "ربب" }, location.origin));
        return lf.locator(".react-flow__node").count();
      }, { timeout: 20_000 })
      .toBe(3);
    await lp.getByRole("button", { name: "أرسل اقتراحي" }).click();
    await expect(lp.getByRole("region", { name: "اقتراحك" })).toHaveCount(0);
    // the instructor's feed shows it on its own, told at once over the map's socket (B47) — well within the half
    // minute it is otherwise read again in
    await expect(tp.getByRole("list", { name: "النشاط" })).toContainText(`${lname} · اقتراح ر ب ب`, { timeout: 8_000 });
    await tp.getByRole("tab", { name: /الاقتراحات/ }).click();
    await tp.locator(".proposal").filter({ hasText: lname }).getByRole("button", { name: "أكّد" }).click();
    await expect(tf.locator(".react-flow__node").filter({ hasText: "ر ب ب" })).toHaveCount(1);

    // the shared map opened in the editor itself
    await tp.getByRole("link", { name: "افتحها في المحرر" }).click();
    await expect(tp).toHaveURL(/\/graph\/edit\/[A-Za-z0-9_-]+$/, { timeout: 15_000 });
    await expect(tp.locator(".react-flow__node").filter({ hasText: "ر ب ب" })).toHaveCount(1, { timeout: 20_000 });
    await expect(tp.locator(".react-flow__node").filter({ hasText: "ح م د" })).toHaveCount(1);
  } finally {
    for (const h of cohort) await forget(req, h);
    await drop(teacher);
    await drop(learner);
  }
});
