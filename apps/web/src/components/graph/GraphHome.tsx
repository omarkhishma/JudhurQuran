"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAccount } from "@/lib/account/store";
import { createGraph, deleteGraph } from "@/lib/graph/persist";
import { forkPublished, publishedPath, readPublished } from "@/lib/graph/published";
import { listShared, sharedPath, stopSharing, type SharedRow } from "@/lib/graph/shared";
import { useMyGraphs } from "@/lib/graph/useMyGraphs";
import type { GraphKind } from "@/lib/graph/types";
import { cnt, formatNumber } from "@/lib/format";
import { MAX_MAP_IMPORT, restoreFiles, sweepFiles } from "@/lib/graph/files";
import { upgrade } from "@/lib/graph/migrate";
import { cleanKind, cleanTitle, type Cleaned } from "@/lib/graph/sanitize";
import { useWhereSaved } from "@/lib/graph/whereSaved";
import { useMyPublished } from "./Publish";


export function GraphHome() {
  const t = useTranslations("graph");
  const locale = useLocale();
  const router = useRouter();
  const { data: graphs } = useMyGraphs();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [root, setRoot] = useState("");
  const [message, setMessage] = useState<{ text: string; id?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const where = useWhereSaved();
  // maps shared for comments: this reader's own, with what is new in their comments, and those shared with them
  const session = useAccount((s) => s.session);
  const shared = useQuery({ queryKey: ["shared-maps", session], queryFn: listShared, enabled: !!session, refetchOnWindowFocus: true });
  const sharedRows = shared.data?.data ?? [];
  const mineShared = new Map(sharedRows.filter((r) => r.owner.mine && r.local_id).map((r) => [r.local_id!, r]));
  const here = new Set(graphs?.map((g) => g.id) ?? []);
  // shared with this reader, and this reader's own shared maps that this browser does not hold
  const others = sharedRows.filter((r) => !r.owner.mine || !here.has(r.local_id ?? ""));
  // this reader's published maps (P8.5): marked on their rows, and listed with their pages
  const published = useMyPublished().data?.data ?? [];
  const publishedOf = new Map(published.filter((r) => r.local_id).map((r) => [r.local_id!, r]));
  // files no map holds any more, once a day has passed (lib/graph/files)
  useEffect(() => {
    void sweepFiles().catch(() => 0);
  }, []);
  // `?fork={slug}&v=` (EDT-290): a published map copied into this reader's maps, then opened
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const slug = p.get("fork");
    if (!slug) return;
    const v = Number(p.get("v")) || undefined;
    readPublished(slug, v)
      .then((m) => forkPublished(m, t("forkTitle", { title: m.title })))
      .then((id) => router.replace(`/graph/edit/${id}?forked=1`))
      .catch(() => setMessage({ text: t("forkMissing") }));
  }, [router, t]);

  async function create(kind: GraphKind) {
    const title = kind === "topic" ? t("newTopic") : kind === "meaning" ? t("newMeaning") : t("newFree");
    const id = await createGraph({ title, kind, nodes: [], edges: [] });
    router.push(`/graph/edit/${id}`);
  }

  /** A map from a file (EDT-260, HWF-27): only what a map of ours can hold is kept — the rest is counted and said —
   * the type it was exported with comes back, and it is laid out afresh when first opened. */
  async function importFile(file: File) {
    setMessage(null);
    if (file.size > MAX_MAP_IMPORT) return setMessage({ text: t("importTooLarge") });
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return setMessage({ text: t("importNotJson") });
    }
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    if (!Array.isArray(o.nodes)) return setMessage({ text: t("importNoNodes") });
    const kind = cleanKind(o.kind);
    let got: Cleaned;
    try {
      // a file exported before version 2 is migrated, which reads its words' slugs from the dataset
      got = await upgrade(o.version, kind, o.nodes, o.edges);
    } catch {
      return setMessage({ text: t("importOffline") });
    }
    await restoreFiles(o.files, got.nodes);
    const id = await createGraph({ title: cleanTitle(o.title, t("untitled")), kind, nodes: got.nodes, edges: got.edges, pendingLayout: true });
    const skipped = got.skippedNodes + got.skippedEdges;
    setMessage({
      text:
        t("importedReport", { cards: t("cards", cnt(got.nodes.length, locale)), links: t("links", cnt(got.edges.length, locale)) }) +
        (skipped ? t("importSkipped", { n: formatNumber(skipped, locale) }) : ""),
      id,
    });
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-4 py-10">
        <h1 className="text-[28px] font-semibold">{t("editorTitle")}</h1>
        <p className="mt-1 max-w-[75ch] text-t2">
          {t("editorLead")} {where && t(where === "account" ? "leadAccount" : "leadBrowser")}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {(["topic", "meaning", "free"] as const).map((k) => (
            <button key={k} type="button" onClick={() => void create(k)} className="card p-4 text-start hover:border-ring">
              <span className="mb-1 flex items-center gap-2">
                <span className="dot" style={{ background: k === "topic" ? "var(--c-sentence)" : k === "meaning" ? "var(--c-form)" : "var(--c-desc)" }} />
                <span className="font-semibold">{k === "topic" ? t("newTopic") : k === "meaning" ? t("newMeaning") : t("newFree")}</span>
              </span>
              {k === "meaning" && <span className="block text-[12.5px] text-t3">{t("meaningHint")}</span>}
            </button>
          ))}
        </div>
        <form
          className="card mt-3 flex flex-wrap items-center gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (root.trim()) router.push(`/graph/root/${encodeURIComponent(root.trim())}`);
          }}
        >
          <label htmlFor="graph-root" className="font-semibold">{t("newFromRoot")}</label>
          <input
            id="graph-root"
            value={root}
            onChange={(e) => setRoot(e.target.value)}
            placeholder="ع ل م"
            lang="ar"
            className="ar-classical h-10 w-40 rounded-lg border border-line bg-card px-3 text-[18px] outline-none focus:border-ring"
          />
          <button type="submit" className="btn min-h-[40px]">{t("open")}</button>
          <span className="ms-auto">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                // cleared, so the same file can be picked again (EDT-261, HWF-28)
                e.target.value = "";
                if (file) void importFile(file);
              }}
            />
            <button type="button" className="btn min-h-[40px]" onClick={() => fileRef.current?.click()}>{t("importJson")}</button>
          </span>
        </form>
        <p className="mt-2 text-[13px] text-t2" role="status">
          {message?.text}
          {message?.id && (
            <>
              {" "}
              <Link href={`/graph/edit/${message.id}`} className="text-word underline">{t("openImported")}</Link>
            </>
          )}
        </p>

        <h2 className="label-caps mt-10 mb-3">
          {t("editorTitle")}
          {where && <span className="normal-case"> • {t(where === "account" ? "savedAccount" : "localOnly")}</span>}
        </h2>
        {graphs && graphs.length === 0 && <p className="rounded-xl bg-card p-5 text-t2">{t("noGraphs")}</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {graphs?.map((g) => (
            <li key={g.id} className="card flex items-center justify-between gap-3 p-4">
              <Link href={`/graph/edit/${g.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{g.title}</span>
                <span className="text-[12.5px] text-t3">
                  {t("cards", cnt(g.nodeCount, locale))} • {t("updated", { date: new Date(g.updatedAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB") })}
                </span>
                {g.shared && <SharedLine row={mineShared.get(g.id)} />}
                {publishedOf.has(g.id) && (
                  <span className="mt-0.5 flex items-center gap-1 text-[12px] text-t2">
                    <span className="dot" style={{ background: "var(--c-form)" }} aria-hidden="true" />
                    {t("publishedRowLine", { v: formatNumber(publishedOf.get(g.id)!.latest, locale) })}
                  </span>
                )}
              </Link>
              <button
                type="button"
                className={"btn " + (confirming === g.id ? "border-bad text-bad" : "")}
                onClick={async () => {
                  if (confirming !== g.id) return setConfirming(g.id);
                  // a shared map deleted here stops being shared: its link and comments go with it
                  if (g.shared) await stopSharing(g.shared).catch(() => {});
                  await deleteGraph(g.id);
                  setConfirming(null);
                  void shared.refetch();
                }}
              >
                {confirming === g.id ? t(g.shared ? "deleteSharedConfirm" : publishedOf.has(g.id) ? "deletePublishedConfirm" : "deleteConfirm") : t("delete")}
              </button>
            </li>
          ))}
        </ul>

        {published.length > 0 && (
          <>
            <h2 className="label-caps mt-10 mb-3">{t("myPublished")}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {published.map((r) => (
                <li key={r.slug} className="card p-4">
                  <Link href={publishedPath(r.slug)} className="block min-w-0">
                    <span className="flex items-baseline gap-2">
                      {r.counts.lead && <span className="ar-classical text-[16px]" lang="ar">{r.counts.lead}</span>}
                      <span className="min-w-0 flex-1 truncate font-semibold" dir="auto">{r.title}</span>
                    </span>
                    <span className="text-[12.5px] text-t3">
                      {t("publishedVersionN", { v: formatNumber(r.latest, locale) })} • {t("cards", cnt(r.counts.cards, locale))} • {t("publishedForks", cnt(r.fork_count, locale))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {others.length > 0 && (
          <>
            <h2 className="label-caps mt-10 mb-3">{t("sharedWithYou")}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {others.map((r) => (
                <li key={r.id} className="card p-4">
                  <Link href={sharedPath(r.id)} className="block min-w-0">
                    <span className="block truncate font-semibold">{r.title || t("untitled")}</span>
                    <span className="text-[12.5px] text-t3">
                      {r.owner.mine ? t("sharedYoursElsewhere") : r.owner.name ? t("sharedBy", { name: r.owner.name }) : t("sharedByReader")} • {t("cards", cnt(r.cards, locale))}
                    </span>
                    <SharedLine row={r} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** A shared map's comments, as its row says them: how many are open, what is new, and whether it names the reader. */
function SharedLine({ row }: { row?: SharedRow }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-t2">
      <span className="flex items-center gap-1">
        <span className="dot" style={{ background: "var(--good)" }} aria-hidden="true" />
        {t("sharedOn")}
      </span>
      {row && row.open > 0 && <span>{t("openComments", cnt(row.open, locale))}</span>}
      {row && row.unread > 0 && <span className="font-medium text-t1">{t("newComments", cnt(row.unread, locale))}</span>}
      {row && row.mentions > 0 && <span className="font-medium text-word">{t("mentionsYou", cnt(row.mentions, locale))}</span>}
    </span>
  );
}
