"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { WordAudioNote } from "@/components/reader5/Listen";
import { Link } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import { type HearItem, useAudio } from "@/lib/store/audio";

type Playlist = { subject: { key?: string; slug?: string }; reciter: { name_ar: string; name_en: string } | null; items: HearItem[]; untimed: number; total: number };

/**
 * Hear the root (PLAN §8 B4): every occurrence of a root — or of one word — in the order of the mushaf, each as its
 * slice of the word recitation (D10), the one the reader plays word by word. The family heard across the Quran is
 * a memory aid. What keeps a slice from being clean is said under it; occurrences with no timed recording are
 * counted, never silently dropped. `bar` sits at the foot of a page; `inline` lives in the reader's panel, whose
 * foot belongs to the recitation bar.
 */
export function HearPlaylist({ root, lemma, variant = "bar" }: { root?: string; lemma?: string; variant?: "bar" | "inline" }) {
  const t = useTranslations("audio");
  const locale = useLocale();
  const client = useIsClient();
  const id = root ? `root:${root}` : `lemma:${lemma}`;
  const mine = useAudio((s) => s.mode === "playlist" && s.list === id && s.queue.length > 0);
  const playList = useAudio((s) => s.playList);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const [meta, setMeta] = useState<Pick<Playlist, "untimed" | "total" | "reciter"> | null>(null);

  async function start() {
    setState("loading");
    try {
      const r = await fetch(`/api/v1/hear?${root ? `root=${encodeURIComponent(root)}` : `lemma=${encodeURIComponent(lemma!)}`}`);
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as Playlist;
      setMeta({ untimed: d.untimed, total: d.total, reciter: d.reciter });
      setState("idle");
      playList(id, d.items);
    } catch {
      setState("failed");
    }
  }

  const label = root ? t("hearRoot") : t("hearWord");
  return (
    <>
      <span className="inline-flex flex-wrap items-center gap-2">
        <button type="button" className="btn min-h-[40px]" onClick={() => void start()} disabled={state === "loading"} aria-pressed={client && mine}>
          <Icon name="speaker" />
          {state === "loading" ? t("hearLoading") : label}
        </button>
        {state === "failed" && (
          <span className="text-[12.5px] text-bad" role="alert">
            {t("hearFailed")}
          </span>
        )}
      </span>
      {client && mine && <HearPlayer variant={variant} meta={meta} locale={locale} />}
    </>
  );
}

function HearPlayer({ variant, meta, locale }: { variant: "bar" | "inline"; meta: Pick<Playlist, "untimed" | "total" | "reciter"> | null; locale: string }) {
  const t = useTranslations("audio");
  const queue = useAudio((s) => s.queue);
  const index = useAudio((s) => s.index);
  const playing = useAudio((s) => s.playing);
  const { pause, resume, stop, stepList } = useAudio.getState();
  const x = queue[index]?.item;
  if (!x) return null;
  const ar = locale === "ar";
  const reciter = meta?.reciter ? (ar ? meta.reciter.name_ar : meta.reciter.name_en) : null;
  return (
    <div className={variant === "bar" ? "hear-bar" : "hear-inline"} role="region" aria-label={t("hearPlayer")}>
      <div className="hear-now">
        <span className="ar-classical text-[24px] leading-tight text-word" lang="ar" dir="rtl">
          {x.surface}
        </span>
        <span className="flex min-w-0 flex-col">
          <Link href={`/quran/${x.surah.number}/${x.ayah}`} prefetch={false} className="truncate text-[12.5px] text-t2 underline-offset-2 hover:underline">
            {ar ? x.surah.name_ar : x.surah.name_translit} {verseRef(x.verse_key, locale)}
          </Link>
          <span className="mono text-[11.5px] text-t3">{t("hearOf", { n: formatNumber(index + 1, locale), of: formatNumber(queue.length, locale) })}</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" className="btn icon-btn" onClick={() => stepList(-1)} disabled={index === 0} aria-label={t("hearPrev")}>
          <Icon name="chevronStart" />
        </button>
        <button type="button" className="btn btn-primary h-10 min-w-[44px] rounded-full" onClick={() => (playing ? pause() : resume())} aria-label={playing ? t("pause") : t("play")}>
          <Icon name={playing ? "pause" : "play"} />
        </button>
        <button type="button" className="btn icon-btn" onClick={() => stepList(1)} disabled={index + 1 >= queue.length} aria-label={t("hearNext")}>
          <Icon name="chevronEnd" />
        </button>
        <button type="button" className="btn icon-btn" onClick={stop} aria-label={t("hearStop")}>
          <Icon name="close" />
        </button>
      </div>
      <div className="hear-notes">
        {reciter && <span>{t("hearBy", { reciter })}</span>}
        {meta && meta.untimed > 0 && <span>{t("hearUntimed", cnt(meta.untimed, locale))}</span>}
        <WordAudioNote audio={x.audio} />
      </div>
    </div>
  );
}
