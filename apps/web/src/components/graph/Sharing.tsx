"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Link, usePathname } from "@/i18n/navigation";
import { errorKind } from "@/lib/account/errors";
import { useAccount } from "@/lib/account/store";
import { cnt } from "@/lib/format";
import { listVersions } from "@/lib/graph/history";
import { upgrade } from "@/lib/graph/migrate";
import { encodeShare } from "@/lib/graph/persist";
import { shareMap, sharedPath, sharedRevision, sharedRevisions, stopSharing } from "@/lib/graph/shared";
import type { GraphDoc, SharedRef } from "@/lib/graph/types";
import { useSharedMap } from "./Comments";
import type { CanvasTools } from "./GraphCanvas";

const absolute = (path: string) => `${window.location.origin}${window.location.pathname.startsWith("/en") ? "/en" : ""}${path}`;

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sharing a map (P8.1-E): for comments — the map put on the server under a link, saved there by its owner as they
 * work, read by whoever has the link and commented on by those signed in; stopped at any time, which deletes the
 * shared copy and its comments — or as a copy in a link that carries the whole map and never reaches us.
 */
export function ShareDialog({ open, onClose, doc, shared, onShared, onStopped }: { open: boolean; onClose: () => void; doc: GraphDoc; shared: SharedRef | null; onShared: (s: SharedRef) => void; onStopped: () => void }) {
  const t = useTranslations("graph");
  const terr = useTranslations("account");
  const path = usePathname();
  const session = useAccount((s) => s.session);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const files = doc.nodes.some((n) => (n.data.fields ?? []).some((f) => f.kind === "image" || f.kind === "audio" || f.kind === "file"));
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
  const link = shared ? absolute(sharedPath(shared.id)) : "";
  return (
    <Dialog open={open} onClose={onClose} label={t("shareTitle")} width={520}>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center">
          <h2 className="text-[15px] font-semibold">{t("shareTitle")}</h2>
          <span className="flex-1" />
          <button type="button" className="btn icon-btn" onClick={onClose} aria-label={t("closeDialog")}>✕</button>
        </div>

        <section className="flex flex-col gap-2" aria-labelledby="share-comments-h">
          <h3 id="share-comments-h" className="label-caps">{t("shareForComments")}</h3>
          <p className="text-[13px] leading-relaxed text-t2">{t("shareForCommentsLead")}</p>
          {!session ? (
            <Link href={`/signin?next=${encodeURIComponent(path)}`} className="btn btn-primary self-start">{t("signInToShare")}</Link>
          ) : !shared ? (
            <button
              type="button"
              className="btn btn-primary self-start"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const s = await shareMap(doc.id, doc);
                  onShared({ id: s.id, revision: s.revision });
                  if (await copy(absolute(sharedPath(s.id)))) setSaid(t("shareLinkCopied"));
                })
              }
            >
              {t("shareStart")}
            </button>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <input className="field-input min-w-0 flex-1 text-[12.5px]" value={link} readOnly dir="ltr" aria-label={t("shareLink")} onFocus={(e) => e.target.select()} />
                <button type="button" className="btn" onClick={() => void copy(link).then((ok) => setSaid(ok ? t("shareLinkCopied") : null))}>{t("copyLink")}</button>
              </div>
              <p className="text-[12px] text-t3">{t("shareLive")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={sharedPath(shared.id)} className="btn text-[12.5px]" target="_blank">{t("shareSeeAsOthers")}</Link>
                {asking ? (
                  <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-t2">
                    {t("shareStopAsk")}
                    <button
                      type="button"
                      className="btn text-bad"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await stopSharing(shared.id);
                          setAsking(false);
                          setSaid(t("shareStopped"));
                          onStopped();
                        })
                      }
                    >
                      {t("shareStop")}
                    </button>
                    <button type="button" className="btn" onClick={() => setAsking(false)}>{t("cancel")}</button>
                  </span>
                ) : (
                  <button type="button" className="btn text-[12.5px]" onClick={() => setAsking(true)}>{t("shareStop")}</button>
                )}
              </div>
            </>
          )}
          {files && <p className="text-[12px] leading-relaxed text-t3">{t("shareFilesStay")}</p>}
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-3" aria-labelledby="share-copy-h">
          <h3 id="share-copy-h" className="label-caps">{t("shareCopy")}</h3>
          <p className="text-[13px] leading-relaxed text-t2">{t("shareCopyLead")}</p>
          <button
            type="button"
            className="btn self-start"
            onClick={() => void copy(absolute(`/graph/view#${encodeShare(doc)}`)).then((ok) => setSaid(ok ? t("shareCopied") : null))}
          >
            {t("copyLink")}
          </button>
        </section>
        <p className="min-h-[1.2em] text-[12.5px] text-t2" role="status" aria-live="polite">{said}</p>
        {error && <p className="text-[12.5px] text-bad" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}

