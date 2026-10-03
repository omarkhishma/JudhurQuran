"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { encodeShare, loadGraph, newId, saveGraph } from "@/lib/graph/persist";
import type { GraphDoc, GraphEdge, GraphNode } from "@/lib/graph/types";
import type { SearchResult, Verse, WordDetail } from "@/lib/types";
import { useDebounced } from "@/lib/useDebounced";
import { formatNumber } from "@/lib/format";
import { GraphCanvas } from "./GraphCanvas";

type AddFn = (nodes: GraphNode[], edges: GraphEdge[], label: string) => void;

export function GraphEditor({ id }: { id: string }) {
  const t = useTranslations("graph");
  const { data: doc, isLoading } = useQuery({ queryKey: ["graph", id], queryFn: () => loadGraph(id), staleTime: Infinity });
  if (isLoading) return <p className="p-6 text-t3">…</p>;
  if (!doc) return <p className="p-6 text-t2">{t("noGraphs")} <Link href="/graph" className="text-word underline">{t("editorTitle")}</Link></p>;
  return <EditorInner doc={doc} />;
}

function EditorInner({ doc }: { doc: GraphDoc }) {
  const t = useTranslations("graph");
  const [title, setTitle] = useState(doc.title);
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const latest = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: doc.nodes, edges: doc.edges });
  const addRef = useRef<AddFn | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);

  const persist = useCallback(
    (nextTitle: string) => {
      setStatus("unsaved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setStatus("saving");
        await saveGraph({ ...doc, pendingLayout: false, title: nextTitle || t("untitled"), nodes: latest.current.nodes, edges: latest.current.edges });
        setStatus("saved");
      }, 800);
    },
    [doc, t],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function share() {
    const code = encodeShare({ ...doc, title, nodes: latest.current.nodes, edges: latest.current.edges });
    const url = `${window.location.origin}${window.location.pathname.startsWith("/en") ? "/en" : ""}/graph/view#${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <Palette onAdd={(n, e, label) => addRef.current?.(n, e, label)} kind={doc.kind} />
      <div className="flex min-h-0 flex-1 flex-col">
        <GraphCanvas
          initialNodes={doc.nodes}
          initialEdges={doc.edges}
          autoLayout={!!doc.pendingLayout}
          editable
          title={title}
          onTitleChange={(v) => {
            setTitle(v);
            persist(v);
          }}
          onChange={(nodes, edges) => {
            const changed = nodes !== latest.current.nodes || edges !== latest.current.edges;
            latest.current = { nodes, edges };
            if (changed) persist(title);
          }}
          registerAdd={(fn) => (addRef.current = fn)}
          fileName={`map-${doc.id}`}
          status={
            <span className="flex items-center gap-1.5 text-[12px] text-t3" aria-live="polite">
              <span className="dot" style={{ background: status === "saved" ? "var(--good)" : "var(--amber)" }} />
              {status === "saved" ? t("saved") : status === "saving" ? t("saving") : t("unsaved")}
              <span className="hidden sm:inline">· {t("localOnly")}</span>
            </span>
          }
          toolbarExtra={
            <button type="button" className="btn" onClick={() => void share()} aria-live="polite">
              {copied ? t("shareCopied") : t("share")}
            </button>
          }
        />
      </div>
    </div>
  );
}

function Palette({ onAdd, kind }: { onAdd: AddFn; kind: GraphDoc["kind"] }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 200);
  const { data } = useQuery({
    queryKey: ["palette-search", dq],
    enabled: dq.length > 0,
    queryFn: async () => (await (await fetch(`/api/v1/search?q=${encodeURIComponent(dq)}&limit=6`)).json()) as SearchResult,
  });

  async function addWord(location: string) {
    const w = (await (await fetch(`/api/v1/words/${location}`)).json()) as WordDetail;
    const toks = w.verse.tokens;
    const a = w.token_from - 1;
    const b = w.token_to;
    onAdd(
      [
        {
          id: `word:${location}`,
          type: "card",
          position: { x: 0, y: 0 },
          data: {
            kind: "word",
            ar: toks.slice(a, b).map((x) => x.text).join(" "),
            sub: w.text_imlaei,
            count: w.occurrences.form,
            rootKey: w.root?.key,
            lemmaId: w.lemma?.id,
            form: w.text_imlaei,
            verse: {
              key: w.verse.key,
              surahName: w.verse.surah_name_ar,
              left: toks.slice(Math.max(0, a - 5), a).map((x) => x.text).join(" "),
              word: toks.slice(a, b).map((x) => x.text).join(" "),
              right: toks.slice(b, b + 5).map((x) => x.text).join(" "),
              location,
            },
          },
        },
      ],
      [],
      t("addWord"),
    );
  }

  async function addVerse(key: string) {
    const v = (await (await fetch(`/api/v1/verses/${key}`)).json()) as Verse & { surah_name_ar?: string };
    const surah = (await (await fetch(`/api/v1/surahs/${v.surah}?end=1`)).json()) as { surah: { name_ar: string } };
    onAdd(
      [
        {
          id: `verse:${key}`,
          type: "card",
          position: { x: 0, y: 0 },
          data: { kind: "verse", verse: { key, surahName: surah.surah.name_ar, left: v.tokens.map((x) => x.text).join(" "), word: "", right: "" } },
        },
      ],
      [],
      t("addVerse"),
    );
  }

  return (
    <aside className="flex max-h-[42dvh] w-full shrink-0 flex-col border-b border-line bg-panel md:max-h-none md:w-[300px] md:border-b-0 md:border-e" aria-label={t("palette")}>
      <div className="border-b border-line p-3">
        <p className="label-caps mb-2">{t("palette")}</p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("addSearch")}
          aria-label={t("addSearch")}
          className="h-10 w-full rounded-lg border border-line bg-card px-3 text-[14px] outline-none focus:border-ring"
        />
        <button
          type="button"
          className="btn mt-2 w-full"
          onClick={() =>
            onAdd([{ id: `note:${newId()}`, type: "card", position: { x: 0, y: 0 }, data: { kind: "note", text: "" } }], [], t("addNote"))
          }
        >
          <span className="dot" style={{ background: "var(--c-desc)" }} />
          {t("addNote")}
        </button>
        {kind === "meaning" && <p className="mt-2 text-[11.5px] leading-snug text-t3">{t("meaningHint")}</p>}
        <p className="mt-2 text-[11.5px] leading-snug text-t3">{t("connectHint")}</p>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {data?.results.roots.map((r) => (
          <li key={`r${r.key}`}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-start hover:bg-card"
              onClick={() =>
                onAdd(
                  [{ id: `root:${r.key}`, type: "card", position: { x: 0, y: 0 }, data: { kind: "root", ar: r.spaced, sub: r.translit, count: r.occurrences, rootKey: r.key } }],
                  [],
                  t("addRoot"),
                )
              }
            >
              <span className="flex items-center gap-2"><span className="dot" style={{ background: "var(--c-root)" }} /><span className="ar-classical text-[18px] text-root" lang="ar">{r.spaced}</span></span>
              <span className="mono text-[11px] text-t3">{formatNumber(r.occurrences, locale)}</span>
            </button>
          </li>
        ))}
        {data?.results.words.map((w) => (
          <li key={`w${w.form}-${w.lemma_id}`}>
            <button type="button" className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-start hover:bg-card" onClick={() => void addWord(w.sample)}>
              <span className="flex items-center gap-2"><span className="dot" style={{ background: "var(--c-word)" }} /><span className="ar-classical text-[18px]" lang="ar">{w.display}</span></span>
              <span className="mono text-[11px] text-t3">{formatNumber(w.occurrences, locale)}</span>
            </button>
          </li>
        ))}
        {data?.results.verses.slice(0, 4).map((v) => (
          <li key={`v${v.key}`}>
            <button type="button" className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start hover:bg-card" onClick={() => void addVerse(v.key)}>
              <span className="dot mt-3" style={{ background: "var(--c-sentence)" }} />
              <span className="min-w-0">
                <span className="quran line-clamp-2 text-[16px] leading-[2]" lang="ar">{v.text_qpc}</span>
                <span className="text-[11px] text-t3">{v.name_ar}: {formatNumber(v.ayah, locale)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
