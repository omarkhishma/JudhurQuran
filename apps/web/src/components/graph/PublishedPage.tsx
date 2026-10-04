"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { errorKind } from "@/lib/account/errors";
import { useAccount } from "@/lib/account/store";
import { useTheme } from "@/lib/client";
import { cnt, formatNumber } from "@/lib/format";
import { loadGraph } from "@/lib/graph/persist";
import {
  countCite,
  embedPath,
  embedSnippet,
  forkPublished,
  gallery,
  MAP_CITE_FORMATS,
  mapCitation,
  type MapCiteFormat,
  PUBLISHED_LICENCE,
  publishedMapPath,
  publishedPath,
  type PublishedMap,
  readPublished,
  reportMap,
  resolveMapReport,
  withdrawMap,
} from "@/lib/graph/published";
import type { CardMessage } from "./PublishedView";

type AsText = { roots: string[]; words: string[]; verses: string[]; notes: string[] };

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** This site's address, once in the browser: the server renders without it, so the page hydrates as it was sent. */
const useOrigin = () =>
  useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

/** The site's own prefix for this language (Arabic at the root, English under /en). */
const prefixOf = (locale: string) => (locale === "ar" ? "" : "/en");

/**
 * A published map's page (P8.5; EDT-324…341, HUB-25): the map's title, byline and versions; the map itself, framed
 * from its embed — the real editor, read-only, as any site will frame it; and beside it what a reader does with it.
 * The server renders it as anyone sees it; signed in, it is read again as the reader (their own map, the board).
 */
