"use client";

import { useLocale, useTranslations } from "next-intl";
import { opening, useEntry } from "@/lib/graph/quote";
import type { QuoteKey } from "@/lib/graph/types";

/**
 * A dictionary's article quoted on a note (RDR-239): its opening words in «», cut at a word and marked «…», with the
 * work and its author and page — read from the dataset, as the reader shows it (D22, L2). The whole article is in
 * the details. A comment that quotes an article draws it the same way (B41).
 */
export function QuotedArticle({ entry, max }: { entry: QuoteKey; max: number }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const e = useEntry(entry);
  if (e.isPending) return <span className="mt-1 block h-10 animate-pulse rounded bg-card-2" aria-hidden="true" />;
  if (!e.data) return <p className="mt-1 text-[12px] text-t3">{t("quoteUnavailable")}</p>;
  const { text, cut } = opening(e.data.body, max);
  const ar = e.data.lang !== "en";
  return (
    <figure className="mt-1">
      <blockquote className={ar ? "ar-classical text-[15.5px] leading-[1.9] text-t1" : "text-[13px] leading-relaxed text-t1"} lang={ar ? "ar" : "en"} dir={ar ? "rtl" : "ltr"}>
        «{text}
        {cut && <span className="text-t3"> …</span>}»
      </blockquote>
      <figcaption className="mt-1 text-[11px] leading-relaxed text-t3">
        {locale === "ar" ? `${e.data.title_ar} — ${e.data.author_ar}` : `${e.data.title_en} — ${e.data.author_en}`}
        {e.data.page_ref && (
          <>
            {" · "}
            <bdi dir="ltr" className="whitespace-nowrap">{e.data.page_ref}</bdi>
          </>
        )}
      </figcaption>
    </figure>
  );
}
