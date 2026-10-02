"use client";

import { useTranslations } from "next-intl";
import { useIsClient } from "@/lib/client";
import { isBookmarked, useSaved, type Bookmark } from "@/lib/store/saved";

export function BookmarkButton({ kind, keyId, label }: { kind: Bookmark["kind"]; keyId: string; label: string }) {
  const t = useTranslations("saved");
  const client = useIsClient();
  const bookmarks = useSaved((s) => s.bookmarks);
  const toggle = useSaved((s) => s.toggleBookmark);
  const on = client && isBookmarked(bookmarks, kind, keyId);
  const text = kind === "verse" ? t("bookmarkVerse") : t("bookmarkWord");
  return (
    <button
      type="button"
      className="btn icon-btn"
      aria-pressed={on}
      aria-label={text}
      title={on ? t("bookmarked") : text}
      onClick={() => toggle({ kind, key: keyId, label })}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 2h8v12l-4-3-4 3V2Z" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
