"use client";

import { useQueries } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { getJSON } from "@/lib/reader/api";
import { verseRef } from "@/lib/format";
import { usePrefs, useReader } from "@/lib/reader/store";
import { useAudio } from "@/lib/store/audio";

/**
 * Reading verse by verse with a screen reader (B9): each verse one stop, named by its reference and its words in
 * today's spelling — which a speech engine reads where it stumbles on the mushaf's — the mushaf's lines and their word
 * buttons taken out of the way of the reader's assistive technology (they stay on screen as they are); ↑ and ↓ between
 * verses, Enter opens the verse, Space recites it; the verse being recited said as it begins. Off, nothing changes.
 */
export function VerseReading({ chapters }: { chapters: number[] }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const on = usePrefs((s) => s.readByVerse);
  // each sūra on the surface (a page of the mushaf may hold more than one, B1), its verses' spelling by their key
  const lines = useQueries({
    queries: chapters.map((c) => ({
      queryKey: ["surah-lines", c, "imlaei"],
      queryFn: () => getJSON<{ data: Record<string, string> }>(`/surahs/${c}/lines?kind=imlaei`),
      enabled: on,
      staleTime: Infinity,
    })),
  });
  const spelling = (key: string) => {
    const [s, a] = key.split(":");
    return lines[chapters.indexOf(Number(s))]?.data?.data[a];
  };
  const stamp = lines.map((l) => l.dataUpdatedAt).join();
  const reciting = useAudio((s) => (s.playing && chapters.includes(s.surah ?? -1) ? (s.queue[s.index]?.key ?? null) : null));
  // the verse being recited, said as it begins (the live region speaks when its words change)
  const said = on && reciting ? t("recitingNow", { ref: verseRef(reciting, locale) }) : "";

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".reading");
    if (!root) return;
    const passages = Array.from(root.querySelectorAll<HTMLElement>(".passage"));
    if (!on) {
      delete root.dataset.read;
      root.querySelectorAll<HTMLElement>(".verse-line[aria-hidden]").forEach((l) => l.removeAttribute("aria-hidden"));
      for (const p of passages) {
        p.removeAttribute("tabindex");
        if (p.dataset.label) p.setAttribute("aria-label", p.dataset.label);
      }
      return;
    }
    root.dataset.read = "verse";
    root.querySelectorAll<HTMLElement>(".w").forEach((w) => w.setAttribute("tabindex", "-1"));
    root.querySelectorAll<HTMLElement>(".verse-line").forEach((l) => l.setAttribute("aria-hidden", "true"));
    passages.forEach((p, i) => {
      p.dataset.label ??= p.getAttribute("aria-label") ?? "";
      if (!p.hasAttribute("tabindex")) p.setAttribute("tabindex", i === 0 ? "0" : "-1");
      const text = spelling(p.dataset.verse ?? "");
      if (text) p.setAttribute("aria-label", `${p.dataset.label}: ${text}`);
    });

    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (!el?.classList.contains("passage") || e.altKey || e.ctrlKey || e.metaKey) return;
      const key = el.dataset.verse ?? "";
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const all = Array.from(root!.querySelectorAll<HTMLElement>(".passage"));
        const to = all[all.indexOf(el) + (e.key === "ArrowDown" ? 1 : -1)];
        if (!to) return;
        e.preventDefault();
        all.forEach((p) => p.setAttribute("tabindex", p === to ? "0" : "-1"));
        to.focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        useReader.getState().openVerse(key);
        usePrefs.getState().set({ panelOpen: true });
      } else if (e.key === " ") {
        e.preventDefault();
        useAudio.getState().playVerse(key);
      }
    }
    root.addEventListener("keydown", onKey);
    return () => root.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the spellings, by when each came
  }, [on, stamp, chapters.join()]);

  return on ? (
    <p className="sr-only" aria-live="polite">
      {said}
    </p>
  ) : null;
}
