"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { citeVerse } from "@/lib/format";
import type { CommentQuote as Quote } from "@/lib/graph/shared";
import { useVerseText } from "@/lib/graph/verseText";
import { QuotedArticle } from "./QuotedArticle";

/**
 * What a comment quotes (B41): a verse or a dictionary article, drawn from the dataset by the reference the comment
 * keeps — the verse in the mushaf's text with its citation, the article's opening words with its work, author and
 * page, as the map's cards draw them (L1, D22). The comment never holds the words.
 */
export function CommentQuote({ quote, max = 300 }: { quote: Quote; max?: number }) {
  return <div className="comment-quote">{quote.kind === "verse" ? <QuotedVerse verseKey={quote.key} /> : <QuotedArticle entry={quote.id} max={max} />}</div>;
}

function QuotedVerse({ verseKey }: { verseKey: string }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const v = useVerseText(verseKey);
  if (v.isPending) return <span className="block h-10 animate-pulse rounded bg-card-2" aria-hidden="true" />;
  if (!v.data) return <p className="text-[12px] text-t3">{t("quoteNoVerse")}</p>;
  const cite = citeVerse(v.data.surah_name_ar, v.data.surah, v.data.ayah, locale, v.data.surah_name_translit);
  return (
    <figure>
      <blockquote className="quran text-[19px] leading-[1.9] text-t1" lang="ar" dir="rtl">
        {v.data.tokens.map((x) => x.text).join(" ")}
      </blockquote>
      <figcaption className="mt-0.5 text-[11px] text-t3">
        <Link href={`/quran/${v.data.surah}/${v.data.ayah}`} prefetch={false} className="underline-offset-2 hover:text-t1 hover:underline">
          <bdi>{cite}</bdi>
        </Link>
      </figcaption>
    </figure>
  );
}
