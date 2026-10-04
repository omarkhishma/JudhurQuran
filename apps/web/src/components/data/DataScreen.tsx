"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Changelog } from "@/components/contrib/Changelog";
import { Link } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { CITE_FORMATS, citation, getMeta, getPublicIndex, getRelease, getReleases, getSources, releaseAddress, type CiteFormat, type Hold, type Release, type ReleaseFile } from "@/lib/dataset";
import { formatNumber } from "@/lib/format";

type Tab = "dataset" | "api";

/**
 * Data & API (P10.3; DAT-01…54): the dataset — what it holds, its releases with their files, hashes and holds, the
 * changelog of merged contributions, how to cite it, the sources and their licences — and a playground on the
 * public API, sending real requests and showing what came back.
 */
export function DataScreen() {
  const t = useTranslations("dataset");
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>(sp.get("tab") === "api" ? "api" : "dataset");
  const choose = (next: Tab) => {
    setTab(next);
    const u = new URL(window.location.href);
    if (next === "api") u.searchParams.set("tab", "api");
    else u.searchParams.delete("tab");
    window.history.replaceState(null, "", u);
  };
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-[24px] font-semibold">{t("title")}</h1>
          {/* our layers under our licence, every source under its own (DAT-02, 23, 24) */}
          <p className="text-[12.5px] text-t3">{t("licenceLine")}</p>
        </div>
        <div className="lesson-tabs" role="tablist" aria-label={t("tabs")}>
          {(["dataset", "api"] as const).map((x) => (
            <button key={x} type="button" role="tab" id={`dt-${x}`} aria-selected={tab === x} aria-controls="data-view" className="lesson-tab" onClick={() => choose(x)}>
              {t(x === "api" ? "tabApi" : "tabDataset")}
            </button>
          ))}
        </div>
      </header>
      <div id="data-view" role="tabpanel" aria-labelledby={`dt-${tab}`}>
        {tab === "api" ? <Playground /> : <Dataset />}
      </div>
    </div>
  );
}

