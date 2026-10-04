import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { drop, person, tag } from "./board";

/**
 * A lesson's map (P9.3; CLS-27…41, Q06, H01): the instructor makes it and edits it in the real editor framed in the
 * lesson's page; a member reads it framed, proposes by adding to their own copy in the same frame and sending what
 * they added; the instructor confirms the proposal into the open editor, and the shared copy holds it; the feed says
 * what happened in the product's words, with a comment; the side tabs each show their own content; a reader outside
 * the class is told the map is the class's. Real accounts through the development outbox.
 */

const frameOf = (page: Page) => page.frameLocator("iframe.lesson-map-frame");
const postToFrame = (page: Page, m: unknown) =>
  page.evaluate((msg) => (document.querySelector("iframe.lesson-map-frame") as HTMLIFrameElement).contentWindow!.postMessage(msg, location.origin), m);

test("a lesson's map: made by the instructor, proposed to by a member, confirmed into the editor, told in the feed (P9.3)", async ({ browser, isMobile }) => {
  test.skip(isMobile, "two accounts in desktop windows; the phone layout is read in screenshots");
  test.setTimeout(180_000);
  const t = tag();
  const teacher = await person(browser, `e2e-map-t-${t}@example.org`, "instructor");
  const learner = await person(browser, `e2e-map-l-${t}@example.org`);
  const req = teacher.page.request;
  const lname = `سارة ${t.slice(-4)}`;
  await req.patch("/api/v1/me", { headers: learner.h, data: { display_name: lname } });
  await req.patch("/api/v1/me", { headers: teacher.h, data: { display_name: `د. نور ${t.slice(-4)}` } });
  try {
    const c = (await (await req.post("/api/v1/classroom/classes", { headers: teacher.h, data: { name: "حلقة الخريطة" } })).json()) as { id: string; join_code: string };
    await req.post(`/api/v1/classroom/join/${c.join_code}`, { headers: learner.h, data: { consent: "2026-10-04" } });
    const lesson = (await (await req.post(`/api/v1/classroom/classes/${c.id}/lessons`, { headers: teacher.h, data: { title: "الحمد", ranges: [{ surah: 1, from: 1, to: 7 }], roots: ["حمد"] } })).json()) as { id: string };
    const url = `/api/v1/classroom/lessons/${lesson.id}`;

    // the instructor makes the map: the lesson's heading and its root, in the editor framed beside the tabs
    const tp = teacher.page;
    await tp.goto(`/classroom/lesson/${lesson.id}?tab=map`);
    await expect(tp.getByRole("tab", { name: "خريطة الدرس" })).toHaveAttribute("aria-selected", "true");
    await tp.getByRole("button", { name: "أنشئ خريطة الدرس" }).click();
    const tf = frameOf(tp);
    await expect(tf.locator(".react-flow__node")).toHaveCount(2, { timeout: 20_000 });
    await expect(tf.locator(".react-flow__node").filter({ hasText: "ح م د" })).toHaveCount(1);
    const gid = ((await (await req.get(url, { headers: teacher.h })).json()) as { map: { id: string } }).map.id;
    await expect(tp.getByText("نسخة الصف · يقترح الطلاب ويؤكد المعلم")).toBeVisible();

    // a reader outside the class is told it is a class's map — the link alone opens nothing
    const anon = await (await browser.newContext()).newPage();
    expect((await anon.request.get(`/api/v1/graphs/${gid}`)).status()).toBe(404);
    await anon.goto(`/graph/shared/${gid}`);
    await expect(anon.getByRole("heading", { name: "خريطة صف" })).toBeVisible();
    await anon.context().close();

    // the member reads it framed, then proposes from their own copy: a root added, a word with it
    const lp = learner.page;
    await lp.goto(`/classroom/lesson/${lesson.id}?tab=map`);
    const lf = frameOf(lp);
    await expect(lf.locator(".react-flow__node")).toHaveCount(2, { timeout: 20_000 });
    await expect(lf.getByText(/خريطة درس «الحمد» في «حلقة الخريطة»/)).toBeVisible();
    await lp.getByRole("button", { name: "اقترح إضافة" }).click();
    const draft = lp.getByRole("region", { name: "اقتراحك" });
    await expect(draft).toBeVisible();
    // the copy opens in the editor; a root is sent into it as the split view sends one
    await expect(lf.locator(".react-flow__node")).toHaveCount(2, { timeout: 20_000 });
    await expect.poll(async () => {
      await postToFrame(lp, { type: "jadhr:add-root", root: "رحم" });
      return lf.locator(".react-flow__node").count();
    }, { timeout: 20_000 }).toBe(3);
    await draft.getByRole("textbox", { name: "كلمة مع اقتراحك" }).fill("الرحمة قرينة الحمد");
    await draft.getByRole("button", { name: "أرسل اقتراحي" }).click();
    await expect(draft).toHaveCount(0);
    await lp.getByRole("tab", { name: /الاقتراحات/ }).click();
    const mine = lp.locator(".proposal").first();
    await expect(mine).toContainText("أنت");
    await expect(mine.locator(".proposal-card")).toContainText("ر ح م");
    expect((await new AxeBuilder({ page: lp }).include("main").exclude("iframe").analyze()).violations.map((v) => v.id)).toEqual([]);

    // the instructor confirms it into the open editor: the card is on the map, and the shared copy holds it
    await tp.reload();
    await expect(tf.locator(".react-flow__node")).toHaveCount(2, { timeout: 20_000 });
    await expect(tp.getByRole("tab", { name: /الاقتراحات/ })).toHaveAttribute("aria-selected", "true");
    const p = tp.locator(".proposal").filter({ hasText: lname });
    await expect(p).toContainText("الرحمة قرينة الحمد");
    await p.getByRole("button", { name: "أكّد" }).click();
    await expect(tp.getByRole("status").filter({ hasText: `أضيف اقتراح ${lname} إلى الخريطة.` })).toBeVisible();
    await expect(tf.locator(".react-flow__node").filter({ hasText: "ر ح م" })).toHaveCount(1);
    await expect
      .poll(async () => ((await (await req.get(`/api/v1/graphs/${gid}`, { headers: teacher.h })).json()) as { doc: { nodes: { id: string }[] } }).doc.nodes.map((n) => n.id).includes("root:رحم"), { timeout: 20_000 })
      .toBe(true);
    const decided = (await (await req.get(`${url}/proposals`, { headers: teacher.h })).json()) as { data: { status: string }[] };
    expect(decided.data.map((x) => x.status)).toEqual(["confirmed"]);

    // the feed: the confirmation and the proposal in the product's words; a comment on the whole map
    await tp.getByRole("tab", { name: "النشاط" }).click();
    const feed = tp.getByRole("list", { name: "النشاط" });
    await expect(feed).toContainText(`تأكيد اقتراح ${lname}: ر ح م`);
    await expect(feed).toContainText("اقتراح ر ح م");
    await tp.getByRole("textbox", { name: "تعليقك" }).fill("نراجعها يوم الجمعة");
    await tp.getByRole("textbox", { name: "تعليقك" }).press("Enter");
    await expect(feed.locator(".feed-entry").first()).toContainText("نراجعها يوم الجمعة");
    // the topics and notes tabs show their own content
    await tp.getByRole("tab", { name: "الموضوعات" }).click();
    await expect(tp.locator("#side-topics-panel")).toContainText("لا موضوع على الخريطة بعد.");
    await tp.getByRole("tab", { name: "الملاحظات" }).click();
    await expect(tp.locator("#side-notes-panel").getByRole("textbox", { name: "ملاحظة للدرس" })).toBeVisible();
    expect((await new AxeBuilder({ page: tp }).include("main").exclude("iframe").analyze()).violations.map((v) => v.id)).toEqual([]);

    // the member sees their proposal decided
    await lp.reload();
    await lp.getByRole("tab", { name: /الاقتراحات/ }).click();
    await expect(lp.locator(".proposal").first()).toContainText("مؤكد");
  } finally {
    await drop(teacher);
    await drop(learner);
  }
});
