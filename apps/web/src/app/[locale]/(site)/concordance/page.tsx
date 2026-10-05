import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConcordanceScreen } from "@/components/concordance/ConcordanceScreen";
import { type ConcordancePage, concordanceQuery, DEFAULT_ROOT, type Filters } from "@/lib/concordance";
import { KwicRow } from "@/components/rootlife/RootInTexts";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cnt } from "@/lib/format";
import { GraderFilter } from "@/components/rootlife/GraderFilter";
import { type GraderRulings, graderTerm, type RootInTexts, rootTextsHref } from "@/lib/rootlife";

export async function generateMetadata({ params }: PageProps<"/[locale]/concordance">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "concordance" });
  return { title: t("title"), robots: { index: false, follow: true } };
}

// Lines depend on the query string: rendered per request (the API calls themselves are cached).
export const dynamic = "force-dynamic";

// The translation an English reader sees in the line tooltips until their own choice is read (usePrefs).
const DEFAULT_TRANSLATION = "saheeh";

/** The concordance (design 05 §5.3). The root comes from `?root=`, else from the word in `?w=`, else from
 * the reader's trail on the client, else ع ل م — arriving from the reader never shows an empty page
 * (CON-05). The first page of lines renders on the server. */
export default async function ConcordanceRoute({ params, searchParams }: PageProps<"/[locale]/concordance">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 80) : "");
  let root = s("root").replace(/[\s\-ـ]/g, "");
  if (!root && s("w")) {
    const w = await api<{ root: { key: string } | null }>(`/words/${encodeURIComponent(s("w"))}?limit=0`).catch(() => null);
    root = w?.root?.key ?? "";
  }
  const initial: Filters = {
    root,
    lemma: s("lemma"),
    pattern: s("pattern"),
    surah: s("surah"),
    surah_to: s("surah_to"),
    place: s("place"),
    juz: s("juz"),
    juz_to: s("juz_to"),
    pos: s("pos"),
    form: s("form"),
    near: s("near"),
    sort: s("sort") || "mushaf",
    view: s("view") === "dist" ? "dist" : "kwic",
  };
  // the source (P11.4b): the Quran's lines, or the root's passages in the hadith or the books
  const source = s("source") === "hadith" || s("source") === "book" ? (s("source") as "hadith" | "book") : "quran";
  const t = await getTranslations("concordance");
  const sourceNav = (key: string) => (
    <nav aria-label={t("sourceLabel")} className="mx-auto mb-3 flex max-w-[1180px] flex-wrap items-center gap-2 px-4 pt-6">
      <span className="label-caps">{t("sourceLabel")}</span>
      {(["quran", "hadith", "book"] as const).map((x) => (
        <Link
          key={x}
          href={`/concordance?root=${encodeURIComponent(key)}${x === "quran" ? "" : `&source=${x}`}`}
          className={`chip${source === x ? " is-on" : ""}`}
          aria-current={source === x ? "page" : undefined}
        >
          {t(x === "quran" ? "sourceQuran" : x === "hadith" ? "sourceHadith" : "sourceBooks")}
        </Link>
      ))}
    </nav>
  );
  if (source !== "quran") {
    const key = root || DEFAULT_ROOT;
    // the hadith by one grader's ruling (B57)
    const grader = source === "hadith" ? graderTerm(s("grader")) : null;
    const ruling = grader ? graderTerm(s("ruling")) : null;
    const graded = grader && ruling ? `&grader=${encodeURIComponent(grader)}&ruling=${encodeURIComponent(ruling)}` : "";
    const d = await api<RootInTexts>(`/roots/${encodeURIComponent(key)}/texts?kind=${source}&limit=40${graded}`).catch(() => null);
    const graders = source === "hadith" ? (await api<{ data: GraderRulings[] }>("/hadith/rulings").catch(() => ({ data: [] }))).data : [];
    const tt = await getTranslations("rootTexts");
    return (
      <>
        {sourceNav(key)}
        <div className="mx-auto max-w-[1180px] px-4 pb-10">
          <h1 className="mb-1 text-[22px] font-semibold">
            {tt(source === "hadith" ? "inHadith" : "inBooks")} — <span className="ar-classical text-root" lang="ar">{d?.root.display ?? key}</span>
          </h1>
          {source === "hadith" && (
            <div className="mb-3">
              <GraderFilter
                graders={graders}
                grader={grader}
                ruling={ruling}
                href={(g, r) => `/concordance?root=${encodeURIComponent(key)}&source=hadith${g ? `&grader=${encodeURIComponent(g)}` : ""}${g && r ? `&ruling=${encodeURIComponent(r)}` : ""}`}
                locale={locale}
              />
            </div>
          )}
          {d ? (
            <>
              <p className="mb-3 text-[13px] text-t3" aria-live="polite">{tt("found", cnt(d.total, locale))}</p>
              {d.data.length ? (
                <ul className="flex flex-col gap-2">
                  {d.data.map((h) => (
                    <KwicRow key={h.uri} h={h} />
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-t2">{tt("none")}</p>
              )}
              <p className="mt-4">
                <Link href={rootTextsHref(d.root.key, { kind: source, grader, ruling })} className="btn">{t("textsMore")}</Link>
              </p>
            </>
          ) : (
            <p className="text-[14px] text-t2">{tt("none")}</p>
          )}
        </div>
      </>
    );
  }
  const qs = concordanceQuery(root || DEFAULT_ROOT, initial, { sort: initial.sort, limit: "60", tr: locale === "ar" ? "" : DEFAULT_TRANSLATION });
  // An unknown root or a bad filter renders the screen with its own message, not a 404 page.
  const initialPage = await api<ConcordancePage>(`/concordance?${qs}`).catch(() => null);
  return (
    <>
      {root && sourceNav(root)}
      <ConcordanceScreen initial={initial} initialPage={initialPage} initialTr={DEFAULT_TRANSLATION} />
    </>
  );
}
