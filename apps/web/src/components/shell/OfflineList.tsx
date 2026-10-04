"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type Kept = { href: string; title: string };

/** The reading pages the offline worker keeps in this browser, by their titles, newest first. */
export function OfflineList() {
  const t = useTranslations("common");
  const locale = useLocale();
  const [kept, setKept] = useState<Kept[] | null>(null);
  useEffect(() => {
    (async () => {
      if (!("caches" in window)) return setKept([]);
      const names = (await caches.keys()).filter((n) => n.startsWith("jadhr-pages-"));
      const out: Kept[] = [];
      for (const n of names) {
        const cache = await caches.open(n);
        for (const req of [...(await cache.keys())].reverse()) {
          const url = new URL(req.url);
          if (url.pathname.endsWith("/offline")) continue;
          const html = await (await cache.match(req))!.text();
          const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'") ?? url.pathname;
          out.push({ href: url.pathname + url.search, title });
        }
      }
      setKept(out);
    })().catch(() => setKept([]));
  }, []);
  if (kept === null) return <div className="h-24 animate-pulse rounded-xl bg-card-2" />;
  if (!kept.length) return <p className="text-[13.5px] text-t3">{t("offlineNone")}</p>;
  return (
    <section aria-labelledby="kept-h" className="flex flex-col gap-2">
      <h2 id="kept-h" className="label-caps">{t("offlineKept")}</h2>
      <ul className="flex flex-col gap-1.5">
        {kept.map((k) => (
          <li key={k.href}>
            {/* a full load, so the worker answers it */}
            <a href={k.href} className="result-row" dir="auto" lang={locale}>
              {k.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
