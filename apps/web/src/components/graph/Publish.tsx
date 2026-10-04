"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { errorKind } from "@/lib/account/errors";
import { useAccount } from "@/lib/account/store";
import { cnt, cnt2, formatNumber } from "@/lib/format";
import { checkSlug, myPublished, PUBLISHED_LICENCE, publishedPath, publishMap, publishVersion, slugify, withdrawMap, type PublishedRow } from "@/lib/graph/published";
import type { GraphDoc } from "@/lib/graph/types";
import { useDebounced } from "@/lib/useDebounced";

/** This reader's published maps, signed in: which of their maps is published, and where (the server's word). */
export function useMyPublished() {
  const session = useAccount((s) => s.session);
  return useQuery({ queryKey: ["my-published", session], queryFn: myPublished, enabled: !!session, staleTime: 30_000 });
}

/** A map's description written from what it holds (EDT-271), for the owner to keep or change. */
function described(doc: GraphDoc, t: ReturnType<typeof useTranslations<"graph">>, locale: string): string {
  const roots = doc.nodes.filter((n) => n.data.kind === "root");
  const words = doc.nodes.filter((n) => n.data.kind === "lemma").length;
  const cards = doc.nodes.filter((n) => n.data.kind !== "frame").length;
  if (roots.length === 1) return t("publishAutoOne", { ...cnt(words, locale), root: roots[0].data.ar ?? "" });
  if (roots.length > 1) return t("publishAutoMany", { ...cnt(words, locale), ...cnt2(roots.length, locale) });
  return t("publishAutoCards", cnt(cards, locale));
}

/**
 * Publishing a map (P8.5; EDT-021, EDT-269…274, QAN-23): its title, an address of its own — Arabic letters kept,
 * checked as it is typed — and a description written from its cards; what publishing allows said before it is
 * done. Once published: its address, a new version of the map as it is now, and withdrawing it, asked twice.
 */
