"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/Icon";
import { useAudio } from "@/lib/store/audio";
import { formatNumber } from "@/lib/format";
import { useIsClient } from "@/lib/client";

type Reciter = { id: string; name_ar: string; name_en: string; style: string; is_default: boolean };

/** Reader recitation bar: play from the first visible verse, step verses, choose a reciter, follow words. */
export function AudioBar({ surah, surahName }: { surah: number; surahName: string }) {
  const t = useTranslations("audio");
  const locale = useLocale();
  const client = useIsClient();
  const a = useAudio();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["reciters"],
    queryFn: async () => ((await (await fetch("/api/v1/recitations")).json()) as { data: Reciter[] }).data,
  });
  const active = a.surah === surah && (a.playing || a.queue.length > 0) && a.mode !== "word";
  const verse = active ? a.queue[a.index] : null;
  const reciter = data?.find((r) => r.id === a.reciter);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Play starts at the open verse, else the first verse on screen in the reading surface.
  function firstVisibleAyah(): number {
    const hot = document.querySelector<HTMLElement>(".passage[data-hot]");
    if (hot?.dataset.verse) return Number(hot.dataset.verse.split(":")[1]);
    const surface = document.querySelector<HTMLElement>(".reader-surface");
    const edge = (surface?.getBoundingClientRect().top ?? 0) + 40;
    const verses = Array.from(document.querySelectorAll<HTMLElement>(".passage"));
    const top = verses.find((v) => v.getBoundingClientRect().bottom > edge);
    return Number((top?.dataset.verse ?? `${surah}:1`).split(":")[1]);
  }

  function toggle() {
    if (active && a.playing) a.pause();
    else if (active) a.resume();
    else void a.playSurah(surah, firstVisibleAyah());
  }

  function step(dir: 1 | -1) {
    if (!active) return;
    const i = a.index + dir;
    if (i >= 0 && i < a.queue.length) a.set({ index: i, inBasmala: false, token: null, playing: true });
  }

  return (
    <div className="sticky bottom-0 z-20 border-t border-line bg-panel/95 backdrop-blur" role="region" aria-label={t("barLabel")}>
      <div className="mx-auto flex max-w-[860px] items-center gap-2 px-3 py-2">
        <button type="button" className="btn icon-btn" onClick={() => step(-1)} disabled={!active} aria-label={t("prevVerse")}>
          <Icon name="chevronStart" />
        </button>
        <button
          type="button"
          className="btn btn-primary h-10 min-w-[44px] rounded-full px-4"
          onClick={toggle}
          aria-label={active && a.playing ? t("pause") : t("play")}
        >
          <Icon name={active && a.playing ? "pause" : "play"} />
          <span className="hidden sm:inline">{active && a.playing ? t("pause") : t("play")}</span>
        </button>
        <button type="button" className="btn icon-btn" onClick={() => step(1)} disabled={!active} aria-label={t("nextVerse")}>
          <Icon name="chevronEnd" />
        </button>
        <button type="button" className="btn mono min-w-[52px] text-[12px]" onClick={a.cycleSpeed} title={t("speed")} aria-label={`${t("speed")} ${a.speed}×`}>
          {`${client ? a.speed : 1}×`}
        </button>
        <button type="button" className="btn icon-btn" aria-pressed={client && a.repeat} onClick={() => a.setRepeat(!a.repeat)} title={t("repeat")} aria-label={t("repeat")}>
          <Icon name="repeat" />
        </button>
        <span className="min-w-0 flex-1 truncate text-[13px] text-t2" aria-live="polite">
          {active && (a.inBasmala ? t("basmala") : verse ? t("nowPlaying", { ref: `${surahName}: ${formatNumber(verse.ayah, locale)}` }) : "")}
        </span>
        <div className="relative">
          <button type="button" className="btn max-w-[46vw] truncate" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={t("reciter")}>
            {client && reciter ? (locale === "ar" ? reciter.name_ar : reciter.name_en) : t("reciter")}
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
              <div className="popover absolute bottom-12 end-0 z-40 max-h-[60vh] w-[290px] max-w-[calc(100vw-24px)] overflow-y-auto p-1.5" role="listbox" aria-label={t("reciter")}>
                {data?.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="option"
                    aria-selected={r.id === a.reciter}
                    className={"flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 text-start text-[14px] hover:bg-card-2 " + (r.id === a.reciter ? "bg-card-2 font-medium" : "")}
                    onClick={() => {
                      a.setReciter(r.id);
                      setOpen(false);
                    }}
                  >
                    {locale === "ar" ? r.name_ar : r.name_en}
                    <span className="text-[11.5px] text-t3">{t(r.style as "murattal" | "mujawwad" | "muallim")}</span>
                  </button>
                ))}
                <label className="mt-1 flex min-h-[44px] cursor-pointer items-center gap-2 border-t border-line px-3 text-[13px]">
                  <input type="checkbox" checked={a.follow} onChange={(e) => a.setFollow(e.target.checked)} />
                  {t("follow")}
                </label>
                <Link href="/sources" className="block px-3 pb-2 text-[11px] text-t3 hover:underline">{t("credit")}</Link>
              </div>
            </>
          )}
        </div>
      </div>
      {a.error && <p className="pb-2 text-center text-[12px] text-bad" role="alert">{t("error")}</p>}
    </div>
  );
}
