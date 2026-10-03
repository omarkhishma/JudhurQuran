"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import type { BoardReview } from "@/lib/reader/types";

/**
 * The editorial board's verdict on a row a book gave (P3.0c): reviewed, or corrected — the correction shown beside
 * the source's words, which stay. A row the board rejected never reaches the reader.
 */
export function ReviewMark({ review }: { review?: BoardReview }) {
  const t = useTranslations("board");
  if (!review) return null;
  return (
    <p className={"board-mark" + (review.verdict === "corrected" ? " is-corrected" : "")}>
      <span className="font-medium">{t(review.verdict === "corrected" ? "corrected" : "reviewed")}</span>
      {review.correction && (
        <>
          {": "}
          <span dir="auto">{review.correction}</span>
        </>
      )}
      {review.note && <span className="text-t3"> — {review.note}</span>}
    </p>
  );
}

/** A section's footnote: all its rows reviewed by the board, some of them (and the rest not yet), or none yet. */
export function ReviewStatus({ items, none }: { items: { review?: BoardReview }[]; none: string }) {
  const t = useTranslations("board");
  const locale = useLocale();
  const done = items.filter((x) => x.review).length;
  const text = done === 0 ? none : done === items.length ? t("all") : t("some", { done: formatNumber(done, locale), all: formatNumber(items.length, locale) });
  return <p className="text-[11px] text-t3">{text}</p>;
}
