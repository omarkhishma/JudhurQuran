"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Omnibox } from "./Omnibox";

export function SearchLauncher() {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "/" && !open) {
        const el = e.target as HTMLElement | null;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
        e.preventDefault();
        setOpen(true);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("judhur:open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("judhur:open-search", onOpen);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn min-w-[40px] gap-2 md:min-w-[150px] md:justify-between"
        onClick={() => setOpen(true)}
        aria-label={t("search")}
        aria-keyshortcuts="Meta+K Control+K"
      >
        <span className="flex items-center gap-2">
          <Icon name="search" />
          <span className="hidden md:inline">{t("search")}</span>
        </span>
        <kbd className="mono hidden rounded border border-line px-1 text-[10.5px] text-t3 md:inline" dir="ltr">
          ⌘K
        </kbd>
      </button>
      {open && <Omnibox onClose={() => setOpen(false)} />}
    </>
  );
}
