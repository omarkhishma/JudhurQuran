"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { readWords } from "@/components/library/AddTextSheet";
import { Link } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { cnt } from "@/lib/format";
import { words } from "@/lib/library/segment";
import { type FormResult, listTexts, loadText, type UserText } from "@/lib/library/texts";
import { rootTextsHref } from "@/lib/rootlife";

const AROUND = 6;
// the forms the shared rules read as the Quran's own, alone or with their clitics: «sure», as the hadith's and the books'
const SURE: FormResult["kind"][] = ["form", "clitic"];

type Hit = { id: string; title: string; passage: number; before: string; word: string; after: string; sure: boolean };

/** A reader's text read as its reader reads it — the same request and the same cache (UserTextReader) — and the places
 * whose word reads to the root. */
function hitsIn(doc: UserText, read: { r: FormResult | undefined }[], dictKey: string): Hit[] {
  const out: Hit[] = [];
  let k = 0;
  doc.passages.forEach((p, pi) => {
    const ws = words(p);
    ws.forEach((w, wi) => {
      const r = read[k++]?.r;
      if (!r || r.kind === "particle" || r.dict_root !== dictKey) return;
      out.push({
        id: doc.id,
        title: doc.title,
        passage: pi + 1,
        before: ws.slice(Math.max(0, wi - AROUND), wi).map((x) => x.surface).join(" "),
        word: w.surface,
        after: ws.slice(wi + 1, wi + 1 + AROUND).map((x) => x.surface).join(" "),
        sure: SURE.includes(r.kind),
      });
    });
  });
  return out;
}

/**
 * A root in the reader's own texts (P4.4, beside the hadith and the books of P11.4b): found in this browser — the texts
 * never leave it but to be read word by word, as when the reader opens them — each place with the root's word marked,
 * the sure apart from the possible, linked to its passage. Nothing is shown to a reader with no texts.
 */
export function RootInMyTexts({ dictKey, limit }: { dictKey: string; limit?: number }) {
  const t = useTranslations("rootTexts");
  const locale = useLocale();
  const client = useIsClient();
  const metas = useQuery({ queryKey: ["user-texts"], queryFn: listTexts, enabled: client });
  const docs = useQueries({ queries: (metas.data ?? []).map((m) => ({ queryKey: ["user-text", m.id], queryFn: () => loadText(m.id) })) });
  const reads = useQueries({
    queries: docs.map((d) => {
      const doc = d.data;
      const flat = (doc?.passages ?? []).flatMap((p) => words(p).map((w) => w.word));
      return { queryKey: ["user-text-read", doc?.id, doc?.updatedAt], queryFn: () => readWords(flat.slice(0, 20000)), enabled: !!doc, staleTime: Infinity };
    }),
  });
  if (!client || !metas.data?.length) return null;
  const pending = docs.some((d) => d.isPending) || reads.some((r) => r.isPending);
  const hits = docs.flatMap((d, i) => (d.data && reads[i].data ? hitsIn(d.data, reads[i].data!, dictKey) : []));
  const sure = hits.filter((h) => h.sure);
  const shown = [...sure, ...hits.filter((h) => !h.sure)].slice(0, limit ?? hits.length);
  return (
    <section className="mt-6" aria-labelledby="mine-h" data-testid="root-in-my-texts">
      <h2 id="mine-h" className="mb-1 text-[17px] font-semibold">{t("mineTitle")}</h2>
      <p className="mb-3 max-w-[75ch] text-[12.5px] leading-relaxed text-t3">{t("mineLead")}</p>
      {pending && !hits.length ? (
        <div className="h-16 animate-pulse rounded-lg bg-card-2" role="status" aria-label={t("mineReading")} />
      ) : !hits.length ? (
        <p className="text-[13px] text-t2">{t("mineNone")}</p>
      ) : (
        <>
          <p className="mb-2 text-[13px] text-t2">
            {t("sureCount", cnt(sure.length, locale))}
            {hits.length > sure.length && <> • {t("possibleCount", cnt(hits.length - sure.length, locale))}</>}
          </p>
          <ul className="flex flex-col gap-2" aria-label={t("mineTitle")}>
            {shown.map((h, i) => (
              <li key={`${h.id}:${h.passage}:${i}`}>
                <Link href={`/library/text/${h.id}#p${h.passage}`} className="result-row">
                  <span className="dot" style={{ background: "var(--c-word)" }} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="kwic-line ar-classical text-[17px] leading-[1.9]" lang="ar" dir="rtl">
                      <span className="text-t2">{h.before} </span>
                      <mark className="kwic-word">{h.word}</mark>
                      <span className="text-t2"> {h.after}</span>
                    </span>
                    <span className="text-[11.5px] text-t3">
                      <bdi lang="ar" dir="auto">{t("whereMine", { title: h.title, n: new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en").format(h.passage) })}</bdi>
                      {!h.sure && <span className="state-chip ms-2">{t("possibleChip")}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {limit !== undefined && hits.length > limit && (
            <p className="mt-2">
              <Link href={`${rootTextsHref(dictKey)}#mine-h`} className="text-[12.5px] text-ring hover:underline">
                {t("mineAll", cnt(hits.length, locale))}
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
