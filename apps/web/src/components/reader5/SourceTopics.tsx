"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { encodeSeed } from "@/lib/graph/seedCodec";
import { creditLine, QURANPEDIA, type VerseTopics } from "@/lib/graph/topics";
import { getJSON } from "@/lib/reader/api";

/** The topics the sources gather a verse under (P8.3, P8.3b): the taxonomy in force, read once for the verse's
 * knowledge layer and its Topic tool alike. */
export function useVerseTopics(verseKey: string) {
  return useQuery({ queryKey: ["verse-topics", verseKey], queryFn: () => getJSON<VerseTopics>(`/verses/${verseKey}/topics`), staleTime: 10 * 60_000 });
}

/** A verse's topics from the sources: each with the topic above it and what the editorial board did to it (named it,
 * or placed the verse after QSAC's suggestion), opened as a topic map; every source credited, Quranpedia with the
 * version of its data; said when there is none — Quranpedia's index barely goes past sūra 39. */
export function SourceTopics({ data }: { data: VerseTopics }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const sources = Object.entries(data.sources).sort(([a], [b]) => (a === QURANPEDIA ? -1 : b === QURANPEDIA ? 1 : a.localeCompare(b)));
  return (
    <>
      {data.data.length === 0 ? (
        <p className="text-[12.5px] text-t3">{t("topicsNoneHere")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {data.data.map((x) => (
            <li key={x.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[14px] text-t1" lang="ar">{x.name}</span>
              {x.parent_name && <span className="text-[11.5px] text-t3" lang="ar">{x.parent_name}</span>}
              {(x.via === "qsac" || x.board?.named) && <span className="text-[11px] text-t3">{t(x.via === "qsac" ? "topicBoardPlaced" : "topicBoardNamed")}</span>}
              <Link href={`/graph/seed?s=${encodeSeed({ seed: "topic", topic: x.id })}`} className="text-[11.5px] text-word hover:underline">
                {t("topicMap")}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {sources.map(([id, c]) => (
        <p key={id} className="text-[11px] text-t3">
          <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline">{id === QURANPEDIA ? creditLine(c, locale) : locale === "ar" ? c.attribution_ar : c.attribution_en}</a>
        </p>
      ))}
    </>
  );
}
