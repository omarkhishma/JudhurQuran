import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { api, followSignInLink } from "./helpers";

const PAGES = ["/", "/quran", "/quran/1", "/quran/2/255", "/word/2:255:23", `/roots/${encodeURIComponent("علم")}`, "/search?q=%D8%B5%D8%A8%D8%B1", "/concordance", "/concordance?view=dist", "/about", "/sources", "/saved", "/en", "/en/word/1:1:1", "/analyse", "/analyse?q=2%3A255&view=interlinear", "/library", "/library/text/missing", "/explore", "/notebook", "/data", "/review/guidelines"];

for (const path of PAGES) {
  test(`axe: ${decodeURIComponent(path)}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(
      serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`),
      "serious or critical accessibility violations",
    ).toEqual([]);
  });
}

// Dark theme: its own tokens, checked on the pages that use the most colours.
for (const path of ["/quran/2/255", "/word/2:255:23", `/roots/${encodeURIComponent("علم")}`, "/search?q=%D8%B5%D8%A8%D8%B1", "/concordance?view=dist", "/en"]) {
  test(`axe dark: ${decodeURIComponent(path)}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("jadhr-theme", "dark"));
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
}


// The states a page reaches by use (P5.6, audit 10): a set, the study deck, the review overlay, the journal, a note
// open, the sign-in sheet — each in both themes.
const NOTE = { id: "n1", title: "عن العلم", body: "انظر @2:255 و@ع ل م", tags: ["درس"], created: 1759000000000, updated: 1759000000000, links: { roots: ["علم"], verses: ["2:255"], words: [] } };
const SEED = {
  "jadhr-personal": { state: { visited: true, onboarded: true, wordStates: { Eilom: "known" }, sessions: [{ day: new Date().toLocaleDateString("en-CA"), text: "quran", words: ["Eilom"], roots: ["علم"], verses: ["2:255"], lookups: 3 }] }, version: 2 },
  "jadhr-saved": { state: { bookmarks: [{ kind: "lemma", key: "Eilom", label: "عِلْم", at: 1 }], notes: {}, history: [] }, version: 2 },
  "jadhr-notebook": { state: { notes: [NOTE] }, version: 1 },
};
type Page = import("@playwright/test").Page;

/** Signed in through the development outbox, as a reader would be (F28: the account tab is checked signed in too). */
async function signedIn(page: Page): Promise<void> {
  const email = `e2e-axe-${test.info().project.name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}@example.org`;
  expect((await page.request.post("/api/v1/auth/email", { data: { email, return_to: "/me?tab=account", locale: "ar" } })).status()).toBe(202);
  let link = "";
  await expect
    .poll(async () => {
      const m = ((await (await page.request.get(`/api/v1/auth/dev/outbox?email=${encodeURIComponent(email)}`)).json()) as { messages: { link: string }[] }).messages;
      return (link = m.at(-1)?.link ?? "");
    })
    .not.toBe("");
  const u = new URL(link);
  await followSignInLink(page, u.pathname + u.search);
  await expect(page).toHaveURL(/\/me\?tab=account$/);
  await page.getByRole("heading", { name: "حذف الحساب" }).waitFor();
  await page.getByText(/لا نسخ مستبدلة|استُبدلت/).first().waitFor();
}

/** The account made for a state, deleted after it. */
async function dropAccount(page: Page): Promise<void> {
  const h = { Authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem("jadhr-auth") ?? "{}").state?.session)}` };
  const c = (await (await page.request.post("/api/v1/me/delete", { headers: h })).json()) as { confirm?: string };
  if (c.confirm) await page.request.post("/api/v1/me/delete/confirm", { headers: h, data: { confirm: c.confirm } });
}

const STATES: { name: string; path: string; act?: (page: Page) => Promise<void>; after?: (page: Page) => Promise<void> }[] = [
  { name: "a set", path: "/explore?set=ilm" },
  {
    name: "the study deck",
    path: "/explore?set=ilm",
    act: async (page) => {
      await page.getByRole("button", { name: "ادرسها بالبطاقات" }).click();
      await page.getByRole("dialog").waitFor();
    },
  },
  { name: "the review overlay", path: "/quran/1?mode=review", act: async (page) => void (await page.locator(".review-card").waitFor()) },
  { name: "the journal", path: "/notebook?tab=journal" },
  { name: "an open note", path: "/notebook?note=n1", act: async (page) => void (await page.locator(".notebook-editor").waitFor()) },
  { name: "the profile", path: "/me", act: async (page) => void (await page.locator(".profile-counts").waitFor()) },
  { name: "the profile's account tab, signed out", path: "/me?tab=account", act: async (page) => void (await page.getByLabel("بريدك الإلكتروني").waitFor()) },
  { name: "the profile's account tab, signed in", path: "/", act: signedIn, after: dropAccount },
  { name: "the sign-in page", path: "/signin" },
  // the review queue and a proposal (audit 12 F28): the first in the list, whatever the database holds
  {
    name: "the review queue",
    path: "/review",
    act: async (page) => {
      await page.locator(".queue-list .queue-row, .queue-list p").first().waitFor();
      if (await page.locator(".queue-row").count()) {
        // a phone shows the list, then the proposal (RVQ-81)
        if ((page.viewportSize()?.width ?? 1440) < 900) await page.locator(".queue-row").first().click();
        await page.locator("#proposal-title").waitFor();
      }
    },
  },
  {
    name: "the proposal form",
    path: "/quran/2?w=ilm&at=2:32:4",
    act: async (page) => {
      await page.getByRole("button", { name: "اقترح معنى حرفيًا أدق" }).first().click();
      await page.getByRole("dialog").waitFor();
    },
  },
  {
    // a real link, asked for elsewhere: the page names its account and warns (security review M1)
    name: "a sign-in link's page",
    path: "/signin",
    act: async (page) => {
      const email = `e2e-axe-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}@example.org`;
      await page.request.post("/api/v1/auth/email", { data: { email, locale: "ar" } });
      const m = ((await (await page.request.get(`/api/v1/auth/dev/outbox?email=${encodeURIComponent(email)}`)).json()) as { messages: { link: string }[] }).messages;
      const u = new URL(m.at(-1)!.link);
      await page.goto(u.pathname + u.search);
      await page.locator(".auth-caution").waitFor();
      await page.getByRole("button", { name: "ادخل", exact: true }).waitFor();
    },
  },
  { name: "the privacy page", path: "/privacy" },
  {
    name: "the sign-in sheet",
    path: "/explore",
    act: async (page) => {
      await page.getByRole("banner").getByRole("button", { name: "دخول" }).click();
      await page.getByRole("dialog").waitFor();
    },
  },
];
for (const theme of ["light", "dark"] as const)
  for (const s of STATES) {
    test(`axe ${theme}: ${s.name}`, async ({ page }) => {
      await page.addInitScript(
        ([seed, th]) => {
          if (sessionStorage.getItem("axe-seeded")) return;
          sessionStorage.setItem("axe-seeded", "1");
          for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
          localStorage.setItem("jadhr-theme", th);
        },
        [SEED, theme] as const,
      );
      await page.goto(s.path);
      await page.waitForLoadState("networkidle");
      await s.act?.(page);
      await page.waitForTimeout(400); // an overlay's entrance (≤ 160 ms) has finished: contrast is read at rest
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      await s.after?.(page);
      expect(serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
  }

// The graph pages (F14, P8.1-B): My maps, a root's map, the editor on a word's map with a card and a link
// selected, the readings to review, a shared map — each in both themes.
const seedOf = (s: object) => Buffer.from(JSON.stringify(s), "utf8").toString("base64url");
for (const theme of ["light", "dark"] as const)
  for (const [name, go] of [
    ["My maps", async (page: Page) => void (await page.goto("/graph"))],
    ["a root's map", async (page: Page) => void (await page.goto(`/graph/root/${encodeURIComponent("رحم")}`))],
    [
      "the editor, a card and a link selected",
      async (page: Page) => {
        await page.goto(`/graph/seed?s=${seedOf({ seed: "word", slug: "alamin", at: "1:2:4" })}`);
        await expect(page).toHaveURL(/\/graph\/edit\//, { timeout: 30_000 });
        // selected wherever the layout put it (a phone's canvas may not show it)
        await page.locator('.react-flow__node[data-id="verse:1:2"]').waitFor();
        await page.locator('.react-flow__node[data-id="verse:1:2"]').dispatchEvent("click");
        await page.locator(".react-flow__edge").first().focus();
      },
    ],
    [
      "the editor: a quotation, a card's fields, a group selected",
      async (page: Page) => {
        const w = await api<{ dict_articles: { entries: { id: number }[] }[] }>(page, "/words/ilm?limit=0");
        await page.goto(`/graph/seed?s=${seedOf({ seed: "quote", entry: w.dict_articles[0].entries[0].id })}`);
        await expect(page).toHaveURL(/\/graph\/edit\//, { timeout: 30_000 });
        await page.locator(".graph-card blockquote").first().waitFor();
        const root = page.locator('.react-flow__node[data-id="root:علم"]');
        for (const kind of ["نص قصير", "وسوم", "رقم", "اختيار", "رابط", "تاريخ", "صورة"]) {
          await root.locator(".card-fields").getByRole("button", { name: "+ إضافة" }).dispatchEvent("click");
          await root.getByRole("menuitem", { name: kind, exact: true }).dispatchEvent("click");
        }
        await root.getByRole("textbox", { name: "إضافة وسم إلى «وسوم»" }).fill("علم");
        await root.getByRole("textbox", { name: "إضافة وسم إلى «وسوم»" }).press("Enter");
        await page.keyboard.press("Escape");
        await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
        await page.keyboard.press("Meta+a");
        await page.keyboard.press("Meta+g");
        await page.locator(".react-flow__node-frame.selected").waitFor();
      },
    ],
    [
      "the readings to review",
      async (page: Page) => {
        await page.goto(`/graph/seed?s=${seedOf({ seed: "trail", phrase: "فالعلم نور", steps: [{ kind: "word", id: "ilm", conf: 0.52, s: "فالعلم" }, { kind: "word", id: "nur", conf: 1, s: "نور" }] })}`);
        await page.locator(".seed-review li").first().waitFor();
      },
    ],
  ] as const)
    test(`axe ${theme}: graph — ${name}`, async ({ page }) => {
      await page.addInitScript((th) => {
        localStorage.setItem("jadhr-theme", th);
        localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
      }, theme);
      await go(page);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(400);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