/**
 * The map's own settings, with nothing selected: whether it is private or shared for comments, and its history —
 * the server's for a shared map, this browser's for a private one — each version restorable as one undoable step.
 */
export function MapSettings({ tools }: { tools: CanvasTools }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const map = useSharedMap();
  const session = useAccount((s) => s.session);
  const server = !!map.gid && map.owner && !!session;
  const versions = useQuery({
    queryKey: ["map-history", map.gid ?? map.mapId ?? "", server],
    queryFn: async () =>
      server
        ? (await sharedRevisions(map.gid!)).data.map((r) => ({ key: `r${r.revision}`, at: Date.parse(r.saved_at), cards: r.cards, revision: r.revision }))
        : (await listVersions(map.mapId!)).map((v, i) => ({ key: `l${i}`, at: v.at, cards: v.cards, revision: null as number | null, local: v })),
    enabled: !!map.mapId && map.owner,
    staleTime: 0,
  });
  const when = (ms: number) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(ms));
  const [error, setError] = useState(false);
  async function restore(v: NonNullable<typeof versions.data>[number]) {
    setError(false);
    try {
      const raw = "local" in v && v.local ? { version: 2, nodes: v.local.nodes, edges: v.local.edges } : (await sharedRevision(map.gid!, v.revision!)).doc;
      // a version is read as any stored map is: cleaned, and a version-1 copy migrated
      const got = await upgrade(raw.version, tools.kind, raw.nodes, raw.edges);
      tools.importCards(got.nodes, got.edges, t("doRestore", { when: when(v.at) }));
      tools.toast(t("restored", { when: when(v.at) }), true);
    } catch {
      setError(true);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-1.5" aria-labelledby="map-share-h">
        <p id="map-share-h" className="label-caps">{t("sharing")}</p>
        <p className="text-[13px] leading-relaxed text-t2">{t(map.gid ? "sharingOn" : "sharingOff")}</p>
        {map.openShare && (
          <button type="button" className="btn self-start text-[12.5px]" onClick={map.openShare}>
            {t(map.gid ? "sharingManage" : "shareForComments")}
          </button>
        )}
      </section>
      {map.owner && (
        <section className="flex flex-col gap-1.5" aria-labelledby="map-history-h">
          <p id="map-history-h" className="label-caps">{t("history")}</p>
          <p className="text-[12px] leading-relaxed text-t3">{t(server ? "historyShared" : "historyLocal")}</p>
          {versions.isPending ? null : !versions.data?.length ? (
            <p className="text-[12.5px] text-t3">{t("historyNone")}</p>
          ) : (
            <ol className="flex flex-col">
              {versions.data.map((v) => (
                <li key={v.key} className="flex items-center gap-2 border-b border-line py-1.5 text-[12.5px] last:border-b-0">
                  <time className="text-t1" dateTime={new Date(v.at).toISOString()}>{when(v.at)}</time>
                  <span className="text-t3">{t("cards", cnt(v.cards, locale))}</span>
                  <span className="flex-1" />
                  {tools.editable && (
                    <button type="button" className="btn text-[12px]" onClick={() => void restore(v)}>{t("restore")}</button>
                  )}
                </li>
              ))}
            </ol>
          )}
          {error && <p className="text-[12px] text-bad" role="alert">{t("restoreFailed")}</p>}
        </section>
      )}
    </div>
  );
}
