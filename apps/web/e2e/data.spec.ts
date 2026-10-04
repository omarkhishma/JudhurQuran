import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Data & API (P10.3; DAT-01…54): the dataset's counts as the API states them, its releases with their holds, the
 * changelog, citing it, its sources; and the playground sending real requests to the public API and showing what
 * came back — a hit and a miss.
 */

const ar = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

test("the dataset tab: counts from the data, releases with their holds, the changelog, the sources (P10.3a)", async ({ page }) => {
  const meta = (await (await page.request.get("/api/v1/meta")).json()) as { dataset: { version: string; counts: Record<string, number> } };
  const releases = (await (await page.request.get("/api/v1/releases")).json()) as { data: { version: string }[] };
  await page.goto("/data");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("البيانات والواجهة البرمجية");
  await expect(page.getByRole("tab", { name: "البيانات" })).toHaveAttribute("aria-selected", "true");
  for (const [k, label] of [["roots", "جذرا"], ["lemmas", "مدخلا"], ["words", "كلمة في المصحف"], ["verses", "آية"]] as const) {
    await expect(page.getByText(label, { exact: true }).locator("..")).toContainText(ar(meta.dataset.counts[k]));
  }
  await expect(page.getByText(`الإصدار ${meta.dataset.version}`)).toBeVisible();
  const rel = page.getByRole("region", { name: "الإصدارات" }).or(page.locator("section").filter({ has: page.getByRole("heading", { name: "الإصدارات" }) }));
  if (releases.data.length) {
    await expect(page.locator(".release-card").first()).toContainText(`v${releases.data[0].version}`);
    // a hold is told in the reader's language, without our decision codes; each file's path and hash stay whole
    const card = page.locator(".release-card").first();
    if ((await card.locator(".format-chip").count()) > 0) {
      await expect(card.getByText("لم ينشر بعد", { exact: false }).first()).toBeVisible();
      await expect(card).not.toContainText(/D19|the corpus permits|Held until/);
    }
    await expect(card.locator("span.whitespace-nowrap", { hasText: "sha256:" }).first()).toBeVisible();
  } else {
    await expect(rel.first()).toContainText("لم يسجل إصدار بعد.");
  }
  await expect(page.getByRole("heading", { name: "سجل التغييرات" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "المصادر والتراخيص" })).toBeVisible();
  // no invented numbers: no "used by", no placeholder DOI
  await expect(page.getByText(/used by|zenodo\.0000000/i)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations.map((v) => v.id)).toEqual([]);
});

test("the playground sends real requests and shows what came back (P10.3b)", async ({ page, isMobile }) => {
  await page.goto("/data?tab=api");
  await expect(page.getByRole("tab", { name: "مختبر الواجهة البرمجية" })).toHaveAttribute("aria-selected", "true");
  const box = page.getByLabel("الجواب");
  // the first answer comes at once: lookup of علم
  await expect(box).toContainText('"dataset": "jadhr-quran"');
  await expect(page.getByText(/^200 /).or(page.locator("p.mono span.text-good"))).toBeVisible();
  // a root, then a miss
  await page.getByRole("navigation", { name: "نقاط الواجهة" }).getByRole("button", { name: /quran\/roots/ }).click();
  await expect(page.getByRole("heading", { name: "GET /quran/roots/{root}" })).toBeVisible();
  await expect(page.getByText("جذر (علم أو ع ل م أو ʿ-l-m): مداخله بأوزانها، وتوزيعه في السور.")).toBeVisible();
  await expect(box).toContainText('"spaced": "ع ل م"');
  await page.getByRole("textbox", { name: "قيمة الطلب" }).fill("xyz");
  await page.getByRole("button", { name: "أرسل" }).click();
  await expect(box).toContainText('"code": "not_found"');
  await expect(page.locator("p.mono span.text-bad")).toHaveText("404");
  if (!isMobile) expect((await new AxeBuilder({ page }).include("main").analyze()).violations.map((v) => v.id)).toEqual([]);
});

