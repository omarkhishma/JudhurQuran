"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError, useAccount } from "@/lib/account/store";
import { formatNumber } from "@/lib/format";
import { upgrade } from "@/lib/graph/migrate";
import { createGraph, loadGraph, putGraph } from "@/lib/graph/persist";
import { useSharedPresence } from "@/lib/graph/presence";
import { isGone, readShared, type SharedDoc } from "@/lib/graph/shared";
import type { GraphEdge, GraphNode } from "@/lib/graph/types";
import { translitOn, useGraphUi } from "@/lib/graph/uiPrefs";
import { CommentsPanel, SharedMapContext, useMapComments } from "./Comments";
import { Details, DetailsRail } from "./Details";
import { GraphCanvas, useCanvasTools } from "./GraphCanvas";
import { PresenceBlock } from "./Presence";
import { SplitReceiver } from "./SplitReceiver";

type Loaded = SharedDoc & { nodes: GraphNode[]; edges: GraphEdge[] };

/** A shared map read as any stored map is: cleaned, a verse drawn from its key, a version-1 copy migrated. */
async function load(id: string): Promise<Loaded> {
  const got = await readShared(id);
  const { nodes, edges } = await upgrade(got.doc.version, got.kind, got.doc.nodes, got.doc.edges);
  return { ...got, nodes, edges };
}

/**
 * A map shared for comments, as those with its link see it (P8.1-E): read-only, the owner's last save, looked at
 * again every half minute — a newer save offered, never pushed under the reader's eyes; Meaning and Comments beside
 * it (a sheet on the phone); a copy to keep as one's own. Its owner is sent to their own copy in the editor.
 */
export function SharedMapView({ id }: { id: string }) {
  const t = useTranslations("graph");
  const router = useRouter();
  const session = useAccount((s) => s.session);
  const q = useQuery({ queryKey: ["shared-map", id, !!session], queryFn: () => load(id), refetchInterval: 30_000, refetchOnWindowFocus: true, retry: (n, e) => !isGone(e) && n < 2 });
  const [shown, setShown] = useState(0);
  const [ownerHere, setOwnerHere] = useState<"checking" | "none" | null>(null);
  const data = q.data;
  // the owner's own copy is the map they edit: they are taken there when this browser has it
  useEffect(() => {
    if (!data?.owner.mine || !data.local_id) return;
    let live = true;
    void loadGraph(data.local_id).then((mine) => {
      if (!live) return;
      if (mine) router.replace(`/graph/edit/${data.local_id}`);
      else setOwnerHere("none");
    });
    return () => {
      live = false;
    };
  }, [data?.owner.mine, data?.local_id, router]);
  if (q.isPending || (data?.owner.mine && ownerHere !== "none")) return <p className="p-6 text-t3">…</p>;
  // a lesson's map (P9.3): its class reads it, signed in — said as such, never as a map no longer shared
  if (!data && q.error instanceof ApiError && q.error.code === "class_only")
    return (
      <div className="mx-auto flex max-w-[560px] flex-1 flex-col items-start justify-center gap-3 px-4 py-16">
        <h1 className="text-[20px] font-semibold">{t("classMapOnly")}</h1>
        <p className="text-[14px] leading-relaxed text-t2">{t("classMapOnlyBody")}</p>
        <div className="flex flex-wrap gap-2">
          {!session && <Link href={`/signin?next=${encodeURIComponent(`/graph/shared/${id}`)}`} className="btn btn-primary">{t("classMapSignIn")}</Link>}
          <Link href="/classroom" className="btn">{t("classroomLink")}</Link>
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="mx-auto flex max-w-[560px] flex-1 flex-col items-start justify-center gap-3 px-4 py-16">
        <h1 className="text-[20px] font-semibold">{t(isGone(q.error) ? "sharedGone" : "sharedFailed")}</h1>
        {isGone(q.error) && <p className="text-[14px] leading-relaxed text-t2">{t("sharedGoneBody")}</p>}
        <div className="flex flex-wrap gap-2">
          {!isGone(q.error) && (
            <button type="button" className="btn btn-primary" onClick={() => void q.refetch()}>{t("retry")}</button>
          )}
          <Link href="/graph" className="btn">{t("editorTitle")}</Link>
        </div>
      </div>
    );
  return <Viewer key={shown} data={data} onShowNewer={() => setShown((n) => n + 1)} />;
}

function Viewer({ data, onShowNewer }: { data: Loaded; onShowNewer: () => void }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const translit = translitOn(useGraphUi((u) => u.translit), locale);
  const detailsOpen = useGraphUi((u) => u.detailsOpen);
  // what the reader is looking at stays until they ask for the newer save
  const [first] = useState(data);
  const [sheet, setSheet] = useState(false);
  return (
    <SharedMapContext.Provider value={{ gid: data.id, owner: data.owner.mine }}>
      <div className="flex min-h-0 flex-1 flex-col">
        <GraphCanvas
          initialNodes={first.nodes}
          initialEdges={first.edges}
          title={first.title || t("untitled")}
          kind={first.kind}
          translit={translit}
          header={<SharedHeader first={first} newer={data.revision > first.revision} onShowNewer={onShowNewer} onComments={() => setSheet(true)} />}
          end={
            <>
              {/* framed in a lesson's page (P9.3): says it is here, finds a card, hands the map over */}
              <SplitReceiver readOnly />
              {detailsOpen ? <Details title={first.title} /> : <DetailsRail />}
              {sheet && <CommentsSheet onClose={() => setSheet(false)} />}
            </>
          }
        />
      </div>
    </SharedMapContext.Provider>
  );
}

