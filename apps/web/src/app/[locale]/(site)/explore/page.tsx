import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExploreScreen } from "@/components/explore/ExploreScreen";
import { api } from "@/lib/api";
import type { PathIndex, PathLesson, SetCard, SetDetail } from "@/lib/collections";
import { meccaToday, type WordOfTheDay } from "@/lib/daily";
import { localized } from "@/lib/seo";

// the set comes from the URL (?set=), and the word of the day from today's date in Mecca
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/explore">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "explore" });
  return { title: t("title"), alternates: localized(locale, "/explore") };
}

/** The day's label in Mecca's calendar day: the Gregorian date and the Hijri (Umm al-Qurā) one (COL-10, COL-Q01).
 * Formatted here, once, so the browser shows exactly what the server rendered. */
function dayLabel(date: string, locale: string): { date: string; hijri: string } {
  const d = new Date(`${date}T12:00:00+03:00`);
  const opts = { day: "numeric", month: "long", timeZone: "Asia/Riyadh" } as const;
  return {
    date: new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", opts).format(d),
    hijri: new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-islamic-umalqura" : "en-GB-u-ca-islamic-umalqura", { ...opts, year: "numeric" }).format(d),
  };
}

export default async function ExplorePage({ params, searchParams }: PageProps<"/[locale]/explore">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("explore");
  const sp = await searchParams;
  const setId = typeof sp.set === "string" && /^[a-z0-9-]{1,40}$/.test(sp.set) ? sp.set : null;
  const lessonN = typeof sp.path === "string" && /^[1-9]\d{0,3}$/.test(sp.path) ? Number(sp.path) : null;
  const [sets, word, set, path, lesson] = await Promise.all([
    api<{ data: SetCard[] }>("/collections"),
    api<WordOfTheDay>(`/word-of-the-day?date=${meccaToday()}`).catch(() => null),
    setId ? api<SetDetail>(`/collections/${setId}`).catch(() => null) : Promise.resolve(null),
    api<PathIndex>("/path").catch(() => null),
    lessonN ? api<PathLesson>(`/path/${lessonN}`).catch(() => null) : Promise.resolve(null),
  ]);
  const label = word ? t("wotdDate", dayLabel(word.date, locale)) : "";
  return <ExploreScreen sets={sets.data} word={word} wotdLabel={label} setId={setId} initialSet={set} path={path} lessonN={lessonN} initialLesson={lesson} />;
}
