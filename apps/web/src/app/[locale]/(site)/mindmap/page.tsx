import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MindMap, type MindData } from "@/components/stats/MindMap";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { localized } from "@/lib/seo";

// the word or the root comes from the address
export const dynamic = "force-dynamic";

type Family = { pattern: { slug: string; ar: { full: string } } | null; members: { slug: string; ar: { full: string }; occurrences: number }[] }[];

async function load(word: string, root: string): Promise<MindData | null> {
  if (word) {
    const w = await api<{ slug: string; ar: { full: string }; corpus_freq: number; root: { key: string; ar_spaced: string; occurrences: number } | null; pattern: { slug: string; ar: { full: string } } | null; family: Family }>(`/words/${encodeURIComponent(word)}?limit=0`);
    const [rel, topics] = await Promise.all([
      api<{ defined?: Record<"near" | "related" | "opposite", { slug: string; word: { ar: string; occurrences: number } }[]> }>(`/words/${encodeURIComponent(word)}/relations`),
      api<{ recurring: { id: string; name: string; word_verses: number }[] }>(`/words/${encodeURIComponent(word)}/topics`),
    ]);
    return { kind: "word", word: { slug: w.slug, ar: w.ar.full, count: w.corpus_freq }, root: w.root ? { key: w.root.key, spaced: w.root.ar_spaced, count: w.root.occurrences } : null, pattern: w.pattern ? { slug: w.pattern.slug, ar: w.pattern.ar.full } : null, family: w.family, defined: rel.defined ?? { near: [], related: [], opposite: [] }, topics: topics.recurring };
  }
  if (root) {
    const f = await api<{ root: { key: string; ar_spaced: string; occurrences: number }; family: Family }>(`/roots/${encodeURIComponent(root)}/family`);
    return { kind: "root", root: { key: f.root.key, spaced: f.root.ar_spaced, count: f.root.occurrences }, family: f.family };
  }
  return null;
}

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/mindmap">): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "stats" });
  const q = typeof sp.word === "string" ? `?word=${encodeURIComponent(sp.word)}` : typeof sp.root === "string" ? `?root=${encodeURIComponent(sp.root)}` : "";
  return { title: t("mindTitle"), description: t("mindLead"), alternates: localized(locale, `/mindmap${q}`) };
}

/** A word's or a root's mind map (P16.4, PV-17): its data around it as a radial tree, every node leading on. */
export default async function MindMapPage({ params, searchParams }: PageProps<"/[locale]/mindmap">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("stats");
  const word = typeof sp.word === "string" ? sp.word.slice(0, 80) : "";
  const root = typeof sp.root === "string" ? sp.root.slice(0, 8) : "";
  if (!word && !root) notFound();
  const data = await load(word, root);
  if (!data) notFound();
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-1.5">
        <nav className="text-[12px] text-t3">
          <Link href="/stats" className="hover:underline">{t("title")}</Link>
        </nav>
        <h1 className="text-[22px] font-semibold">{t("mindTitle")}</h1>
        <p className="max-w-[760px] text-[13px] leading-relaxed text-t2">{t("mindLead")}</p>
      </header>
      <MindMap data={data} />
    </div>
  );
}
