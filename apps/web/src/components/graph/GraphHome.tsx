"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { createGraph, deleteGraph } from "@/lib/graph/persist";
import { useMyGraphs } from "@/lib/graph/useMyGraphs";
import type { GraphKind } from "@/lib/graph/types";
import { cnt, formatNumber } from "@/lib/format";
import { cleanGraph, cleanKind, cleanTitle } from "@/lib/graph/sanitize";
import { useWhereSaved } from "@/lib/graph/whereSaved";

const MAX_IMPORT = 5 * 1024 * 1024;

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

  async function create(kind: GraphKind) {
    const title = kind === "topic" ? t("newTopic") : kind === "meaning" ? t("newMeaning") : t("newFree");
    const id = await createGraph({ title, kind, nodes: [], edges: [] });
    router.push(`/graph/edit/${id}`);
  }

  /** A map from a file (EDT-260, HWF-27): only what a map of ours can hold is kept — the rest is counted and said —
   * the type it was exported with comes back, and it is laid out afresh when first opened. */
  async function importFile(file: File) {
    setMessage(null);
    if (file.size > MAX_IMPORT) return setMessage({ text: t("importTooLarge") });
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return setMessage({ text: t("importNotJson") });
    }
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    if (!Array.isArray(o.nodes)) return setMessage({ text: t("importNoNodes") });
    const got = cleanGraph(o.nodes, Array.isArray(o.edges) ? o.edges : []);
    const id = await createGraph({ title: cleanTitle(o.title, t("untitled")), kind: cleanKind(o.kind), nodes: got.nodes, edges: got.edges, pendingLayout: true });
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
              </Link>
              <button
                type="button"
                className={"btn " + (confirming === g.id ? "border-bad text-bad" : "")}
                onClick={async () => {
                  if (confirming !== g.id) return setConfirming(g.id);
                  await deleteGraph(g.id);
                  setConfirming(null);
                }}
              >
                {confirming === g.id ? t("deleteConfirm") : t("delete")}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
