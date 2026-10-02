"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/Icon";
import { TafsirSection } from "./TafsirSection";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { useReader } from "@/lib/reader/store";
import { useAudio } from "@/lib/store/audio";

type Related = { data: { verse_id: number; score: number; shared: number; roots: string[]; verse: { key: string; surah: number; ayah: number; text_qpc: string; name_ar: string } }[] };

/**
 * Verse mode (P2.5a) — the vision's "click a verse → its tafsir", which the prototype lacked (RDR-556):
 * tafsirs side by side or one at a time, recitation, the verse's roots, related verses ranked by the
 * rarity of the roots they share, and cite.
 */
export function VerseEntry({ verseKey }: { verseKey: string }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const playVerse = useAudio((s) => s.playVerse);
  const setCite = useReader((s) => s.setCite);
  const related = useQuery({ queryKey: ["related", verseKey], queryFn: () => getJSON<Related>(`/verses/${verseKey}/related?limit=6`) });
  return (
    <article className="flex flex-col gap-3 p-3.5" aria-label={t("verseTitle", { ref: verseKey })}>
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-medium">{t("verseTitle", { ref: verseKey })}</h2>
        <span className="flex-1" />
        <button type="button" className="btn" onClick={() => void playVerse(verseKey)}>
          <Icon name="play" size={13} />
          {t("listen")}
        </button>
        <button type="button" className="btn" onClick={() => setCite({ kind: "verse", key: verseKey, label: verseKey })}>
          <Icon name="quote" size={13} />
          {t("cite")}
        </button>
      </header>
      <section className="layer">
        <div className="layer-head"><span className="text-[13.5px] font-medium">{t("tafsir")}</span></div>
        <div className="layer-body">
          <TafsirSection verseKey={verseKey} />
        </div>
      </section>
      <section className="layer">
        <div className="layer-head">
          <span className="text-[13.5px] font-medium">{t("relatedVerses")}</span>
          <span className="text-[11.5px] text-t3">{t("relatedMethod")}</span>
        </div>
        <div className="layer-body flex flex-col gap-2">
          {(related.data?.data ?? []).map((r) => (
            <Link key={r.verse.key} href={`/quran/${r.verse.surah}/${r.verse.ayah}`} className="related-row">
              <span className="flex items-center gap-2 text-[11.5px] text-t3">
                <span className="mono" dir="ltr">{r.verse.key}</span>
                <span>{r.verse.name_ar}</span>
                <span className="flex-1" />
                <span className="ar-classical text-[13px] text-root" lang="ar">{r.roots.slice(0, 4).join(" · ")}</span>
              </span>
              <span className="quran line-clamp-2 text-[18px] leading-[2]" lang="ar" dir="rtl">{r.verse.text_qpc}</span>
            </Link>
          ))}
          {related.data && related.data.data.length === 0 && <p className="text-[12.5px] text-t3">{t("noRelated")}</p>}
          {related.data && <p className="text-[11px] text-t3">{t("relatedNote", { n: formatNumber(related.data.data.length, locale) })}</p>}
        </div>
      </section>
    </article>
  );
}
