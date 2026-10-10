import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AskScreen, type SurahName } from "@/components/ask/AskScreen";
import { api } from "@/lib/api";
import { type AskPayload, askQuery, INTENTS, type Intent, type Reading } from "@/lib/ask";
import { localized } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/ask">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ask" });
  return { title: t("title"), description: t("lead"), alternates: localized(locale, "/ask") };
}

// The answer depends on the question in the address: rendered per request (the API's answer itself is cached).
export const dynamic = "force-dynamic";

/** «اسأل القرآن» (P18.3): a question read and answered from the data; the first answer renders on the server. */
export default async function AskPage({ params, searchParams }: PageProps<"/[locale]/ask">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ask");
  const sp = await searchParams;
  const s = (k: string, max: number) => (typeof sp[k] === "string" ? (sp[k] as string) : "").trim().slice(0, max);
  const q = s("q", 300);
  const intent = s("intent", 20) as Intent;
  const surah = Number(s("surah", 3)) || undefined;
  const place = s("place", 8);
  const reading: Reading | null = (INTENTS as readonly string[]).includes(intent)
    ? { intent, a: s("a", 120) || undefined, b: s("b", 120) || undefined, surah: surah && surah <= 114 ? surah : undefined, place: place === "meccan" || place === "medinan" ? place : undefined }
    : null;
  const [initial, surahs] = await Promise.all([
    q || reading ? api<AskPayload>(`/ask?${askQuery(q, reading)}`, { revalidate: 3600 }).catch(() => null) : Promise.resolve(null),
    api<{ data: SurahName[] }>("/surahs"),
  ]);
  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-5 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-[24px] font-semibold">{t("title")}</h1>
        <p className="text-[13.5px] leading-relaxed text-t2">{t("lead")}</p>
      </header>
      <AskScreen initialQ={q} initialReading={reading} initial={initial} surahs={surahs.data.map((x) => ({ number: x.number, name_ar: x.name_ar, name_translit: x.name_translit }))} />
    </div>
  );
}
