"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";
import { formatNumber } from "@/lib/format";
import { useDueSignal } from "@/lib/review/due";

const PREFIX = /^\([\d٠-٩]+\) /;

/**
 * Plan B30: how many roots are due for review, before the page's title in the browser tab — «(٣) سورة البقرة» —
 * and nothing else: no notification, no streak, no sound. Off with the reading preference; gone when none are due.
 * The page sets its own title on each navigation, so the count is laid over whatever title is there.
 */
export function DueTitle() {
  const n = useDueSignal();
  const locale = useLocale();
  useEffect(() => {
    const apply = () => {
      const bare = document.title.replace(PREFIX, "");
      const next = n ? `(${formatNumber(n, locale)}) ${bare}` : bare;
      if (document.title !== next) document.title = next;
    };
    apply();
    const watch = new MutationObserver(apply);
    watch.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      watch.disconnect();
      document.title = document.title.replace(PREFIX, "");
    };
  }, [n, locale]);
  return null;
}
