import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Prose } from "@/components/prose/Prose";

export async function generateMetadata({ params }: PageProps<"/[locale]/developers">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "ar" ? "واجهة برمجية للمطوّرين" : "API for developers" };
}

const ENDPOINTS: [string, string, string][] = [
  ["/api/v1/meta", "إصدار البيانات وعدّاداتها ومصادرها", "Dataset version, counts and sources"],
  ["/api/v1/surahs", "السور الـ١١٤", "The 114 surahs"],
  ["/api/v1/surahs/{n}?translation=saheeh", "سورة بآياتها وكلماتها", "A surah with its verses, tokens and words"],
  ["/api/v1/verses/{s}:{a}", "آية بتحليل كلماتها كاملًا", "A verse with full word morphology"],
  ["/api/v1/words/{s}:{a}:{w}", "كل ما يخص كلمة: الصرف والصيغة والجذر ومعانيه", "Everything about one word"],
  ["/api/v1/roots?l1=&l2=&l3=", "الجذور (مع البحث بحروف الجذر)", "Roots, filterable by letter position"],
  ["/api/v1/roots/{root}", "جذر: عائلته وتوزيعه ومواده في المعاجم", "A root: family, distribution, dictionary articles"],
  ["/api/v1/roots/{root}/occurrences", "فهرس السياقات (KWIC) للجذر", "KWIC concordance for a root"],
  ["/api/v1/roots/{root}/graph", "وثيقة خريطة الجذر", "Root-family graph document"],
  ["/api/v1/search?q=", "البحث الموحد", "Unified search"],
  ["/api/v1/works · /verses/{key}/commentary", "التفاسير والترجمات", "Tafsir and translations"],
  ["/api/v1/lexicon/works · /lexicon/entries/{id}", "المعاجم (للعرض فقط)", "Dictionaries (display only)"],
];

export default async function DevelopersPage({ params }: PageProps<"/[locale]/developers">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ar = locale === "ar";
  return (
    <Prose>
      <h1>{ar ? "واجهة برمجية للمطوّرين" : "API for developers"}</h1>
      <p className="lead">
        {ar
          ? "كل ما في الموقع متاح عبر واجهة برمجية للقراءة فقط، بصيغة JSON، مرتبطة بإصدار محدد للبيانات، ومعها مصدر كل معلومة وترخيصها."
          : "Everything on the site is available through a read-only JSON API, tied to a specific dataset version, with the source and license of every piece of data."}
      </p>
      <p>
        {/* Served by the API service through the /api/v1 rewrite, not a Next.js page. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/v1/docs">{ar ? "التوثيق التفاعلي (OpenAPI)" : "Interactive documentation (OpenAPI)"}</a>
      </p>
      <h2>{ar ? "نقاط الوصول" : "Endpoints"}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <tbody>
            {ENDPOINTS.map(([path, a, e]) => (
              <tr key={path} className="border-t border-line">
                <td className="mono py-2 pe-4 align-top text-[12.5px]" dir="ltr">{path}</td>
                <td className="py-2 align-top text-t2">{ar ? a : e}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>{ar ? "مثال" : "Example"}</h2>
      <pre className="mono overflow-x-auto rounded-xl bg-card p-4 text-[12.5px] leading-relaxed" dir="ltr">{`curl https://<domain>/api/v1/words/2:255:23
{
  "location": "2:255:23", "text_imlaei": "يشفع",
  "root": { "key": "شفع", "spaced": "ش ف ع", "occurrences": 31, ... },
  "root_meaning": { "core": { "text": "الشين والفاء والعين أصلٌ صحيح يدلُّ على مقارنَة الشيئين.", "title_ar": "معجم مقاييس اللغة", ... } },
  ...
}`}</pre>
      <h2>{ar ? "الشروط" : "Terms"}</h2>
      <ul>
        <li>{ar ? "اذكر المصدر لكل بيانات تستعملها كما تذكره نقطة /api/v1/sources، فلكل مصدر شروطه." : "Credit each source as listed by /api/v1/sources; each has its own terms."}</li>
        <li>{ar ? "النص القرآني يُعرض كما هو دون أي تعديل." : "The Quranic text must be shown unaltered."}</li>
        <li>{ar ? "نصوص المعاجم العربية للعرض فقط ولا يجوز جمعها أو إعادة توزيعها بالجملة." : "Arabic dictionary texts are display-only and may not be harvested or redistributed in bulk."}</li>
        <li>{ar ? "الحدّ: ٦٠٠ طلب في الدقيقة لكل عنوان؛ والاستجابات قابلة للتخزين المؤقت (ETag)." : "Limit: 600 requests per minute per address; responses are cacheable (ETag)."}</li>
      </ul>
    </Prose>
  );
}