export function PublishDialog({ open, onClose, doc }: { open: boolean; onClose: () => void; doc: GraphDoc }) {
  const t = useTranslations("graph");
  const terr = useTranslations("account");
  const locale = useLocale();
  const path = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const session = useAccount((s) => s.session);
  const name = useAccount((s) => s.user?.display_name ?? null);
  const mine = useMyPublished();
  const row: PublishedRow | undefined = mine.data?.data.find((r) => r.local_id === doc.id);
  const [title, setTitle] = useState(doc.title);
  const [slug, setSlug] = useState(() => slugify(doc.title));
  // the latest version's description when the map is published, else one written from its cards — until the owner
  // writes their own
  const [typedDescription, setDescription] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const description = typedDescription ?? (row?.description || described(doc, t, locale));
  const typed = useDebounced(slug, 300);
  const check = useQuery({ queryKey: ["slug-check", typed], queryFn: () => checkSlug(typed), enabled: open && !row && typed.length > 0, staleTime: 5_000 });
  const files = doc.nodes.some((n) => (n.data.fields ?? []).some((f) => f.kind === "image" || f.kind === "audio" || f.kind === "file"));
  const content = { title: title.trim(), description: description.trim(), kind: doc.kind, nodes: doc.nodes, edges: doc.edges };
  const okSlug = check.data?.slug === slugify(slug) && check.data.valid && check.data.available;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(terr(`err.${errorKind(e)}`));
    } finally {
      setBusy(false);
    }
  }
  const host = typeof window === "undefined" ? "" : window.location.host;
  const prefix = locale === "ar" ? "" : "/en";

  return (
    <Dialog open={open} onClose={onClose} label={t("publishTitle")} width={560}>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center">
          <h2 className="text-[15px] font-semibold">{t("publishTitle")}</h2>
          <span className="flex-1" />
          <button type="button" className="btn icon-btn" onClick={onClose} aria-label={t("closeDialog")}>✕</button>
        </div>

        {!session ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] leading-relaxed text-t2">{t("publishSignIn")}</p>
            <Link href={`/signin?next=${encodeURIComponent(path)}`} className="btn btn-primary self-start">{t("publishSignInAction")}</Link>
          </div>
        ) : mine.isPending ? (
          <p className="text-[13px] text-t3">…</p>
        ) : row ? (
          <>
            <section className="flex flex-col gap-2" aria-labelledby="pub-at-h">
              <h3 id="pub-at-h" className="label-caps">{t("publishPublishedAt")}</h3>
              <p className="mono text-[12.5px] text-t1" dir="ltr">
                <bdi>{`${host}${prefix}/g/${row.slug}`}</bdi>
              </p>
              <p className="text-[12.5px] text-t3">{t("publishLatest", { v: formatNumber(row.latest, locale), date: new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(row.updated_at)) })}</p>
              <div className="flex flex-wrap gap-2">
                <Link href={publishedPath(row.slug)} className="btn">{t("publishOpenPage")}</Link>
                <button type="button" className="btn" onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}${prefix}${publishedPath(row.slug)}`).then(() => setSaid(t("shareLinkCopied")), () => setSaid(t("copyFailed")))}>
                  {t("copyLink")}
                </button>
              </div>
            </section>
            <section className="flex flex-col gap-2 border-t border-line pt-3" aria-labelledby="pub-new-h">
              <h3 id="pub-new-h" className="label-caps">{t("publishNewVersion")}</h3>
              <p className="text-[12.5px] leading-relaxed text-t2">{t("publishNewVersionLead")}</p>
              <Fields title={title} setTitle={setTitle} description={description} setDescription={setDescription} />
              <button
                type="button"
                className="btn btn-primary self-start"
                disabled={busy || !content.title}
                onClick={() =>
                  void run(async () => {
                    const out = await publishVersion(row.slug, content);
                    await qc.invalidateQueries({ queryKey: ["my-published"] });
                    setSaid(t("publishVersionDone", { v: formatNumber(out.version, locale) }));
                  })
                }
              >
                {t("publishVersionAction", { v: formatNumber(row.latest + 1, locale) })}
              </button>
            </section>
            <section className="flex flex-col gap-2 border-t border-line pt-3" aria-labelledby="pub-withdraw-h">
              <h3 id="pub-withdraw-h" className="label-caps">{t("publishedWithdraw")}</h3>
              {asking ? (
                <>
                  <p className="text-[12.5px] leading-relaxed text-t1">{t("publishedWithdrawAsk")}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn text-bad"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await withdrawMap(row.slug);
                          await qc.invalidateQueries({ queryKey: ["my-published"] });
                          setAsking(false);
                          setSaid(t("publishWithdrawn"));
                        })
                      }
                    >
                      {t("publishedWithdraw")}
                    </button>
                    <button type="button" className="btn" onClick={() => setAsking(false)}>{t("cancel")}</button>
                  </div>
                </>
              ) : (
                <button type="button" className="btn self-start" onClick={() => setAsking(true)}>{t("publishedWithdraw")}</button>
              )}
            </section>
          </>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!okSlug || !content.title) return;
              void run(async () => {
                const out = await publishMap(doc.id, check.data!.slug, content, doc.forkedFrom ? { slug: doc.forkedFrom.slug, version: doc.forkedFrom.version } : null);
                await qc.invalidateQueries({ queryKey: ["my-published"] });
                // said, then the public page opens (EDT-273)
                setSaid(t("publishDone"));
                setTimeout(() => router.push(publishedPath(out.slug)), 700);
              });
            }}
          >
            <Fields title={title} setTitle={setTitle} description={description} setDescription={setDescription} />
            <label className="flex flex-col gap-1 text-[12.5px] text-t2">
              {t("publishAddress")}
              <span className="flex items-center gap-1 rounded-lg border border-line bg-card px-2" dir="ltr">
                <span className="mono shrink-0 text-[12px] text-t3">{`${host}${prefix}/g/`}</span>
                <input className="mono min-h-[40px] min-w-0 flex-1 bg-transparent text-[12.5px] outline-none" value={slug} onChange={(e) => setSlug(e.target.value)} dir="auto" aria-describedby="pub-slug-state" maxLength={120} />
              </span>
            </label>
            <p id="pub-slug-state" className="text-[12px]" role="status" aria-live="polite">
              {!check.data || check.data.slug !== slugify(slug) ? (
                <span className="text-t3">…</span>
              ) : !check.data.valid ? (
                <span className="text-bad">{t("publishSlugShort")}</span>
              ) : check.data.available ? (
                <span className="text-good">
                  {t("publishSlugFree")} <bdi className="mono">{check.data.slug}</bdi>
                </span>
              ) : (
                <span className="text-amber">
                  {t("publishSlugTaken")}{" "}
                  {check.data.suggestion && (
                    <button type="button" className="underline underline-offset-2" onClick={() => setSlug(check.data!.suggestion!)}>
                      {t("publishSlugUse", { slug: check.data.suggestion })}
                    </button>
                  )}
                </span>
              )}
            </p>
            <section className="flex flex-col gap-1.5 rounded-lg border border-line bg-card-2 p-3 text-[12.5px] leading-relaxed text-t2" aria-labelledby="pub-means-h">
              <h3 id="pub-means-h" className="label-caps">{t("publishMeans")}</h3>
              <ul className="list-disc ps-5">
                <li>{t("publishMeansRead")}</li>
                <li>{t("publishMeansCopy")}</li>
                <li>{t("publishMeansVersions")}</li>
                <li>{t("publishMeansWithdraw")}</li>
              </ul>
              <p>{PUBLISHED_LICENCE ? PUBLISHED_LICENCE[locale === "ar" ? "ar" : "en"] : t("publishedLicenceOpen")}</p>
              <p>{name ? t("publishUnderName", { name }) : t("publishNoName")}</p>
              {doc.forkedFrom && <p>{t("publishForkNamed", { title: doc.forkedFrom.title })}</p>}
              {files && <p>{t("shareFilesStay")}</p>}
            </section>
            <button type="submit" className="btn btn-primary self-start" disabled={busy || !okSlug || !content.title}>{t("publishAction")}</button>
          </form>
        )}
        <p className="min-h-[1.2em] text-[12.5px] text-t2" role="status" aria-live="polite">{said}</p>
        {error && <p className="text-[12.5px] text-bad" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}

function Fields({ title, setTitle, description, setDescription }: { title: string; setTitle: (s: string) => void; description: string; setDescription: (s: string) => void }) {
  const t = useTranslations("graph");
  return (
    <>
      <label className="flex flex-col gap-1 text-[12.5px] text-t2">
        {t("publishMapTitle")}
        <input className="field-input min-h-[40px] text-[14px]" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required dir="auto" />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px] text-t2">
        {t("publishDescription")}
        <textarea className="field-input min-h-[72px] text-[13px] leading-relaxed" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} dir="auto" />
      </label>
    </>
  );
}