const size = (n: number, locale: string) => {
  const units = locale === "ar" ? ["بايت", "ك.ب", "م.ب", "ج.ب"] : ["B", "KB", "MB", "GB"];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${formatNumber(Math.round(x * 10) / 10, locale)} ${units[i]}`;
};

function Dataset() {
  const t = useTranslations("dataset");
  const locale = useLocale();
  const meta = useQuery({ queryKey: ["meta"], queryFn: getMeta, refetchOnWindowFocus: true });
  const list = useQuery({ queryKey: ["releases"], queryFn: getReleases, refetchOnWindowFocus: true });
  const latest = list.data?.data[0];
  const current = useQuery({ queryKey: ["release", latest?.version], queryFn: () => getRelease(latest!.version), enabled: !!latest, refetchOnWindowFocus: true });
  const c = meta.data?.dataset.counts;
  const n = (x: number | undefined) => (x == null ? "—" : formatNumber(x, locale));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="flex flex-col gap-3" aria-labelledby="ds-h">
          <h2 id="ds-h" className="text-[20px] font-semibold">{t("datasetTitle")}</h2>
          <p className="max-w-[70ch] text-[14px] leading-relaxed text-t2">{t("datasetLead")}</p>
          {/* computed from the loaded dataset (DAT-05): no sample numbers */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["roots", c?.roots],
                ["lemmas", c?.lemmas],
                ["words", c?.words],
                ["verses", c?.verses],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 rounded-xl border border-line bg-card px-3 py-2.5">
                <span className="text-[22px] font-semibold text-t1">{n(v)}</span>
                <span className="text-[12px] text-t3">{t(`stat_${k}`)}</span>
              </div>
            ))}
          </div>
          {meta.data && <p className="text-[12px] text-t3">{t("loadedVersion", { version: meta.data.dataset.version })}</p>}
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="rel-h">
          <h2 id="rel-h" className="text-[17px] font-semibold">{t("releases")}</h2>
          {list.isPending ? (
            <span className="block h-24 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />
          ) : list.isError ? (
            <p role="alert" className="text-[13px] text-t2">{t("failed")}</p>
          ) : !list.data?.data.length ? (
            <p className="text-[13px] text-t2">{t("noRelease")}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {list.data.data.map((r) => (
                <li key={r.version}>{r.version === latest?.version && current.data ? <ReleaseCard r={current.data} latest /> : <ReleaseRow version={r.version} />}</li>
              ))}
            </ol>
          )}
        </section>

        <Changelog />
        <p className="text-[12.5px] text-t3">{t("footer")}</p>
      </div>

      <aside className="flex flex-col gap-4" aria-label={t("rail")}>
        <Cite release={current.data ?? null} />
        <Licences release={current.data ?? null} />
      </aside>
    </div>
  );
}

/** A past release, read when shown: kept retrievable for ever, because citations point at it (DAT-10). */
function ReleaseRow({ version }: { version: string }) {
  const q = useQuery({ queryKey: ["release", version], queryFn: () => getRelease(version) });
  return q.data ? <ReleaseCard r={q.data} latest={false} /> : <span className="block h-16 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
}

const FORMAT_ORDER = ["jsonl", "csv", "tei", "lmf", "xml", "txt"];
/** A format's name as its readers know it (research 19): TEI Lex-0 for dictionaries, LMF (ISO 24613-4) for NLP. */
const FORMAT_LABEL: Record<string, string> = { jsonl: "JSONL", csv: "CSV", tei: "TEI Lex-0", lmf: "LMF", xml: "XML", txt: "TXT" };
const formatLabel = (f: string | null) => FORMAT_LABEL[f ?? ""] ?? (f ?? "").toUpperCase();
const TABLES = ["verses", "words", "lemmas", "roots", "segments", "lexicon_quran", "lexicon_lane"] as const;
type Table = (typeof TABLES)[number];

/** Why a file is held, in the reader's language: the manifest says it in English and in Arabic; a hold without the
 * Arabic shows the English, isolated so its punctuation stays in place. */
function HoldWhy({ hold, id }: { hold: Hold | undefined; id: string }) {
  const t = useTranslations("dataset");
  const locale = useLocale();
  if (locale === "ar" && hold?.why_ar) return <>{t.rich("heldWhy", { text: hold.why_ar, why: (c) => <>{c}</> })}</>;
  return <>{t.rich("heldWhy", { text: hold?.why ?? id, why: (c) => (locale === "ar" ? <bdi dir="ltr" lang="en">{c}</bdi> : <>{c}</>) })}</>;
}

/** A release (DAT-07…13): its files by format, each with its size and sha256 — downloadable once published and not
 * held; a held file says why, and who decides. */
function ReleaseCard({ r, latest }: { r: Release; latest: boolean }) {
  const t = useTranslations("dataset");
  const locale = useLocale();
  const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : "—");
  const byTable = new Map<string, ReleaseFile[]>();
  for (const f of r.files) byTable.set(f.table ?? f.path, [...(byTable.get(f.table ?? f.path) ?? []), f]);
  return (
    <article className={"release-card flex flex-col gap-3 rounded-xl border p-4 " + (latest ? "border-line-2 bg-card" : "border-line bg-card-2")} aria-labelledby={`rel-${r.version}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={`rel-${r.version}`} className="mono text-[16px] font-semibold" dir="ltr">
          v{r.version}
        </h3>
        {latest && <span className="state-chip is-approved">{t("current")}</span>}
        <span className="text-[12px] text-t3">{t("builtOn", { day: day(r.built_at) })}</span>
        <span className="state-chip">{r.published_at ? t("published", { day: day(r.published_at) }) : t("notPublished")}</span>
        {r.doi && (
          <a href={`https://doi.org/${r.doi}`} className="mono text-[12px] underline" dir="ltr">
            DOI {r.doi}
          </a>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {[...byTable.entries()].map(([table, files]) => (
          <li key={table} className="flex flex-col gap-1.5 rounded-lg border border-line bg-card px-3 py-2">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[13.5px] font-medium">{TABLES.includes(table as Table) ? t(`table_${table as Table}`) : table}</span>
              <span className="text-[12px] text-t3">{t("rows", { n: formatNumber(files[0].rows, locale) })}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[...files]
                .sort((a, b) => FORMAT_ORDER.indexOf(a.format ?? "") - FORMAT_ORDER.indexOf(b.format ?? ""))
                .map((f) =>
                  f.available ? (
                    <a key={f.path} href={f.url} className="btn text-[12.5px]" download title={`sha256 ${f.sha256}`}>
                      <bdi>{formatLabel(f.format)}</bdi> · {size(f.bytes, locale)}
                    </a>
                  ) : (
                    <span key={f.path} className="format-chip" title={`sha256 ${f.sha256}`}>
                      <bdi>{formatLabel(f.format)}</bdi> · {size(f.bytes, locale)}
                    </span>
                  ),
                )}
            </div>
            {files[0].held && (
              <p className="text-[12px] leading-relaxed text-t2">
                <HoldWhy hold={r.publication_hold.find((h) => h.id === files[0].held)} id={files[0].held} />
              </p>
            )}
            <p className="mono flex flex-wrap gap-x-3 text-[10.5px] text-t3" dir="ltr">
              {files.map((f) => (
                <span key={f.path} className="whitespace-nowrap">
                  {f.path} sha256:{f.sha256.slice(0, 16)}…
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap gap-x-3 text-[12px] text-t3">
        <a href={r.manifest_url} className="underline underline-offset-2" dir="auto">
          {t("manifest")}
        </a>
        <span className="mono" dir="ltr">
          sha256:{r.manifest_sha256.slice(0, 16)}…
        </span>
      </p>
      {r.excluded.length > 0 && (
        <details className="text-[12px] text-t2">
          <summary className="cursor-pointer text-t3">{t("excludedTitle", { n: formatNumber(r.excluded.length, locale) })}</summary>
          <ul className="mt-1 flex list-disc flex-col gap-1 ps-5">
            {r.excluded.map((e, i) =>
              locale === "ar" && e.data_ar && e.reason_ar ? (
                <li key={i}>{`${e.data_ar} — ${e.reason_ar}`}</li>
              ) : (
                <li key={i} dir="ltr" lang="en">{`${e.data} — ${e.reason}`}</li>
              ),
            )}
          </ul>
        </details>
      )}
    </article>
  );
}

/** "Cite the dataset" (DAT-18…22, Q06): five forms, the DOI when there is one, else the release's own address; copied
 * with a word that shows either way (DAT-H03). */
function Cite({ release }: { release: Release | null }) {
  const t = useTranslations("dataset");
  const client = useIsClient();
  const [format, setFormat] = useState<CiteFormat>("bibtex");
  const [said, setSaid] = useState("");
  useEffect(() => {
    if (!said) return;
    const id = setTimeout(() => setSaid(""), 1800);
    return () => clearTimeout(id);
  }, [said]);
  if (!release)
    return (
      <section className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4" aria-labelledby="cite-h">
        <h2 id="cite-h" className="text-[15px] font-semibold">{t("citeTitle")}</h2>
        <p className="text-[12.5px] text-t3">{t("citeNone")}</p>
      </section>
    );
  const text = citation(format, release, releaseAddress(client ? window.location.origin : "", release.version));
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4" aria-labelledby="cite-h">
      <h2 id="cite-h" className="text-[15px] font-semibold">{t("citeTitle")}</h2>
      <div className="flex flex-wrap gap-1" role="group" aria-label={t("citeFormat")}>
        {CITE_FORMATS.map((f) => (
          <button key={f} type="button" className="seg" aria-pressed={format === f} onClick={() => setFormat(f)}>
            {t(`cite_${f}`)}
          </button>
        ))}
      </div>
      <pre className="cite-box" dir={format === "arabic" ? "rtl" : "ltr"} aria-label={t("citeText")} tabIndex={0}>
        {text}
      </pre>
      <button
        type="button"
        className="btn self-start"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setSaid(t("citeCopied"));
          } catch {
            setSaid(t("citeCopyFailed"));
          }
        }}
      >
        {t("citeCopy")}
      </button>
      <p className="text-[11.5px] leading-relaxed text-t3">{t(release.doi ? "citeDoi" : "citeAddress")}</p>
      {said && (
        <div className="toast" role="status">
          {said}
        </div>
      )}
    </section>
  );
}

/** Sources and licences (DAT-23, 24, Q02): our layers under our licence, every source under its own, from the
 * release's manifest. */
function Licences({ release }: { release: Release | null }) {
  const t = useTranslations("dataset");
  const locale = useLocale();
  const all = useQuery({ queryKey: ["sources"], queryFn: getSources, staleTime: 3_600_000 });
  const ids = release?.sources.map((s) => s.id) ?? [];
  const shown = (all.data ?? []).filter((s) => !release || ids.includes(s.id));
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4" aria-labelledby="lic-h">
      <h2 id="lic-h" className="text-[15px] font-semibold">{t("licencesTitle")}</h2>
      <p className="text-[12.5px] leading-relaxed text-t2">{t("ourLicence")}</p>
      <ul className="flex flex-col gap-2">
        {shown.map((s) => (
          <li key={s.id} className="flex flex-col gap-0.5 text-[12.5px]">
            <a href={s.url} className="font-medium text-t1 underline-offset-2 hover:underline" dir="auto">
              {locale === "ar" ? s.title_ar : s.title_en}
            </a>
            <span className="leading-relaxed text-t3" dir="auto">{s.license}</span>
          </li>
        ))}
      </ul>
      <Link href="/sources" className="self-start text-[12.5px] underline underline-offset-2">{t("allSources")}</Link>
    </section>
  );
}

// ─── the playground (P10.3b; DAT-28…41, 50, Q08) ──────────────────────────────

const DEFAULTS: Record<string, string> = {
  "/api/v1/public/quran/lookup": "علم",
  "/api/v1/public/quran/roots/{root}": "علم",
  "/api/v1/public/quran/words/{location}": "2:255:1",
  "/api/v1/public/quran/verses/{key}": "2:255",
  "/api/v1/public/quran/patterns/{slug}": "fa3l",
  "/api/v1/public/quran/concordance": "علم",
};
// each endpoint said in the page's language (the API states them in English)
const SUMMARY_KEY: Record<string, "ep_lookup" | "ep_roots" | "ep_words" | "ep_verses" | "ep_patterns" | "ep_concordance" | "ep_releases"> = {
  "/api/v1/public/quran/lookup": "ep_lookup",
  "/api/v1/public/quran/roots/{root}": "ep_roots",
  "/api/v1/public/quran/words/{location}": "ep_words",
  "/api/v1/public/quran/verses/{key}": "ep_verses",
  "/api/v1/public/quran/patterns/{slug}": "ep_patterns",
  "/api/v1/public/quran/concordance": "ep_concordance",
  "/api/v1/public/releases": "ep_releases",
};
const QUERY_PARAM: Record<string, string> = { "/api/v1/public/quran/lookup": "q", "/api/v1/public/quran/concordance": "root" };

type Sent = { status: number; ms: number; type: string | null; version: string | null; remaining: string | null; limit: string | null; body: string };

/** An endpoint's address with its parameter: in the path's hole, or as its query parameter. */
function urlOf(path: string, param: string): { url: string; head: string; tail: string; takes: boolean } {
  const hole = path.match(/\{(\w+)\}/)?.[0];
  const qp = QUERY_PARAM[path];
  if (hole) {
    const [head, tail] = path.split(hole);
    return { url: `${head}${encodeURIComponent(param)}${tail}`, head, tail, takes: true };
  }
  if (qp) return { url: `${path}?${qp}=${encodeURIComponent(param)}`, head: `${path}?${qp}=`, tail: "", takes: true };
  return { url: path, head: path, tail: "", takes: false };
}

async function call(url: string, failed: string): Promise<Sent> {
  const t0 = performance.now();
  try {
    const r = await fetch(url, { cache: "no-store" });
    const body = await r.text();
    let pretty = body;
    try {
      pretty = JSON.stringify(JSON.parse(body), null, 2);
    } catch {}
    return { status: r.status, ms: Math.round(performance.now() - t0), type: r.headers.get("content-type"), version: r.headers.get("x-dataset-version"), remaining: r.headers.get("ratelimit-remaining"), limit: r.headers.get("ratelimit-limit"), body: pretty };
  } catch {
    return { status: 0, ms: Math.round(performance.now() - t0), type: null, version: null, remaining: null, limit: null, body: failed };
  }
}

/** The public API tried on the page: its endpoints as the server lists them, a request with an editable parameter,
 * the real answer with its real status, time and headers, and the same request as a curl command. */
function Playground() {
  const t = useTranslations("dataset");
  const locale = useLocale();
  const client = useIsClient();
  const index = useQuery({ queryKey: ["public-index"], queryFn: getPublicIndex, staleTime: 3_600_000 });
  const endpoints = index.data?.endpoints ?? [];
  const first = "/api/v1/public/quran/lookup";
  const [path, setPath] = useState(first);
  const [param, setParam] = useState(DEFAULTS[first]);
  // what was sent: the first answer comes at once (DAT-39); Send asks again, even for the same address
  const [asked, setAsked] = useState({ url: urlOf(first, DEFAULTS[first]).url, n: 0 });
  const answer = useQuery({ queryKey: ["playground", asked.url, asked.n], queryFn: () => call(asked.url, t("network")), enabled: client, staleTime: Infinity, retry: false });
  const sent = answer.data;
  const [said, setSaid] = useState("");
  const ep = endpoints.find((e) => e.path === path);
  const { head, tail, takes, url } = urlOf(path, param);
  const send = (e?: FormEvent) => {
    e?.preventDefault();
    setAsked((a) => ({ url, n: a.n + 1 }));
  };
  const curl = client ? `curl -s '${window.location.origin}${url}'` : "";
  const lim = index.data?.limits;
  return (
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav className="flex flex-col gap-2" aria-label={t("endpoints")}>
        <h2 className="label-caps">{t("endpoints")}</h2>
        <ul className="flex flex-col gap-1">
          {endpoints.map((e) => (
            <li key={e.path}>
              <button
                type="button"
                className="endpoint-row"
                dir="ltr"
                aria-pressed={path === e.path}
                onClick={() => {
                  setPath(e.path);
                  setParam(DEFAULTS[e.path] ?? "");
                  setAsked((a) => ({ url: urlOf(e.path, DEFAULTS[e.path] ?? "").url, n: a.n + 1 }));
                }}
              >
                <span className="endpoint-method">{e.method}</span>
                <span className="mono min-w-0 truncate" dir="ltr">{e.path.replace("/api/v1/public", "")}</span>
              </button>
            </li>
          ))}
        </ul>
        {lim && (
          <p className="text-[11.5px] leading-relaxed text-t3">
            {t("limitsLine", { without: formatNumber(lim.per_minute_without_key, locale), with: formatNumber(lim.per_minute_with_key, locale) })}{" "}
            <a href={index.data!.openapi} className="underline" dir="ltr">
              OpenAPI
            </a>{" "}
            · <Link href="/me?tab=account" className="underline">{t("getKey")}</Link>
          </p>
        )}
      </nav>
      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="req-h">
        <div className="flex flex-col gap-1">
          <h2 id="req-h" className="mono text-[15px] font-semibold" dir="ltr">
            GET {path.replace("/api/v1/public", "")}
          </h2>
          {ep && <p className="text-[13px] text-t2" dir="auto">{SUMMARY_KEY[ep.path] ? t(SUMMARY_KEY[ep.path]) : ep.summary}</p>}
        </div>
        <form className="flex flex-wrap items-stretch gap-2" onSubmit={send}>
          <div className="url-field" dir="ltr">
            <span className="text-t3">{head}</span>
            {takes && <input className="url-param" value={param} onChange={(e) => setParam(e.target.value)} dir="auto" aria-label={t("param")} />}
            <span className="text-t3">{tail}</span>
          </div>
          <button type="submit" className="btn btn-primary" disabled={answer.isFetching}>{t("send")}</button>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(curl);
                setSaid(t("curlCopied"));
              } catch {
                setSaid(t("curlCopyFailed"));
              }
            }}
          >
            curl
          </button>
          <span role="status" className="self-center text-[12px] text-t2">{said}</span>
        </form>
        {sent && (
          <div className="flex flex-col gap-2" aria-live="polite">
            {/* what came back, as it came: status, time, type, the dataset's version, the limit left */}
            <p className="mono flex flex-wrap gap-x-3 text-[12px]" dir="ltr">
              <span className={sent.status >= 200 && sent.status < 300 ? "text-good" : "text-bad"}>{sent.status || "—"}</span>
              <span className="text-t2">{sent.ms} ms</span>
              {sent.type && <span className="text-t3">{sent.type.split(";")[0]}</span>}
              {sent.version && <span className="text-t3">dataset {sent.version}</span>}
              {sent.limit && <span className="text-t3">{`${sent.remaining}/${sent.limit} ${t("perMinute")}`}</span>}
            </p>
            <pre className="response-box" dir="ltr" aria-label={t("response")} tabIndex={0}>
              {sent.body}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}
