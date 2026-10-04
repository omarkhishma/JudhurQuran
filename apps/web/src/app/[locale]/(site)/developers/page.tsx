import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Prose } from "@/components/prose/Prose";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { localized } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/developers">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "ar" ? "واجهة برمجية للمطوّرين" : "API for developers", alternates: localized(locale, "/developers") };
}

type Index = { data: { endpoints: { method: string; path: string }[]; limits: { per_minute_without_key: number; per_minute_with_key: number } } };

// what each public endpoint takes and gives, in both languages (P10.3c)
const ENDPOINTS: { method?: "POST"; path: string; params: string; ar: string; en: string }[] = [
  { path: "/api/v1/public", params: "", ar: "فهرس الواجهة: منتجاتها ونقاطها وحدودها كما يحفظها الخادم.", en: "The API's index: its products, endpoints and limits as the server holds them." },
  { path: "/api/v1/public/quran/lookup", params: "q, limit ≤ 20", ar: "مطابقات مصنفة لأي طلب: كلمة بالتشكيل أو بدونه، جذر، وزن، آية.", en: "Typed matches for any query: a word with or without vowels, a root, a pattern, a verse." },
  { path: "/api/v1/public/quran/roots/{root}", params: "علم · ع ل م · ʿ-l-m", ar: "جذر: مداخله بأوزانها وطريقة استخراج كل وزن، وتوزيعه في السور.", en: "A root: its lemmas with their patterns and how each was derived, its distribution." },
  { path: "/api/v1/public/quran/words/{location}", params: "2:255:3", ar: "كلمة بموضعها: رسمها، وصرفها وأجزاؤها، ومدخلها وجذرها.", en: "A word by its place: its form, morphology and segments, its lemma and root." },
  { path: "/api/v1/public/quran/verses/{key}", params: "2:255", ar: "آية: نصها كما في المصحف، وكلماتها.", en: "A verse: its text as the mushaf writes it, and its words." },
  { path: "/api/v1/public/quran/patterns/{slug}", params: "fa3l, limit ≤ 500", ar: "وزن ومداخله عبر الجذور.", en: "A pattern and its lemmas across roots." },
  { path: "/api/v1/public/quran/concordance", params: "root, limit ≤ 100, cursor", ar: "مواضع الجذر في سياقها، صفحة بعد صفحة (next_cursor).", en: "A root's lines in context, a page at a time (next_cursor)." },
  {
    method: "POST",
    path: "/api/v1/public/quran/analyse",
    params: '{"text": "…"} ≤ 600',
    ar: "عبارة تقرأ كلمة كلمة على ألفاظ القرآن: تحليل المدونة بموضع كل كلمة حيث تكون من القرآن، وقراءات مرتبة بدرجة الثقة فيما سوى ذلك.",
    en: "A phrase read word by word against the Quran: the corpus's analysis, each word at its place, where it is the Quran's; ranked readings with their confidence otherwise.",
  },
  { path: "/api/v1/public/releases", params: "", ar: "إصدارات البيانات المسجلة.", en: "The recorded dataset releases." },
];

// how a word of an analysed text was read (POST /quran/analyse)
const KINDS: { kind: string; ar: string; en: string }[] = [
  { kind: "gold", ar: "تحليل المدونة القرآنية اللغوية للكلمة في موضعها من القرآن.", en: "The corpus's analysis of the word at its place in the Quran." },
  { kind: "form", ar: "الرسم نفسه في القرآن، وقراءاته مرتبة بنصيب كل منها من مواضعه.", en: "The same written form in the Quran, its readings ranked by their share of its places." },
  { kind: "clitic", ar: "الرسم بعد نزع ما اتصل به من حروف العطف والجر وأل والضمائر.", en: "The form after its attached conjunctions, prepositions, article and pronouns are taken off." },
  { kind: "pattern", ar: "جذر مرشح من أوزان القرآن على جذوره، بثقة أدنى.", en: "A root suggested by the Quran's patterns over its roots, with lower confidence." },
  { kind: "particle", ar: "حرف لا جذر له.", en: "A particle, with no root." },
  { kind: "none", ar: "لا قراءة.", en: "No reading." },
];

const RELEASES: { path: string; ar: string; en: string }[] = [
  { path: "/api/v1/releases/{version}", ar: "الإصدار: ملفاته ببصماتها (sha256) وصيغها وما حجب منها ولماذا، ومصادره وتراخيصها.", en: "A release: its files with their sha256, formats and holds, its sources and licences." },
  { path: "/api/v1/releases/{version}/manifest", ar: "بيان الإصدار كما بني، حرفا بحرف، وبصمته في الترويسة X-Content-SHA256.", en: "The release's manifest byte for byte, its hash in X-Content-SHA256." },
  { path: "/api/v1/releases/{version}/files/{path}", ar: "ملف من الإصدار: بعد نشره، وإن لم يحجب؛ وبصمته في الترويسة نفسها.", en: "A release's file: once published and when not held; its hash in the same header." },
];

