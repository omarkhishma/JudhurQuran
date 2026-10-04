import { expect, test } from "@playwright/test";
import { STATIC, dynamicRoutes } from "./routes";

/**
 * Every page's head as a search engine reads it (P12: SEO for every surface), in both languages: the document's
 * language and direction, a title of its own, a description, Open Graph's title; a public page names its canonical
 * address and its two languages, and a page that is the reader's own (or a search's) asks not to be indexed.
 */

// the reader's own pages, a search's and the tools': never indexed
const PRIVATE = /^\/(?:split|library|search|concordance|analyse|notebook|review|classroom|me|saved|signin|offline|graph\/root\/)/;

const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;

for (const locale of ["ar", "en"] as const)
  test(`every route's head in ${locale}: title, description, canonical, languages, robots (P12)`, async ({ page, isMobile }) => {
    test.skip(isMobile, "the head is the same at every width");
    const routes = [...STATIC, ...(await dynamicRoutes(page)), "/offline"];
    const prefix = locale === "en" ? "/en" : "";
    const titles = new Map<string, string>();
    const faults: string[] = [];
    for (const route of routes) {
      const path = `${prefix}${route === "/" && prefix ? "" : route}`;
      const res = await page.request.get(path);
      expect(res.status(), path).toBe(200);
      const html = await res.text();
      const head = html.slice(0, html.indexOf("</head>"));
      const tags = head.match(/<(?:meta|link|html)\b[^>]*>/g) ?? [];
      const find = (re: RegExp) => tags.find((t) => re.test(t)) ?? null;
      const html_ = find(/^<html\b/)!;
      if (attr(html_, "lang") !== locale || attr(html_, "dir") !== (locale === "ar" ? "rtl" : "ltr")) faults.push(`${path}: lang/dir`);
      const title = head.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
      if (!title.trim()) faults.push(`${path}: no title`);
      const bare = route.split("?")[0];
      if (titles.has(title) && titles.get(title) !== bare) faults.push(`${path}: title shared with ${titles.get(title)}`);
      titles.set(title, bare);
      const description = attr(find(/name="description"/) ?? "", "content") ?? "";
      if (description.trim().length < 15) faults.push(`${path}: no description`);
      if (description !== description.trim()) faults.push(`${path}: description has outer spaces`);
      if (!find(/property="og:title"/)) faults.push(`${path}: no og:title`);
      const robots = attr(find(/name="robots"/) ?? "", "content") ?? "";
      if (PRIVATE.test(route)) {
        if (!robots.includes("noindex")) faults.push(`${path}: indexed`);
        continue;
      }
      if (robots.includes("noindex")) faults.push(`${path}: not indexed`);
      const canonical = attr(find(/rel="canonical"/) ?? "", "href");
      if (!canonical || new URL(canonical).pathname !== new URL(path === "" ? "/" : path, "http://x").pathname) faults.push(`${path}: canonical ${canonical}`);
      const langs = tags.filter((t) => /rel="alternate"/.test(t) && /hrefLang=/.test(t)).map((t) => attr(t, "hrefLang"));
      for (const l of ["ar", "en", "x-default"]) if (!langs.includes(l)) faults.push(`${path}: no ${l} alternate`);
    }
    expect(faults, "the heads' faults").toEqual([]);
    expect(titles.size, "routes read").toBeGreaterThan(40);
  });