test("the developers' guide: the public API's envelope, endpoints, releases, limits as the API states them, errors and terms (P10.3c)", async ({ page }) => {
  const index = (await (await page.request.get("/api/v1/public")).json()) as { data: { limits: { per_minute_without_key: number; per_minute_with_key: number } } };
  await page.goto("/developers");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("واجهة برمجية للمطوّرين");
  await expect(page.getByText(`بلا مفتاح: ${ar(index.data.limits.per_minute_without_key)} طلبا في الدقيقة لكل عنوان.`, { exact: false })).toBeVisible();
  for (const path of ["/api/v1/public/quran/roots/{root}", "/api/v1/public/quran/concordance", "/api/v1/releases/{version}/manifest"]) await expect(page.locator("main dl").filter({ hasText: path }).first()).toBeVisible();
  for (const code of ["invalid_key", "rate_limited", "held"]) await expect(page.getByText(code, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "مختبر الواجهة البرمجية" })).toHaveAttribute("href", /\/data\?tab=api$/);
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations.map((v) => v.id)).toEqual([]);
  await page.goto("/en/developers");
  await expect(page.getByText(`Without a key: ${index.data.limits.per_minute_without_key} requests a minute per address.`, { exact: false })).toBeVisible();
});

test("exit ◆ P10.4: a citation copied from the site resolves to an immutable artefact", async ({ page, context }) => {
  const releases = (await (await page.request.get("/api/v1/releases")).json()) as { data: { version: string; manifest_sha256: string; doi: string | null }[] };
  // the exit needs a recorded release: no skip — a site with none has nothing to cite
  expect(releases.data.length, "a recorded release (uv run python -m jadhr_api.releases record …)").toBeGreaterThan(0);
  const latest = releases.data[0];
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/data");
  const cite = page.locator("section").filter({ has: page.getByRole("heading", { name: "استشهد بالبيانات" }) });
  const copied: Record<string, string> = {};
  for (const [format, label] of [["bibtex", "BibTeX"], ["ris", "RIS"], ["chicago", "Chicago"], ["apa", "APA"], ["arabic", "العربية"]] as const) {
    await cite.getByRole("button", { name: label, exact: true }).click();
    await cite.getByRole("button", { name: "انسخ" }).click();
    await expect(cite.getByText("نسخ الاستشهاد")).toBeVisible();
    copied[format] = await page.evaluate(() => navigator.clipboard.readText());
    // what was copied is what the box shows, to the last character (RIS ends "ER  - ", its space included)
    expect(copied[format]).toBe(await cite.getByLabel("نص الاستشهاد").textContent());
    expect(copied[format]).toContain(latest.version);
  }
  // every form names the same address: the DOI once minted, else the release on this site
  const address = latest.doi ? `https://doi.org/${latest.doi}` : `${new URL(page.url()).origin}/api/v1/releases/${latest.version}`;
  expect(/url = \{([^}]+)\}/.exec(copied.bibtex)?.[1]).toBe(address);
  expect(/^UR {2}- (.+)$/m.exec(copied.ris)?.[1]).toBe(address);
  for (const f of ["chicago", "apa", "arabic"]) expect(copied[f]).toContain(address);
  if (latest.doi) return; // a DOI resolves through doi.org, outside this test
  // the address resolves to the release, its manifest byte for byte with the hash the record keeps
  const rel = await page.request.get(address);
  expect(rel.status()).toBe(200);
  const r = (await rel.json()) as { version: string; manifest_sha256: string; manifest_url: string; files: { path: string; sha256: string; bytes: number; held: string | null; available: boolean; url: string }[]; published_at: string | null };
  expect(r.version).toBe(latest.version);
  const man = await page.request.get(`${address}/manifest`);
  expect(man.status()).toBe(200);
  const bytes = await man.body();
  const { createHash } = await import("node:crypto");
  const digest = createHash("sha256").update(bytes).digest("hex");
  expect(digest).toBe(r.manifest_sha256);
  expect(man.headers()["x-content-sha256"]).toBe(digest);
  expect(man.headers()["cache-control"]).toContain("immutable");
  // the manifest names every file the release lists, with the same hashes and sizes
  const m = JSON.parse(bytes.toString("utf-8")) as { version: string; files: { path: string; sha256: string; bytes: number }[] };
  expect(m.version).toBe(latest.version);
  expect(r.files.map((f) => [f.path, f.sha256, f.bytes])).toEqual(m.files.map((f) => [f.path, f.sha256, f.bytes]));
  // a file: its bytes are those its hash names once published; until then, refused with the reason
  for (const f of r.files.filter((x) => !x.held).slice(0, 1).concat(r.files.filter((x) => x.held).slice(0, 1))) {
    const got = await page.request.get(f.url);
    if (f.available) {
      expect(got.status()).toBe(200);
      expect(createHash("sha256").update(await got.body()).digest("hex")).toBe(f.sha256);
    } else {
      expect(got.status()).toBe(403);
      expect(((await got.json()) as { error: { code: string } }).error.code).toBe(r.published_at ? "held" : "unpublished");
    }
  }
});
