"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

/**
 * A page whose name is known only in the browser (a map kept on this device, or read from its link) gives the tab
 * that name in the site's own pattern, «%s • جذر» (WCAG 2.4.2). The page's own metadata can arrive after it (it
 * streams) and is laid under it again; going, it gives back the last title the page set itself.
 */
export function useWindowTitle(name: string | null) {
  const site = useTranslations("common")("siteName");
  useEffect(() => {
    if (!name) return;
    const mine = `${name} • ${site}`;
    let theirs = document.title;
    const apply = () => {
      // the count of due roots may stand before it (DueTitle)
      if (document.title.endsWith(mine)) return;
      theirs = document.title;
      document.title = mine;
    };
    apply();
    const watch = new MutationObserver(apply);
    watch.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      watch.disconnect();
      if (document.title.endsWith(mine)) document.title = theirs;
    };
  }, [name, site]);
}