const ERRORS: [string, string, string][] = [
  ["not_found", "لا شيء بهذا المعرف.", "Nothing with that identifier."],
  ["invalid_key", "المفتاح غير صالح: ملغى أو لم يصدر.", "The key is not valid: revoked, or never issued."],
  ["rate_limited", "تجاوزت الحد في الدقيقة؛ انتظر ما في Retry-After.", "Over the limit for this minute; wait as long as Retry-After says."],
  ["unpublished", "الإصدار لم ينشر بعد.", "The release is not published yet."],
  ["held", "الملف محجوز حتى يقرر صاحب المشروع، والسبب في الرسالة.", "The file is held until the project's owner decides; the reason is in the message."],
];

/** An identifier — a path, a header, a key — isolated from the sentence around it, whatever its direction. */
const C = ({ children }: { children: React.ReactNode }) => <code dir="ltr">{children}</code>;

/**
 * The developers' guide (P10.3c; DAT-37, 46…48, Q02, Q07): the public API — its envelope, endpoints, releases, limits,
 * keys, errors and terms — in Arabic and English, its limits read from the API itself.
 */
export default async function DevelopersPage({ params }: PageProps<"/[locale]/developers">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ar = locale === "ar";
  const index = await api<Index>("/public", { revalidate: 3600 });
  const n = (x: number) => formatNumber(x, locale);
  const lim = index.data.limits;
  return (
    <Prose>
      <h1>{ar ? "واجهة برمجية للمطوّرين" : "API for developers"}</h1>
      <p className="lead">
        {ar
          ? "واجهة جذر العامة للقراءة فقط، بصيغة JSON. كل جواب يحمل معه إصدار البيانات ومصدر كل طبقة فيه وترخيصها، فلا يضيع المصدر في الطريق."
          : "Jadhr's public API is read-only JSON. Every answer carries the dataset's version and the source and licence of every layer in it, so the provenance is never lost on the way."}
      </p>
      <p>
        {ar ? "جربها في " : "Try it in "}
        <Link href="/data?tab=api">{ar ? "مختبر الواجهة البرمجية" : "the API playground"}</Link>
        {ar ? "، أو اقرأ " : ", or read "}
        {/* Served by the API service through the /api/v1 rewrite, not a Next.js page. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/v1/docs">{ar ? "التوثيق التفاعلي" : "the interactive documentation"}</a>
        {ar ? " ومواصفة " : " and the "}
        <a href="/api/v1/openapi.json" dir="ltr">
          OpenAPI
        </a>
        {ar ? "." : " document."}
      </p>

      <h2>{ar ? "الجواب ومصدره" : "An answer and its provenance"}</h2>
      {ar ? (
        <p>
          كل جواب من <C>/api/v1/public</C> فيه مفتاحان: <C>data</C> وفيها البيانات، و<C>meta</C> وفيها اسم المجموعة وإصدارها، والإصدار المسجل الذي يستشهد به حين يوجد، وطبقات الجواب طبقة طبقة: ما هي، ومن أي مصدر، وبأي ترخيص، وكيف ينسب.
        </p>
      ) : (
        <p>
          Every answer from <C>/api/v1/public</C> has two keys: <C>data</C>, the data; and <C>meta</C> — the dataset&apos;s name and version, the recorded release a citation names once there is one, and the answer&apos;s layers one by one: what each is, its source, its licence and how to credit it.
        </p>
      )}
      {/* a scrolling example is reached by keyboard too */}
      <pre className="mono overflow-x-auto rounded-xl bg-card p-4 text-[12.5px] leading-relaxed" dir="ltr" tabIndex={0} aria-label={ar ? "مثال" : "Example"}>{`curl -s https://<domain>/api/v1/public/quran/roots/علم
{
  "meta": {
    "dataset": "jadhr-quran",
    "dataset_version": "2026.10.0",
    "release": { "version": "2026.10.0", "manifest_sha256": "…", "published": false, "doi": null },
    "layers": [
      { "layer": "morphology", "source": "qac", "license": "GNU General Public License with the corpus terms of use …", "attribution": "…" },
      { "layer": "patterns", "source": "jadhr", "license": "CC BY-SA 4.0 (D14)", "attribution": "Jadhr (jadhr.org) …" }
    ],
    "generated_at": "…",
    "docs": "https://jadhr.org/developers"
  },
  "data": { "key": "علم", "spaced": "ع ل م", "occurrences": 854, "lemmas": [ { "slug": "ilm", "pattern": "فِعْل", "pattern_method": "…" } ], … }
}`}</pre>

      <h2>{ar ? "النقاط" : "Endpoints"}</h2>
      {ar ? (
        <p>
          كلها تقرأ بـ <C>GET</C> إلا التحليل فبـ <C>POST</C>: يرسل النص في متن الطلب فلا يقع في عنوان ولا في سجل ولا في ذاكرة مؤقتة، ولا يحفظ. وأسماؤها تحت المنتج: <C>quran</C> اليوم، والمعجم والحديث والكتب بأسمائها حين تأتي.
        </p>
      ) : (
        <p>
          All are read with <C>GET</C> but the analysis, which takes <C>POST</C>: the text goes in the body, so it never sits in an address, a log line or a cache, and it is not kept. They are named under their product: <C>quran</C> today; the dictionary, hadith and books under their own names when they come.
        </p>
      )}
      {/* each endpoint on its own lines — the path, what it takes, what it gives — at every width */}
      <dl className="not-prose flex flex-col divide-y divide-line">
        {ENDPOINTS.map((e) => (
          <div key={e.path} className="flex flex-col gap-0.5 py-2.5">
            <dt className="mono break-all text-[12.5px] text-t1" dir="ltr">
              {e.method && <span className="me-2 font-semibold text-[var(--ring)]">{e.method}</span>}
              {e.path}
            </dt>
            {e.params && (
              <dd className="mono text-[12px] text-t3" dir="ltr">
                {e.params}
              </dd>
            )}
            <dd className="text-[13.5px] leading-relaxed text-t2">{ar ? e.ar : e.en}</dd>
          </div>
        ))}
      </dl>

      <h3>{ar ? "تحليل نص" : "Analysing a text"}</h3>
      <p>
        {ar
          ? "لكل كلمة في الجواب نوع قراءتها في الحقل kind، وهو واحد مما يلي. القراءات آلية ومعها درجة الثقة، وهي نصيب القراءة من مواضع الرسم في القرآن. ولا تعطى الصفات الإعرابية إلا لكلمة قرئت في موضعها من القرآن، وغيرها يعطى مثالها القرآني."
          : "Each word in the answer says how it was read, in its kind, one of those below. Readings are machine-derived and carry their confidence: the reading's share of the form's places in the Quran. Inflection is given only for a word read at its place in the Quran; any other word gets its Quranic example."}
      </p>
      <dl className="not-prose flex flex-col divide-y divide-line">
        {KINDS.map((k) => (
          <div key={k.kind} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
            <dt className="mono shrink-0 text-[12.5px] text-t1 sm:w-20">
              <span dir="ltr">{k.kind}</span>
            </dt>
            <dd className="text-[13.5px] leading-relaxed text-t2">{ar ? k.ar : k.en}</dd>
          </div>
        ))}
      </dl>
      <pre className="mono overflow-x-auto rounded-xl bg-card p-4 text-[12.5px] leading-relaxed" dir="ltr" tabIndex={0} aria-label={ar ? "مثال التحليل" : "Analysis example"}>{`curl -s -X POST https://<domain>/api/v1/public/quran/analyse \\
  -H 'Content-Type: application/json' -d '{"text": "إن العلم لا يدرك"}'
{
  "meta": { …, "layers": [ …, { "layer": "analysis", "source": "jadhr", "what": "… machine-derived, each reading with its confidence" } ] },
  "data": {
    "source": { "kind": "free", "verse_key": null },
    "tokens": [
      { "surface": "العلم", "kind": "form", "confidence": 1.0,
        "readings": [ { "lemma": { "slug": "ilm", "ar": "عِلْم" }, "root": { "key": "علم" }, "pattern": { "ar": "فِعْل" },
                        "confidence": 1.0, "quran_occurrences": 28, "quran_example": "2:120:23" } ] },
      …
    ]
  }
}`}</pre>

      <h2>{ar ? "الإصدارات" : "Releases"}</h2>
      <p>
        {ar
          ? "الإصدار يبنى مرة ويسجل مرة ولا يتغير: البيان يحفظ كما بني ببصمة كل ملف، والإصدار نفسه يعاد ما دام الموقع. يستشهد بالإصدار بعنوانه أو بمعرفه الرقمي (DOI) حين يصدر — انظر «استشهد بالبيانات» في صفحة "
          : "A release is built once, recorded once and never changes: its manifest is kept as built with every file's hash, and the same release is returned for as long as the site stands. Cite it by its address, or by its DOI once minted — see “Cite the dataset” on "}
        <Link href="/data">{ar ? "البيانات" : "the data page"}</Link>.
      </p>
      <dl className="not-prose flex flex-col divide-y divide-line">
        {RELEASES.map((r) => (
          <div key={r.path} className="flex flex-col gap-0.5 py-2.5">
            <dt className="mono break-all text-[12.5px] text-t1" dir="ltr">
              {r.path}
            </dt>
            <dd className="text-[13.5px] leading-relaxed text-t2">{ar ? r.ar : r.en}</dd>
          </div>
        ))}
      </dl>

      <h2>{ar ? "الحدود والمفاتيح" : "Limits and keys"}</h2>
      <ul>
        <li>
          {ar
            ? `بلا مفتاح: ${n(lim.per_minute_without_key)} طلبا في الدقيقة لكل عنوان. بمفتاح: ${n(lim.per_minute_with_key)} طلب في الدقيقة للمفتاح.`
            : `Without a key: ${n(lim.per_minute_without_key)} requests a minute per address. With a key: ${n(lim.per_minute_with_key)} a minute per key.`}
        </li>
        {ar ? (
          <li>
            كل جواب يقول حده في الترويسات <C>RateLimit-Limit</C> و<C>RateLimit-Remaining</C> و<C>RateLimit-Reset</C>، وجواب <C>429</C> يقول متى تعود في <C>Retry-After</C>.
          </li>
        ) : (
          <li>
            Every answer states its limit in <C>RateLimit-Limit</C>, <C>RateLimit-Remaining</C> and <C>RateLimit-Reset</C>; a <C>429</C> says when to come back in <C>Retry-After</C>.
          </li>
        )}
        <li>
          {ar ? "المفتاح تنشئه من " : "Make a key on "}
          <Link href="/me?tab=account">{ar ? "حسابك" : "your account"}</Link>
          {ar ? (
            <>
              ، وترسله في الترويسة <C>X-API-Key</C> (أو <C>Authorization: Bearer</C>). يظهر مرة واحدة ولا يحفظه الخادم؛ ضعه في برنامج على خادم، لا في صفحة يراها الناس.
            </>
          ) : (
            <>
              {" "}and send it in the <C>X-API-Key</C> header (or <C>Authorization: Bearer</C>). It is shown once and the server does not keep it; put it in a program on a server, not in a page people can see.
            </>
          )}
        </li>
        {ar ? (
          <li>
            القراءة بلا مفتاح متاحة من صفحات أي موقع (<C>CORS</C>)، والأجوبة قابلة للتخزين المؤقت (<C>ETag</C>).
          </li>
        ) : (
          <li>
            Reading without a key is open to any site&apos;s pages (<C>CORS</C>), and answers are cacheable (<C>ETag</C>).
          </li>
        )}
      </ul>

      <h2>{ar ? "الأخطاء" : "Errors"}</h2>
      <p>{ar ? "الخطأ جواب بهذا الشكل، والرمز ثابت يمكن البناء عليه:" : "An error is an answer of this form, its code stable enough to build on:"}</p>
      <pre className="mono overflow-x-auto rounded-xl bg-card p-4 text-[12.5px]" dir="ltr" tabIndex={0} aria-label={ar ? "شكل الخطأ" : "The error's form"}>{`{ "error": { "code": "not_found", "message": "No root with that identifier." } }`}</pre>
      <dl className="not-prose flex flex-col divide-y divide-line">
        {ERRORS.map(([code, a, e]) => (
          <div key={code} className="flex flex-col gap-0.5 py-2">
            <dt className="mono text-[12.5px] text-t1" dir="ltr">
              {code}
            </dt>
            <dd className="text-[13.5px] text-t2">{ar ? a : e}</dd>
          </div>
        ))}
      </dl>

      <h2>{ar ? "الشروط" : "Terms"}</h2>
      <ul>
        {ar ? (
          <li>
            انسب كل طبقة تستعملها كما في <C>meta.layers</C> من الجواب نفسه، فلكل مصدر شروطه.
          </li>
        ) : (
          <li>
            Credit every layer you use as <C>meta.layers</C> in the answer says; each source has its own terms.
          </li>
        )}
        <li>{ar ? "النص القرآني يعرض كما هو، دون أي تعديل." : "The Quranic text is shown as it is, unaltered."}</li>
        <li>{ar ? "طبقاتنا المشتقة (الأوزان ومحاذاة الطبقات) بترخيص CC BY-SA 4.0." : "Our derived layers (patterns, the alignment of layers) are CC BY-SA 4.0."}</li>
        <li>{ar ? "نصوص المعاجم والتراجم الكلمية لا تقدمها الواجهة العامة: هي للعرض في الموقع وحده." : "Dictionary texts and word-by-word glosses are not served by the public API: they are for display on the site only."}</li>
        {ar ? (
          <li>
            واجهة الموقع نفسه (بقية <C>/api/v1</C>) يقرؤها الموقع، وقد تتغير أشكالها؛ فابن على <C>/api/v1/public</C>.
          </li>
        ) : (
          <li>
            The site&apos;s own API (the rest of <C>/api/v1</C>) is read by the site, and its shapes may change; build on <C>/api/v1/public</C>.
          </li>
        )}
      </ul>
    </Prose>
  );
}
