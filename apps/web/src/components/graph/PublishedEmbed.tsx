"use client";

import { useTranslations } from "next-intl";
import type { PublishedMap } from "@/lib/graph/published";
import { PublishedHeader, ReadOnlyMap } from "./PublishedView";

/** The map in another site's frame (EDT-284): no header — the frame's page carries the actions. */
export function EmbedFrame({ m, entry, folded }: { m: PublishedMap; entry: boolean; folded: boolean }) {
  return <ReadOnlyMap m={m} framed entry={entry} folded={folded} />;
}

/** The map in the editor, read-only, in a window of its own (EDT-025, EDT-340): its header with Fork. */
export function PublishedWindow({ m }: { m: PublishedMap }) {
  return <ReadOnlyMap m={m} framed={false} entry folded={false} header={<PublishedHeader m={m} />} />;
}

/** A frame whose map is no longer published, or never was (EDT-279): said in the frame, in the product's words. */
export function EmbedGone({ by }: { by: "author" | "board" | "none" }) {
  const t = useTranslations("graph");
  return (
    <div className="graph-empty-frame flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center">
      <p className="text-[14px] font-semibold text-t1">{t(by === "none" ? "publishedMissing" : "publishedWithdrawn")}</p>
      <p className="max-w-[44ch] text-[12.5px] leading-relaxed text-t2">{t(by === "board" ? "publishedWithdrawnBoard" : by === "author" ? "publishedWithdrawnAuthor" : "publishedMissingBody")}</p>
    </div>
  );
}
