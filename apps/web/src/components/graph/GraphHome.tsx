"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { createGraph, deleteGraph, listGraphs } from "@/lib/graph/persist";
import type { GraphDoc, GraphKind } from "@/lib/graph/types";
import { cnt } from "@/lib/format";
import { useWhereSaved } from "@/lib/graph/whereSaved";

export function GraphHome() {
  const t = useTranslations("graph");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: graphs } = useQuery({ queryKey: ["my-graphs"], queryFn: listGraphs });
  const [confirming, setConfirming] = useState<string | null>(null);
  const [root, setRoot] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const where = useWhereSaved();

  async function create(kind: GraphKind) {
    const title = kind === "topic" ? t("newTopic") : kind === "meaning" ? t("newMeaning") : t("newFree");
    const id = await createGraph({ title, kind, nodes: [], edges: [] });
    router.push(`/graph/edit/${id}`);
  }

  async function importFile(file: File) {
    try {
      const raw = JSON.parse(await file.text()) as Partial<GraphDoc>;
      if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) throw new Error("shape");
      await createGraph({
        title: raw.title || t("untitled"),
        kind: raw.kind ?? "free",
        nodes: raw.nodes.map((n) => ({ ...n, type: "card" })),
        edges: raw.edges,
      });
      setMessage(t("imported"));
      void qc.invalidateQueries({ queryKey: ["my-graphs"] });
    } catch {
      setMessage(t("importError"));
    }
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
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
            <button type="button" className="btn min-h-[40px]" onClick={() => fileRef.current?.click()}>{t("importJson")}</button>
          </span>
        </form>
        {message && <p className="mt-2 text-[13px] text-t2" role="status">{message}</p>}

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
                  void qc.invalidateQueries({ queryKey: ["my-graphs"] });
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