function SharedHeader({ first, newer, onShowNewer, onComments }: { first: Loaded; newer: boolean; onShowNewer: () => void; onComments: () => void }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const tools = useCanvasTools();
  const router = useRouter();
  const detailsOpen = useGraphUi((u) => u.detailsOpen);
  const setUi = useGraphUi((u) => u.set);
  const comments = useMapComments(first.id);
  // who else is on the map now, the owner among them when they edit it (P8.6)
  const { presence } = useSharedPresence(first.id, false);
  const open = (comments.data?.data ?? []).filter((c) => !c.parent_id && !c.resolved_at && !c.deleted).length;
  const title = first.title || t("untitled");
  async function keepCopy() {
    const id = await createGraph({ title: t("myCopyTitle", { title }), kind: first.kind, nodes: tools.nodes, edges: tools.edges });
    router.push(`/graph/edit/${id}`);
  }
  async function openMine() {
    const now = Date.now();
    await putGraph({ version: 2, id: first.local_id!, title, kind: first.kind, nodes: first.nodes, edges: first.edges, createdAt: now, updatedAt: now, shared: { id: first.id, revision: first.revision } });
    router.push(`/graph/edit/${first.local_id}`);
  }
  return (
    <>
      <header className="editor-header is-shared" aria-label={t("editorHeader")}>
        <span className="editor-mark" aria-hidden="true" />
        <Link href="/graph" className="btn shrink-0" title={t("backToMaps")}>
          <Icon name="chevronStart" />
          {t("editorTitle")}
        </Link>
        <div className="shared-title min-w-0">
          <h1 className="truncate text-[15px] font-semibold">{title}</h1>
          <p className="truncate text-[11.5px] text-t3">
            {first.class ? t("classMapOf", { lesson: first.class.lesson_title, class: first.class.class_name }) : `${first.owner.name ? t("sharedBy", { name: first.owner.name }) : t("sharedByReader")} · ${t("sharedReadOnly")}`}
          </p>
        </div>
        {presence && <PresenceBlock presence={presence} />}
        <span className="shared-spacer flex-1" />
        <div className="seg-group shrink-0">
          <button type="button" className="seg" onClick={tools.tidy} title={t("tidyHint")}>{t("tidy")}</button>
          <button type="button" className="seg" onClick={tools.fit} title={t("fitHint")}>{t("fit")}</button>
        </div>
        <button type="button" className="btn shrink-0" onClick={() => void keepCopy()}>{t("saveCopy")}</button>
        <button type="button" className="btn shrink-0 md:hidden" onClick={onComments} aria-haspopup="dialog">
          <Icon name="comment" />
          {t("tabComments")}
          {open > 0 && <span className="mono text-[11px]">{formatNumber(open, locale)}</span>}
        </button>
        <button type="button" className="btn shrink-0 max-md:hidden" aria-pressed={detailsOpen} onClick={() => setUi({ detailsOpen: !detailsOpen })} title={t("detailsToggle")}>
          {t("details")}
        </button>
        <ThemeToggle />
      </header>
      {newer && (
        <div className="graph-conflict flex flex-wrap items-center gap-2 border-b border-line px-3 py-2" role="status">
          <p className="min-w-0 flex-1 text-[13px] text-t1">{t("sharedNewerHere")}</p>
          <button type="button" className="btn btn-primary" onClick={onShowNewer}>{t("sharedShowNewer")}</button>
        </div>
      )}
      {first.owner.mine && (
        <div className="graph-conflict flex flex-wrap items-center gap-2 border-b border-line px-3 py-2" role="status">
          <p className="min-w-0 flex-1 text-[13px] text-t1">{t("sharedYours")}</p>
          <button type="button" className="btn btn-primary" onClick={() => void openMine()}>{t("sharedOpenMine")}</button>
        </div>
      )}
    </>
  );
}

/** The comments on the phone, where the details do not fit beside the canvas: a sheet over it. */
function CommentsSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("graph");
  const tools = useCanvasTools();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="comments-sheet" role="dialog" aria-modal="true" aria-label={t("tabComments")}>
      <div className="flex items-center border-b border-line px-3 py-2">
        <h2 className="text-[14px] font-semibold">{t("tabComments")}</h2>
        <span className="flex-1" />
        <button type="button" className="btn icon-btn" onClick={onClose} aria-label={t("closeDialog")} autoFocus>✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <CommentsPanel tools={tools} />
      </div>
    </div>
  );
}
