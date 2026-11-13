"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Link, useRouter } from "@/i18n/navigation";
import { looksLikeQuestion } from "@/lib/ask";
import { useSuggestions } from "@/components/search/Omnibox";

/**
 * The hub's search, the primary action (06 §6.1, HUB-05, Q03): it teaches the Quran's own queries — a word,
 * root letters, a verse reference in digits or by sūra name — with examples under it that are links, so a
 * phone shows them too, where a long placeholder is cut. While it is on screen ⌘K / Ctrl+K comes back to it
 * (HUB-37); scrolled away, the shortcut opens the omnibox as on every other page. Enter or the button goes to
 * the results page. While the reader types, what the query suggests opens under it — the omnibox's rows, a word with
 * its root first — so the answer is one step away, not a page of lists (audit 27 F05).
 */
export function HubSearch() {
  const t = useTranslations("hub");
  const router = useRouter();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const { items } = useSuggestions(q);
  const shown = open && q.trim() ? items.slice(0, 7) : [];

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
          // the suggestion chosen with the arrows opens itself; otherwise a question goes to «اسأل القرآن» (P18), a word,
          // a root or a verse to the search
          if (shown[active]) router.push(shown[active].href);
          else if (q.trim()) router.push(`/${looksLikeQuestion(q) ? "ask" : "search"}?q=${encodeURIComponent(q.trim())}`);
        }}
        className="hub-search"
      >
        <Icon name="search" size={18} className="shrink-0 text-t3" />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && shown.length) {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, shown.length - 1));
            } else if (e.key === "ArrowUp" && shown.length) {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, -1));
            } else if (e.key === "Escape") setOpen(false);
          }}
          role="combobox"
          aria-expanded={shown.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
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
      {shown.length > 0 && (
        <ul id={listId} role="listbox" aria-label={t("searchLabel")} className="hub-suggest popover">
          {shown.map((it, i) => (
            <li
              key={it.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // the input keeps the focus: a press opens the row before the blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                router.push(it.href);
              }}
              onMouseEnter={() => setActive(i)}
              className="hub-suggest-row"
            >
              <span className="w-14 shrink-0 text-[11.5px] text-t3">{it.kind}</span>
              <span className="min-w-0 flex-1 truncate">{it.primary}</span>
              {it.secondary && <span className="shrink-0 text-[12px] text-t3">{it.secondary}</span>}
            </li>
          ))}
        </ul>
      )}
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
      <p className="hub-search-try">
        <span>{t("askTry")}</span>
        <Link href={`/ask?q=${encodeURIComponent(t("askExample"))}`} prefetch={false} className="hub-try" dir="auto">
          {t("askExample")}
        </Link>
      </p>
    </div>
  );
}