export function PublishedScreen({ initial, text }: { initial: PublishedMap; text: AsText }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const router = useRouter();
  const session = useAccount((s) => s.session);
  const qc = useQueryClient();
  const specific = initial.version < initial.latest ? initial.version : undefined;
  const q = useQuery({ queryKey: ["published", initial.slug, specific ?? 0, !!session], queryFn: () => readPublished(initial.slug, specific), initialData: session ? undefined : initial, placeholderData: initial, enabled: !!session, staleTime: 30_000 });
  const m = q.data ?? initial;
  const others = useQuery({ queryKey: ["published-by", m.slug], queryFn: () => gallery(0, 12, m.slug), staleTime: 60_000 });
  const theme = useTheme();
  const [opts, setOpts] = useState<{ entry: boolean; folded: boolean; dark: boolean | null }>({ entry: true, folded: false, dark: null });
  const dark = opts.dark ?? theme === "dark";
  const frame = useRef<HTMLIFrameElement>(null);
  // told to the frame when it says it listens (set below, once `post` exists)
  const shown = useRef(() => {});
  // the frame's address changes only with the details option; folding and the theme are told to it (EDT-334)
  const frameSrc = (entry: boolean) => `${prefixOf(locale)}${embedPath(initial.slug, { entry, folded: false, dark: false, version: specific })}`;
  const [src, setSrc] = useState(() => frameSrc(true));
  const [said, setSaid] = useState<string | null>(null);
  const [card, setCard] = useState<CardMessage | null>(null);
  const [cite, setCite] = useState(false);
  const [busy, setBusy] = useState(false);
  // a citation copied here moves its count before the page is read again
  const [citesNow, setCitesNow] = useState<number | null>(null);
  const counts = { forks: m.fork_count, cites: Math.max(citesNow ?? 0, m.cite_count) };

  // a message for 1.8 s in the actions column (EDT-336)
  useEffect(() => {
    if (!said) return;
    const id = setTimeout(() => setSaid(null), 1800);
    return () => clearTimeout(id);
  }, [said]);

  // the card selected or folded in the frame (EDT-339): from this site's own frame only
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.origin !== window.location.origin) return;
      const d = e.data as CardMessage | { type: "jadhr-ready" } | null;
      if (d && d.type === "jadhr-card" && typeof d.id === "string") setCard(d);
      // the frame listens: it is told the display the reader sees chosen
      else if (d && d.type === "jadhr-ready") shown.current();
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);

  // the page's theme follows into the frame, unless the reader chose one for it
  const post = useCallback((msg: Record<string, unknown>) => frame.current?.contentWindow?.postMessage(msg, window.location.origin), []);
  useEffect(() => {
    post({ type: "jadhr-theme", dark });
  }, [dark, post]);
  // what the frame is told once it says it listens: the theme, and the folding when chosen
  useEffect(() => {
    shown.current = () => {
      post({ type: "jadhr-theme", dark });
      if (opts.folded) post({ type: "jadhr-fold", folded: true });
    };
  });
  const origin = useOrigin();
  const snippet = embedSnippet(origin, prefixOf(locale), m.slug, m.title, { entry: opts.entry, folded: opts.folded, dark, version: specific });
  const address = `${origin}${prefixOf(locale)}${publishedPath(m.slug, m.version)}`;
  // in UTC: the server and the browser write the same day
  const day = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

  async function fork() {
    setBusy(true);
    try {
      const id = await forkPublished(m, t("forkTitle", { title: m.title }));
      router.push(`/graph/edit/${id}?forked=1`);
    } catch {
      setSaid(t("forkFailed"));
      setBusy(false);
    }
  }
  async function openInEditor() {
    // the owner edits their own map, when this browser has it; anyone else reads it in the editor
    if (m.mine && m.local_id && (await loadGraph(m.local_id))) return router.push(`/graph/edit/${m.local_id}`);
    router.push(publishedMapPath(m.slug, specific));
  }
  function download() {
    const record = { slug: m.slug, version: m.version, title: m.title, description: m.description, kind: m.kind, author: m.author.name, published_at: m.published_at, counts: m.counts, forked_from: m.forked_from, address, doc_version: m.doc_version, doc: m.doc };
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${m.slug}-v${m.version}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const licence = PUBLISHED_LICENCE ? PUBLISHED_LICENCE[locale === "ar" ? "ar" : "en"] : null;
  const anonymous = { ar: t("publishedAnonymousAr"), en: "A Jadhr reader" };
  return (
    <div className="pub-page mx-auto w-full max-w-[1280px] px-4 py-6">
      <nav className="pub-bar" aria-label={t("publishedOthersLabel")}>
        <span className="text-[12.5px] text-t3">{others.data?.data.length ? t("publishedOthers") : t("publishedGallery")}</span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {(others.data?.data ?? []).map((r) => (
            <Link key={r.slug} href={publishedPath(r.slug)} className="chip" dir="auto">{r.title}</Link>
          ))}
          {!others.data?.data.length && <Link href="/g" className="chip">{t("publishedAll")}</Link>}
        </div>
        <Link href="/graph" className="text-[12.5px] text-t2 underline-offset-2 hover:underline">{t("publishedFromEditor")}</Link>
      </nav>

      <div className="pub-grid">
        <section className="flex min-w-0 flex-col gap-3" aria-labelledby="pub-title">
          <header className="flex flex-col gap-1.5">
            <h1 id="pub-title" className="text-[20px] font-semibold leading-snug" dir="auto">{m.title}</h1>
            <p className="text-[12.5px] text-t3">
              {[
                m.author.name ? t("publishedBy", { name: m.author.name }) : t("publishedAnonymousAr"),
                t("publishedUpdated", { date: day(m.published_at) }),
                t("cards", cnt(m.counts.cards, locale)),
                ...(m.counts.roots ? [t("publishedRoots", cnt(m.counts.roots, locale))] : []),
                t("publishedVersionOf", { v: formatNumber(m.version, locale), latest: formatNumber(m.latest, locale) }),
              ].join(" · ")}
            </p>
            <p className="pub-address mono text-[12px] text-t3" dir="ltr">
              <bdi>{`${origin.replace(/^https?:\/\//, "")}${prefixOf(locale)}/g/${m.slug}`}</bdi>
            </p>
            {m.forked_from && (
              <p className="text-[12.5px] text-t2">
                {t("publishedForkedFrom")}{" "}
                <Link href={publishedPath(m.forked_from.slug, m.forked_from.version)} className="underline underline-offset-2" dir="auto">
                  {m.forked_from.title ?? t("publishedForkedGone")}
                </Link>
              </p>
            )}
            {specific && (
              <p className="pub-notice text-[12.5px]" role="note">
                {t("publishedOlder", { v: formatNumber(m.version, locale) })} <Link href={publishedPath(m.slug)} className="underline underline-offset-2">{t("publishedSeeLatest", { v: formatNumber(m.latest, locale) })}</Link>
              </p>
            )}
            <p className="max-w-[560px] text-[13.5px] leading-relaxed text-t2" dir="auto">{m.description || t("publishedNoDescription")}</p>
          </header>
          <div className="pub-frame">
            <iframe
              ref={frame}
              src={src}
              title={t("publishedFrameTitle", { title: m.title })}
              className="pub-iframe"
            />
          </div>
          <p className="pub-caption text-[12px] text-t3">{t("publishedCaption")}</p>
          {card && (
            <p className="pub-card-strip text-[13px]" role="status">
              <span className="text-t3">{t("publishedSelected")}</span> <bdi className="font-semibold text-t1">{card.ar || "—"}</bdi>
              {card.tr && <span className="text-t3"> · <bdi>{card.tr}</bdi></span>}
              {card.type2 === "root" && card.root && (
                <>
                  {" "}
                  <Link href={`/roots/${encodeURIComponent(card.root)}`} className="underline underline-offset-2">{t("publishedOpenRoot")}</Link>
                </>
              )}
              {card.type2 === "lemma" && card.slug && (
                <>
                  {" "}
                  <Link href={`/read?w=${encodeURIComponent(card.slug)}`} className="underline underline-offset-2">{t("publishedOpenWord")}</Link>
                </>
              )}
            </p>
          )}
          <details className="pub-text rounded-lg border border-line bg-card px-3 py-2">
            <summary className="cursor-pointer text-[13px]">{t("publishedAsText")}</summary>
            <dl className="mt-2 grid gap-2 text-[13px]">
              {(["roots", "words", "verses", "notes"] as const).map((k) =>
                text[k].length ? (
                  <div key={k}>
                    <dt className="label-caps">{t(`publishedText_${k}`)}</dt>
                    <dd className="mt-0.5 leading-relaxed text-t1" dir="auto">{text[k].join(" · ")}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          </details>
        </section>

        <aside className="pub-actions" aria-label={t("publishedActions")}>
          <div className="flex flex-col gap-2">
            <button type="button" className="btn btn-primary justify-center" onClick={() => void fork()} disabled={busy}>{t("forkAction")}</button>
            <button type="button" className="btn justify-center" onClick={() => void openInEditor()}>{t("publishedOpenEditor")}</button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn justify-center" onClick={() => setCite(true)} aria-haspopup="dialog">{t("publishedCite")}</button>
              <button type="button" className="btn justify-center" onClick={download}>{t("publishedDownload")}</button>
            </div>
          </div>

          <section className="flex flex-col gap-2 border-t border-line pt-3" aria-labelledby="pub-embed-h">
            <h2 id="pub-embed-h" className="label-caps">{t("publishedEmbed")}</h2>
            <textarea className="field-input mono min-h-[96px] text-[11.5px] leading-snug" value={snippet} readOnly dir="ltr" aria-label={t("publishedEmbedCode")} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn self-start" onClick={() => void copy(snippet).then((ok) => setSaid(ok ? t("publishedEmbedCopied") : t("copyFailed")))}>{t("publishedEmbedCopy")}</button>
            <fieldset className="flex flex-col gap-1.5 text-[13px]">
              <legend className="sr-only">{t("publishedEmbedOptions")}</legend>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={opts.entry}
                  onChange={(e) => {
                    const entry = e.target.checked;
                    setOpts((o) => ({ ...o, entry }));
                    setSrc(frameSrc(entry));
                  }}
                />
                {t("publishedOptEntry")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={opts.folded}
                  onChange={(e) => {
                    const folded = e.target.checked;
                    setOpts((o) => ({ ...o, folded }));
                    post({ type: "jadhr-fold", folded });
                  }}
                />
                {t("publishedOptFolded")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={dark} onChange={(e) => setOpts((o) => ({ ...o, dark: e.target.checked }))} />
                {t("publishedOptDark")}
              </label>
            </fieldset>
          </section>

          <p className="border-t border-line pt-3 text-[12.5px] leading-relaxed text-t2">
            {[t("publishedForks", cnt(counts.forks, locale)), t("publishedCites", cnt(counts.cites, locale)), t("publishedHistory")].join(" · ")}
          </p>
          <p className="text-[12px] leading-relaxed text-t3">{licence ?? t("publishedLicenceOpen")}</p>

          <section className="flex flex-col gap-1 border-t border-line pt-3" aria-labelledby="pub-versions-h">
            <h2 id="pub-versions-h" className="label-caps">{t("publishedVersions")}</h2>
            <ol className="flex flex-col">
              {m.versions.map((v) => (
                <li key={v.version} className="border-b border-line py-1 text-[12.5px] last:border-b-0">
                  <Link href={publishedPath(m.slug, v.version === m.latest ? undefined : v.version)} aria-current={v.version === m.version ? "page" : undefined} className={"flex items-center gap-2 " + (v.version === m.version ? "font-semibold text-t1" : "text-t2 hover:text-t1")}>
                    <span>{t("publishedVersionN", { v: formatNumber(v.version, locale) })}</span>
                    <span className="text-t3">{day(v.published_at)}</span>
                    <span className="flex-1" />
                    <span className="text-t3">{t("cards", cnt(v.counts.cards, locale))}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {m.mine && <OwnerPanel m={m} onWithdrawn={() => router.refresh()} />}
          {m.reports && m.reports.length > 0 && <BoardPanel m={m} onDone={() => void qc.invalidateQueries({ queryKey: ["published", m.slug] }).then(() => router.refresh())} />}
          {!m.mine && <ReportMap m={m} onSaid={setSaid} />}
          <p className="min-h-[1.3em] text-[12.5px] text-good" role="status" aria-live="polite">{said}</p>
        </aside>
      </div>

      <CiteDialog
        open={cite}
        onClose={() => setCite(false)}
        m={m}
        address={address}
        anonymous={anonymous}
        onCopied={(n) => {
          if (n != null) setCitesNow(n);
          setSaid(t("publishedCiteCopied"));
        }}
      />
    </div>
  );
}

/** A version cited in five forms, each copied whole; a copy counts once per reader an hour (EDT-332, EDT-346). */
function CiteDialog({ open, onClose, m, address, anonymous, onCopied }: { open: boolean; onClose: () => void; m: PublishedMap; address: string; anonymous: { ar: string; en: string }; onCopied: (n: number | null) => void }) {
  const t = useTranslations("graph");
  const [format, setFormat] = useState<MapCiteFormat>("arabic");
  const body = mapCitation(format, m, address, anonymous);
  return (
    <Dialog open={open} onClose={onClose} label={t("publishedCite")} width={560}>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center">
          <h2 className="text-[15px] font-semibold">{t("publishedCiteTitle", { v: m.version })}</h2>
          <span className="flex-1" />
          <button type="button" className="btn icon-btn" onClick={onClose} aria-label={t("closeDialog")}>✕</button>
        </div>
        <div role="radiogroup" aria-label={t("publishedCiteFormat")} className="flex flex-wrap gap-1.5">
          {MAP_CITE_FORMATS.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={format === f} className={"chip" + (format === f ? " is-on" : "")} onClick={() => setFormat(f)}>
              {t(`citeFormat_${f}`)}
            </button>
          ))}
        </div>
        <pre className="cite-box whitespace-pre-wrap break-words rounded-lg border border-line bg-card-2 p-3 text-[12.5px] leading-relaxed" dir={format === "arabic" ? "rtl" : "ltr"}>{body}</pre>
        <p className="text-[12px] leading-relaxed text-t3">{t("publishedCiteNote")}</p>
        <button
          type="button"
          className="btn btn-primary self-start"
          onClick={() =>
            void copy(body).then(async (ok) => {
              if (!ok) return;
              onCopied(m.mine ? null : await countCite(m.slug).catch(() => null));
            })
          }
        >
          {t("publishedCiteCopy")}
        </button>
      </div>
    </Dialog>
  );
}

/** The owner's own map: a new version is published from the editor; withdrawing asks twice (EDT-274). */
function OwnerPanel({ m, onWithdrawn }: { m: PublishedMap; onWithdrawn: () => void }) {
  const t = useTranslations("graph");
  const terr = useTranslations("account");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-card-2 p-3" aria-labelledby="pub-owner-h">
      <h2 id="pub-owner-h" className="label-caps">{t("publishedYours")}</h2>
      <p className="text-[12.5px] leading-relaxed text-t2">{t("publishedYoursLead")}</p>
      {m.local_id && <Link href={`/graph/edit/${m.local_id}`} className="btn self-start text-[12.5px]">{t("publishedEditMine")}</Link>}
      {asking ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] leading-relaxed text-t1">{t("publishedWithdrawAsk")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn text-bad"
              onClick={() =>
                void withdrawMap(m.slug)
                  .then(onWithdrawn)
                  .catch((e) => setError(terr(`err.${errorKind(e)}`)))
              }
            >
              {t("publishedWithdraw")}
            </button>
            <button type="button" className="btn" onClick={() => setAsking(false)}>{t("cancel")}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn self-start text-[12.5px]" onClick={() => setAsking(true)}>{t("publishedWithdraw")}</button>
      )}
      {error && <p className="text-[12px] text-bad" role="alert">{error}</p>}
    </section>
  );
}

/** What readers reported, for the editorial board: each reason, the map withdrawn or the report dismissed. */
function BoardPanel({ m, onDone }: { m: PublishedMap; onDone: () => void }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line p-3" aria-labelledby="pub-reports-h">
      <h2 id="pub-reports-h" className="label-caps">{t("publishedReports", cnt(m.reports!.length, locale))}</h2>
      <ul className="flex flex-col gap-2">
        {m.reports!.map((r) => (
          <li key={r.id} className="flex flex-col gap-1.5 text-[12.5px]">
            <p className="leading-relaxed text-t1" dir="auto">{r.reason}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn min-h-[40px] text-bad" onClick={() => void resolveMapReport(r.id, "withdrawn").then(onDone)}>{t("publishedReportWithdraw")}</button>
              <button type="button" className="btn min-h-[40px]" onClick={() => void resolveMapReport(r.id, "dismissed").then(onDone)}>{t("publishedReportDismiss")}</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A signed-in reader reports a map to the board, saying why (the reason is required). */
function ReportMap({ m, onSaid }: { m: PublishedMap; onSaid: (s: string) => void }) {
  const t = useTranslations("graph");
  const terr = useTranslations("account");
  const session = useAccount((s) => s.session);
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (done) return <p className="text-[12.5px] text-t3">{t("publishedReported")}</p>;
  if (!session)
    return (
      <Link href={`/signin?next=${encodeURIComponent(path)}`} className="self-start text-[12.5px] text-t3 underline-offset-2 hover:underline">
        {t("publishedReport")}
      </Link>
    );
  if (!open)
    return (
      <button type="button" className="self-start text-[12.5px] text-t3 underline-offset-2 hover:underline" onClick={() => setOpen(true)}>
        {t("publishedReport")}
      </button>
    );
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason.trim()) return;
        void reportMap(m.slug, m.version, reason.trim())
          .then(() => {
            setDone(true);
            onSaid(t("publishedReportSent"));
          })
          .catch((err) => setError(terr(`err.${errorKind(err)}`)));
      }}
    >
      <label className="flex flex-col gap-1 text-[12.5px]">
        {t("publishedReportWhy")}
        <textarea className="field-input min-h-[72px] text-[13px]" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} required dir="auto" autoFocus />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="btn" disabled={!reason.trim()}>{t("publishedReportSend")}</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>{t("cancel")}</button>
      </div>
      {error && <p className="text-[12px] text-bad" role="alert">{error}</p>}
    </form>
  );
}

/** A map no longer published: who withdrew it, and where the others are. */
export function PublishedGone({ by }: { by: "author" | "board" }) {
  const t = useTranslations("graph");
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-start gap-3 px-4 py-16">
      <h1 className="text-[20px] font-semibold">{t("publishedWithdrawn")}</h1>
      <p className="text-[14px] leading-relaxed text-t2">{t(by === "board" ? "publishedWithdrawnBoard" : "publishedWithdrawnAuthor")}</p>
      <Link href="/g" className="btn">{t("publishedAll")}</Link>
    </div>
  );
}
