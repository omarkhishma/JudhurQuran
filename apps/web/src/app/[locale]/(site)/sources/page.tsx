import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { api } from "@/lib/api";
import type { LexiconWork, Meta, Work } from "@/lib/types";
import { Prose } from "@/components/prose/Prose";
import { formatNumber } from "@/lib/format";
import { localized } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/sources">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "ar" ? "المصادر والتراخيص" : "Sources and licenses", alternates: localized(locale, "/sources") };
}

export default async function SourcesPage({ params }: PageProps<"/[locale]/sources">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ar = locale === "ar";
  const [meta, works, lex, all] = await Promise.all([
    api<Meta>("/meta"),
    api<{ data: Work[] }>("/works"),
    api<{ data: (LexiconWork & { displayed_entries: number })[] }>("/lexicon/works"),
    api<{ layers: Layers }>("/sources"),
  ]);
  // an API older than this page answers without layers: show what there is rather than fail
  const L: Layers = all.layers ?? { knowledge: [], relations: [], patterns: [], particles: [], gharib: [], recitations: { reciters: [], credit: { ar: "", en: "", sources: [] } } };
  const who = (x: Person) => `${ar ? x.title_ar : x.title_en} — ${(ar ? x.author_ar : x.author_en).split(ar ? "،" : ",")[0]}`;
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
        <SourceCard
          key={s.id}
          title={ar ? s.title_ar : s.title_en}
          role={ar && s.role_ar ? s.role_ar : s.role}
          license={ar && s.license_ar ? s.license_ar : s.license}
          attribution={ar ? s.attribution_ar : s.attribution_en}
          url={s.url}
          version={s.version}
        />
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

      <h2>{ar ? "غريب القرآن في موضعه" : "Gharīb meanings in place"}</h2>
      {L.gharib.map((g) => (
        <SourceCard
          key={g.id}
          title={`${ar ? g.title_ar : g.title_en} — ${ar ? g.publisher_ar : g.publisher_en}`}
          role={g.display_only ? (ar ? "للعرض فقط" : "Display only") : ""}
          license={g.licence}
          licenseUrl={g.licence_url}
          attribution={ar ? g.attribution_ar : g.attribution_en}
          url={g.source_url}
          version={g.version}
        />
      ))}

      <h2>{ar ? "الوجوه والنظائر والفروق والأضداد" : "Wujūh, furūq and aḍdād"}</h2>
      {L.relations.map((x) => (
        <SourceCard key={x.id} title={who(x)} role={ar ? "نصوص منقولة كما هي، مقطّعة إلى مداخل" : "Quoted as they stand, cut into entries"} license={x.licence} licenseUrl={x.licence_url} attribution={ar ? x.attribution_ar : x.attribution_en} url={x.source_url} version={ar ? x.edition_ar : x.edition_en} />
      ))}

      <h2>{ar ? "كتب الصرف: ما يدل عليه الوزن" : "Sarf works: what a pattern does"}</h2>
      {L.patterns.map((x) => (
        <SourceCard key={x.id} title={who(x)} role={x.role === "commentary" ? (ar ? "شرح" : "Commentary") : ar ? "متن" : "Text"} license={x.licence} licenseUrl={x.licence_url} attribution={ar ? x.attribution_ar : x.attribution_en} url={x.source_url} version={ar ? x.edition_ar : x.edition_en} />
      ))}

      <h2>{ar ? "كتب حروف المعاني" : "Works on the particles"}</h2>
      {L.particles.map((x) => (
        <SourceCard key={x.id} title={who(x)} role={ar ? "مداخل الحروف ووجوهها" : "Particle entries and their senses"} license={x.licence} licenseUrl={x.licence_url} attribution={ar ? x.attribution_ar : x.attribution_en} url={x.source_url} version={ar ? x.edition_ar : x.edition_en} />
      ))}

      <h2>{ar ? "طبقات المعرفة القرآنية" : "Quran knowledge layers"}</h2>
      {L.knowledge.map((k) => (
        <SourceCard
          key={k.id}
          title={ar ? k.title_ar : k.title_en}
          role={k.kind}
          license={ar && k.license_ar ? k.license_ar : k.license}
          licenseUrl={k.license_url}
          attribution={ar ? k.attribution_ar : k.attribution_en}
          url={k.url}
          version={k.version}
        />
      ))}

      <h2>{ar ? "التلاوات" : "Recitations"}</h2>
      <p>{ar ? L.recitations.credit.ar : L.recitations.credit.en}</p>
      {L.recitations.credit.sources.map((c) => (
        <SourceCard key={c.id} title={c.name} role={c.modified ? (ar ? "معدّل" : "Modified") : ""} license={c.license} licenseUrl={c.license_url} attribution={c.name} url={c.url} />
      ))}
      <p className="text-[13px] text-t3">
        {(ar ? "القرّاء: " : "Reciters: ") + L.recitations.reciters.map((r) => (ar ? r.name_ar : r.name_en)).join(ar ? "، " : ", ")}
      </p>
    </Prose>
  );
}

type Person = { title_ar: string; title_en: string; author_ar: string; author_en: string };
type Credit = { licence: string; licence_url: string | null; attribution_ar: string; attribution_en: string; source_url: string };
type Layers = {
  knowledge: { id: string; kind: string; title_ar: string; title_en: string; version: string | null; url: string; license: string; license_ar: string | null; license_url: string | null; attribution_ar: string; attribution_en: string }[];
  relations: (Person & Credit & { id: string; edition_ar: string | null; edition_en: string | null })[];
  patterns: (Person & Credit & { id: string; role: string; edition_ar: string | null; edition_en: string | null })[];
  particles: (Person & Credit & { id: string; edition_ar: string | null; edition_en: string | null })[];
  gharib: (Credit & { id: string; title_ar: string; title_en: string; publisher_ar: string; publisher_en: string; version: string | null; display_only: boolean })[];
  recitations: {
    reciters: { id: string; name_ar: string; name_en: string }[];
    credit: { ar: string; en: string; sources: { id: string; name: string; url: string; license: string; license_url: string; modified?: boolean }[] };
  };
};

function SourceCard({ title, role, license, licenseUrl, attribution, url, version }: { title: string; role: string; license: string; licenseUrl?: string | null; attribution: string; url: string; version?: string | null }) {
  return (
    // long file names (OpenITI URIs) break anywhere rather than push the page sideways on a phone
    <div className="card my-3 p-4 text-[14px] leading-relaxed [overflow-wrap:anywhere]">
      <p className="font-semibold">{title}</p>
      <p className="text-t2">{role}</p>
      {version && <p className="text-[12.5px] text-t3">{version}</p>}
      <p className="mt-2 text-[13px] text-t2">
        {licenseUrl ? (
          <a href={licenseUrl} target="_blank" rel="noreferrer license">{license}</a>
        ) : (
          license
        )}
      </p>
      <p className="mt-1 text-[13px]">
        <a href={url} target="_blank" rel="noreferrer">{attribution}</a>
      </p>
    </div>
  );
}
