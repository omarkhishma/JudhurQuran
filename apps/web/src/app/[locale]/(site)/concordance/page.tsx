import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConcordanceScreen } from "@/components/concordance/ConcordanceScreen";
import { type ConcordancePage, concordanceQuery, DEFAULT_ROOT, type Filters } from "@/lib/concordance";
import { api } from "@/lib/api";

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
    place: s("place"),
    juz: s("juz"),
    pos: s("pos"),
    form: s("form"),
    near: s("near"),
    sort: s("sort") || "mushaf",
    view: s("view") === "dist" ? "dist" : "kwic",
  };
  const qs = concordanceQuery(root || DEFAULT_ROOT, initial, { sort: initial.sort, limit: "60", tr: locale === "ar" ? "" : DEFAULT_TRANSLATION });
  // An unknown root or a bad filter renders the screen with its own message, not a 404 page.
  const initialPage = await api<ConcordancePage>(`/concordance?${qs}`).catch(() => null);
  return <ConcordanceScreen initial={initial} initialPage={initialPage} initialTr={DEFAULT_TRANSLATION} />;
}
