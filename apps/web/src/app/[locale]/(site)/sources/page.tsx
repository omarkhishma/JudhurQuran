import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { api } from "@/lib/api";
import type { LexiconWork, Meta, Work } from "@/lib/types";
import { Prose } from "@/components/prose/Prose";
import { formatNumber } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/[locale]/sources">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "ar" ? "المصادر والتراخيص" : "Sources and licenses" };
}

export default async function SourcesPage({ params }: PageProps<"/[locale]/sources">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ar = locale === "ar";
  const [meta, works, lex] = await Promise.all([
    api<Meta>("/meta"),
    api<{ data: Work[] }>("/works"),
    api<{ data: (LexiconWork & { displayed_entries: number })[] }>("/lexicon/works"),
  ]);
  return (
    <Prose>
      <h1>{ar ? "المصادر والتراخيص" : "Sources and licenses"}</h1>
      <p className="lead">
        {ar
          ? "كل ما يظهر في هذا الموقع منسوب إلى مصدره. هذه القائمة تُولَّد من سجل البيانات نفسه الذي تُبنى منه قاعدة البيانات، فلا تختلف عنه."
          : "Everything on this site is credited to its source. This list is generated from the same registry the database is built from, so it cannot drift from it."}
      </p>
      <p className="text-[13px] text-t3">
        {ar ? "إصدار البيانات" : "Dataset version"}: <span className="mono" dir="ltr">{meta.dataset.version}</span> ·{" "}
        {ar ? "بصمة النص القرآني" : "Quran text fingerprint"}: <span className="mono break-all" dir="ltr">{meta.dataset.text_sha256}</span>
      </p>

      <h2>{ar ? "النص والتحليل الصرفي" : "Text and morphology"}</h2>
      {meta.sources.filter((s) => s.kind !== "tafsir-translation" && s.kind !== "tafsir").map((s) => (
        <SourceCard key={s.id} title={ar ? s.title_ar : s.title_en} role={s.role} license={s.license} attribution={ar ? s.attribution_ar : s.attribution_en} url={s.url} version={s.version} />
      ))}

      <h2>{ar ? "التفاسير والترجمات" : "Tafsir and translations"}</h2>
      {works.data.map((w) => (
        <SourceCard
          key={w.id}
          title={`${ar ? w.title_ar : w.title_en} — ${ar ? w.author_ar : w.author_en}`}
          role={w.kind === "tafsir" ? (ar ? "تفسير" : "Tafsir") : ar ? "ترجمة معاني" : "Translation of meanings"}
          license={w.source_license}
          attribution={ar ? w.attribution_ar : w.attribution_en}
          url={w.source_url}
          version={w.version}
        />
      ))}

      <h2>{ar ? "المعاجم وكتب غريب القرآن" : "Dictionaries and gharīb works"}</h2>
      {lex.data.map((w) => (
        <SourceCard
          key={w.id}
          title={`${ar ? w.title_ar : w.title_en} — ${ar ? w.author_ar : w.author_en}`}
          role={`${ar ? "مواد معروضة" : "Articles shown"}: ${formatNumber(w.displayed_entries, locale)}${w.redistributable ? "" : ar ? " · للعرض فقط" : " · display only"}`}
          license={w.license}
          attribution={ar ? w.attribution_ar : w.attribution_en}
          url={w.source_url}
          version={w.edition_note}
        />
      ))}
    </Prose>
  );
}

function SourceCard({ title, role, license, attribution, url, version }: { title: string; role: string; license: string; attribution: string; url: string; version?: string | null }) {
  return (
    <div className="card my-3 p-4 text-[14px] leading-relaxed">
      <p className="font-semibold">{title}</p>
      <p className="text-t2">{role}</p>
      {version && <p className="text-[12.5px] text-t3">{version}</p>}
      <p className="mt-2 text-[13px] text-t2">{license}</p>
      <p className="mt-1 text-[13px]">
        <a href={url} target="_blank" rel="noreferrer">{attribution}</a>
      </p>
    </div>
  );
}
