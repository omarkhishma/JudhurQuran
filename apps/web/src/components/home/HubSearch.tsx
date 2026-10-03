"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Link, useRouter } from "@/i18n/navigation";

/**
 * The hub's search, the primary action (06 §6.1, HUB-05, Q03): it teaches the Quran's own queries — a word,
 * root letters, a verse reference in digits or by sūra name — with examples under it that are links, so a
 * phone shows them too, where a long placeholder is cut. While it is on screen ⌘K / Ctrl+K comes back to it
 * (HUB-37); scrolled away, the shortcut opens the omnibox as on every other page. Enter or the button goes to
 * the results page.
 */
export function HubSearch() {
  const t = useTranslations("hub");
  const router = useRouter();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) return;
      const el = input.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= window.innerHeight) return;
      // capture phase on window: the omnibox's listener never sees this one
      e.preventDefault();
      e.stopPropagation();
      el.focus();
      el.select();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div className="hub-search-wrap">
      <form
        role="search"
        aria-label={t("searchLabel")}
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
        className="hub-search"
      >
        <Icon name="search" size={18} className="shrink-0 text-t3" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          aria-keyshortcuts="Meta+K Control+K"
          title={t("searchKeys")}
          dir="auto"
          enterKeyHint="search"
          className="hub-search-input"
        />
        <button type="submit" className="hub-search-go" aria-label={t("searchSubmit")}>
          <span aria-hidden="true">↵</span>
        </button>
      </form>
      <p className="hub-search-try">
        <span>{t("searchTry")}</span>
        {t("searchExamples")
          .split(" | ")
          .map((x) => (
            <Link key={x} href={`/search?q=${encodeURIComponent(x)}`} prefetch={false} className="hub-try" dir="auto" lang={/[a-z]/i.test(x) ? "en" : "ar"}>
              {x}
            </Link>
          ))}
      </p>
    </div>
  );
}
