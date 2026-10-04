import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cnt } from "@/lib/format";
import { refText } from "@/lib/hadith";
import { type RootHit, type RootInTexts as Data, hitHref, rootTextsHref } from "@/lib/rootlife";

/** One passage holding the root: its words around the root's word, the word marked; where it stands. */
export function KwicRow({ h }: { h: RootHit }) {
  const t = useTranslations("rootTexts");
  const locale = useLocale();
  const where = h.text.kind === "hadith" ? t("whereHadith", { book: locale === "ar" ? h.text.title_ar : h.text.title_en, ref: refText(h.ref, locale) }) : t("whereBook", { book: h.text.title_ar });
  return (
    <li>
      <Link href={hitHref(h)} className="result-row" data-uri={h.uri}>
        <span className="dot" style={{ background: h.text.kind === "hadith" ? "var(--c-sentence)" : "var(--c-desc)" }} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {h.kwic ? (
            <span className="kwic-line ar-classical text-[17px] leading-[1.9]" lang="ar" dir="rtl">
              <span className="text-t2">{h.kwic.before}</span>
              <mark className="kwic-word">{h.kwic.word}</mark>
              <span className="text-t2">{h.kwic.after}</span>
            </span>
          ) : (
            <span className="text-[13px] text-t3">{t("noLine")}</span>
          )}
          <span className="text-[11.5px] text-t3">
            <bdi lang="ar">{where}</bdi>
            {h.top.title_ar && (
              <>
                {" — "}
                <bdi lang="ar">{h.top.title_ar}</bdi>
              </>
            )}
            {!h.sure && <span className="state-chip ms-2">{t("possibleChip")}</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * A root across the texts (P11.4b), shown on its Quran and dictionary pages: in the hadith and in the books, how many
 * passages hold it — the sure apart from the possible — by text, its first passages with the word marked, and the
 * way to all of them.
 */
export function RootInTexts({ data }: { data: Data }) {
  const t = useTranslations("rootTexts");
  const locale = useLocale();
  const key = data.root.key;
  const h = data.totals.hadith;
  const b = data.totals.book;
  if (!h && !b) {
    return (
      <section className="mt-8" aria-labelledby="texts-h">
        <h2 id="texts-h" className="mb-2 text-[17px] font-semibold">{t("title")}</h2>
        <p className="text-[14px] text-t2">{t("none")}</p>
      </section>
    );
  }
  return (
    <section className="mt-8" aria-labelledby="texts-h">
      <h2 id="texts-h" className="mb-1 text-[17px] font-semibold">{t("title")}</h2>
      <p className="mb-3 max-w-[75ch] text-[12.5px] leading-relaxed text-t3">{t("lead")}</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {(["hadith", "book"] as const).map((k) => {
          const x = data.totals[k];
          if (!x) return null;
          return (
            <div key={k} className="card flex flex-col gap-2 p-4" data-kind={k}>
              <p className="text-[14px] font-semibold">{t(k === "hadith" ? "inHadith" : "inBooks")}</p>
              <p className="text-[13px] text-t2">
                {t("sureCount", cnt(x.sure, locale))}
                {x.possible > 0 && <> • {t("possibleCount", cnt(x.possible, locale))}</>}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {data.counts
                  .filter((c) => c.kind === k && c.sure + c.possible > 0)
                  .sort((a, z) => z.sure - a.sure)
                  .slice(0, 8)
                  .map((c) => (
                    <li key={c.slug}>
                      <Link href={rootTextsHref(key, { kind: k, text: c.slug, which: c.sure ? "sure" : "possible" })} className="chip" lang="ar">
                        {c.title_ar} <span className="text-t3">{new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en").format(c.sure || c.possible)}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
              <Link href={rootTextsHref(key, { kind: k })} className="self-start text-[12.5px] text-ring hover:underline">
                {t(k === "hadith" ? "allHadith" : "allBooks")}
              </Link>
            </div>
          );
        })}
      </div>
      {data.data.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={t("first")}>
          {data.data.map((x) => (
            <KwicRow key={x.uri} h={x} />
          ))}
        </ul>
      )}
      <p className="mt-3">
        <Link href={rootTextsHref(key)} className="btn">{t("all", cnt((h?.sure ?? 0) + (b?.sure ?? 0), locale))}</Link>
      </p>
    </section>
  );
}
