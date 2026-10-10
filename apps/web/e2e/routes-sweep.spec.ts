import { expect, test } from "@playwright/test";
import { dynamicRoutes, STATIC } from "./routes";

/**
 * P1.9's exit, kept as a sweep: every route of the site renders in both languages, both themes and three widths
 * (1440, 1024, 390) — an answer under 400, a main landmark, no error boundary, no sideways scroll, and the theme the
 * reader keeps still on once the page has hydrated (a hydration mismatch resets it silently), no control inside
 * another (a button or a link inside a button or a link: invalid, and two targets in one place). Dynamic routes take
 * their first page from the API.
 */

test.describe.configure({ mode: "parallel" });

const WIDTHS = [
  [1440, 900],
  [1024, 768],
  [390, 844],
] as const;

for (const locale of ["ar", "en"] as const)
  for (const theme of ["light", "dark"] as const)
    test(`every route in ${locale}, ${theme}, at 1440, 1024 and 390 px (P1.9)`, async ({ browser, isMobile }) => {
      test.skip(isMobile, "the widths are set here; one project runs the sweep");
      test.setTimeout(600_000);
      const failures: string[] = [];
      for (const [w, h] of WIDTHS) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        await ctx.addInitScript((t) => {
          try {
            localStorage.setItem("jadhr-theme", t);
            if (!localStorage.getItem("jadhr-personal")) localStorage.setItem("jadhr-personal", JSON.stringify({ state: { visited: true, onboarded: true }, version: 2 }));
          } catch {}
        }, theme);
        const page = await ctx.newPage();
        const routes = [...STATIC, ...(await dynamicRoutes(page))];
        for (const r of routes) {
          const path = locale === "ar" ? r : `/en${r === "/" ? "" : r}`;
          const where = `${path} @${w} ${theme}`;
          const res = await page.goto(path, { waitUntil: "load" });
          if (!res || res.status() >= 400) {
            failures.push(`${where}: HTTP ${res?.status()}`);
            continue;
          }
          await page.waitForLoadState("networkidle").catch(() => {});
          const got = await page.evaluate(() => ({
            main: !!document.querySelector("main"),
            error: /حدث خطأ غير متوقع|Something went wrong/.test(document.body.innerText),
            scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            theme: document.documentElement.dataset.theme,
            lang: document.documentElement.lang,
            nested: [...document.querySelectorAll("button button, a a, a button, button a")].map((e) => e.className.slice(0, 40)),
          }));
          if (!got.main) failures.push(`${where}: no main landmark`);
          if (got.error) failures.push(`${where}: the error boundary`);
          if (got.scroll > 1) failures.push(`${where}: ${got.scroll}px sideways`);
          if (got.theme !== theme) failures.push(`${where}: theme ${got.theme}`);
          if (got.lang !== locale) failures.push(`${where}: lang ${got.lang}`);
          if (got.nested.length) failures.push(`${where}: a control inside another (${got.nested.slice(0, 3).join(", ")})`);
        }
        await ctx.close();
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });
