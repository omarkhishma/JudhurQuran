"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Link } from "@/i18n/navigation";
import { publishedPath } from "@/lib/graph/published";
import { cnt, formatNumber } from "@/lib/format";
import { META } from "@/lib/graph/relations";
import { FIELD_KINDS, KIND_COLOR, type GraphNode, type NodeKind } from "@/lib/graph/types";
import { useGraphUi } from "@/lib/graph/uiPrefs";
import { CommentsPanel, useDetailsTab, useSharedMap, type DetailsTab as Tab } from "./Comments";
import { FieldEditor } from "./FieldEditor";
import { useCanvasTools, type CanvasTools } from "./GraphCanvas";
import { Meaning } from "./Meaning";
import { MapSettings } from "./Sharing";
import { sourceHeading } from "@/lib/graph/topics";

const KINDS: NodeKind[] = ["root", "pattern", "lemma", "verse", "note", "frame"];

/**
 * The details beside the canvas (EDT-164…187, HWF-31, HWF-38): a header that names what is selected with its kind and
 * a way to hide the panel; for one card, the chain of cards it comes from; and two tabs — Meaning, what the card
 * stands for in the sources, and Settings, what the reader keeps on it: its headword (a note's own words; a card of
 * the dataset shows its own and is not edited, L1, L2), its fields and its links. Several cards: fold, unfold, tidy or
 * delete them together. A group has settings only. Nothing selected: what the map holds and how to begin, and its
 * settings — sharing and history. Comments (P8.1-E): on the card, or on the whole map. A shared map read by others
 * has Meaning and Comments only.
 */
export function Details({ title }: { title: string }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const tools = useCanvasTools();
  const setUi = useGraphUi((u) => u.set);
  const sel = tools.selected;
  const one = sel.length === 1 ? sel[0] : null;
  const frame = one?.data.kind === "frame" ? one : null;
  const { tab, set: setTab, focus } = useDetailsTab();
  const map = useSharedMap();
  // each map opens on Meaning, as it did when the tab was the panel's own
  useEffect(() => () => useDetailsTab.setState({ tab: "meaning", focus: null }), []);
  // a card's comment marker opens its comments: the card is selected for them
  const asked = useRef<number | null>(null);
  useEffect(() => {
    if (!focus || asked.current === focus.at) return;
    asked.current = focus.at;
    setUi({ detailsOpen: true });
    tools.select(focus.id);
    tools.center(focus.id);
  }, [focus, tools, setUi]);
  // a shared map read by others has no settings; a group has no meaning of its own: it opens on its settings
  // (HWF-31), and so does a selection just grouped
  const tabs: Tab[] = map.published ? ["meaning", "settings"] : tools.editable ? ["meaning", "settings", "comments"] : ["meaning", "comments"];
  const shown: Tab = frame && tab === "meaning" ? "settings" : tabs.includes(tab) ? tab : "meaning";
  const kindName = (n: GraphNode) => {
    const h = n.data.kind === "note" ? sourceHeading(n.id) : null;
    return t(h === "topic" ? "kindTopic" : h === "field" ? "kindField" : h === "entity" ? "kindEntity" : n.data.phrase ? "kindPhrase" : n.data.entry ? "kindQuote" : META[n.data.kind].label);
  };
  const head = frame
    ? t("detailsHeadGroup", { label: frame.data.title || t("groupUntitled") })
    : one
      ? `${kindName(one)} · ${tools.cardName(one.id) || "—"}`
      : sel.length > 1
        ? t("selectedCount", cnt(sel.length, locale))
        : t("nothingSelected");
  const tabsId = "graph-details-tabs";
  return (
    <aside className="graph-details" aria-label={t("details")}>
      <header className="details-head">
        {/* the panel's heading: what it shows, above its sections (heading-order) */}
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-medium text-t1" dir="auto">{head}</h2>
        {one && (
          // the kind's colour drawn toward the text colour, so the small label reads in both themes (the grey of a
          // note fell under 4.5:1 on its own tint)
          <span className="kind-badge" style={{ color: frame ? "var(--t2)" : `color-mix(in srgb, ${KIND_COLOR[one.data.kind]} 72%, var(--t1))`, background: frame ? "var(--card-2)" : `color-mix(in srgb, ${KIND_COLOR[one.data.kind]} 14%, transparent)` }}>
            {kindName(one)}
          </span>
        )}
        <button type="button" className="btn icon-btn h-7 w-7 min-h-0 p-0" onClick={() => setUi({ detailsOpen: false })} title={t("detailsHide")} aria-label={t("detailsHide")}>
          ✕
        </button>
      </header>
      {one && !frame && <Breadcrumb tools={tools} card={one} />}
      {(sel.length > 0 || map.gid || tools.editable || map.published) && (
        <div className="details-tabs" role="tablist" aria-label={t("details")}>
          {tabs.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              id={`${tabsId}-${k}`}
              aria-selected={shown === k}
              aria-controls={`${tabsId}-panel`}
              tabIndex={shown === k ? 0 : -1}
              className={"details-tab" + (shown === k ? " is-on" : "")}
              disabled={!!frame && k === "meaning"}
              onClick={() => setTab(k)}
              onKeyDown={(e) => {
                // the arrows move between the tabs, as a tab list does (in the reading direction)
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                e.preventDefault();
                const on = tabs.filter((x) => !(frame && x === "meaning"));
                const forward = (e.key === "ArrowLeft") === (document.documentElement.dir === "rtl");
                const next = on[(on.indexOf(shown) + (forward ? 1 : on.length - 1)) % on.length];
                setTab(next);
                document.getElementById(`${tabsId}-${next}`)?.focus();
              }}
            >
              {t(k === "meaning" ? "tabMeaning" : k === "settings" ? "tabSettings" : "tabComments")}
            </button>
          ))}
        </div>
      )}
      <div className="details-body" role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${shown}`}>
        {shown === "comments" ? (
          <CommentsPanel tools={tools} />
        ) : frame ? (
          <FrameDetails tools={tools} frame={frame} />
        ) : one ? (
          shown === "meaning" ? (
            <Meaning key={one.id} tools={tools} card={one} />
          ) : (
            <CardSettings key={one.id} tools={tools} card={one} />
          )
        ) : sel.length > 1 ? (
          shown === "meaning" ? (
            <p className="text-[13px] leading-relaxed text-t2">{t("manySelectedMeaning", cnt(sel.length, locale))}</p>
          ) : (
            <ManySettings tools={tools} />
          )
        ) : shown === "settings" && !map.published ? (
          <MapSettings tools={tools} />
        ) : (
          <MapSummary tools={tools} title={title} />
        )}
      </div>
    </aside>
  );
}

/**
 * The panel folded to a rail (EDT-165). Selecting a card opens it again, so its entry is always in view (HWF-38) — on
 * a screen wide enough to hold it beside the canvas.
 */
export function DetailsRail() {
  const t = useTranslations("graph");
  const tools = useCanvasTools();
  const setUi = useGraphUi((u) => u.set);
  const key = tools.selected.map((n) => n.id).join("|");
  const last = useRef(key);
  useEffect(() => {
    if (key === last.current) return;
    last.current = key;
    if (key && window.matchMedia("(min-width: 768px)").matches) setUi({ detailsOpen: true });
  }, [key, setUi]);
  return (
    <aside className="details-rail" aria-label={t("details")}>
      <button type="button" className="btn icon-btn" onClick={() => setUi({ detailsOpen: true })} title={t("detailsShow")} aria-label={t("detailsShow")} aria-expanded={false}>
        <Icon name="chevronEnd" />
      </button>
      <span className="library-rail-label">{t("details")}</span>
    </aside>
  );
}

/** Where a card comes from (EDT-167): its first parent, and that one's, up to the root — eight steps at most. */
function Breadcrumb({ tools, card }: { tools: CanvasTools; card: GraphNode }) {
  const t = useTranslations("graph");
  const chain: GraphNode[] = [];
  const seen = new Set([card.id]);
  let at = card.id;
  for (let i = 0; i < 8; i++) {
    // where a card comes from, not what belongs to it: a topic's verses and a field's members link into it
    const up = tools.edges.find((e) => e.target === at && e.data?.rel !== "part-of-topic" && e.data?.rel !== "field-member" && !seen.has(e.source) && tools.nodes.find((n) => n.id === e.source && n.data.kind !== "note" && n.data.kind !== "frame"));
    if (!up) break;
    const parent = tools.nodes.find((n) => n.id === up.source)!;
    chain.unshift(parent);
    seen.add(parent.id);
    at = parent.id;
  }
  if (!chain.length) return null;
  return (
    <nav className="details-crumbs" aria-label={t("crumbs")}>
      {chain.map((n, i) => (
        <span key={n.id} className="flex items-center gap-1">
          {i > 0 && <span className="text-t3" aria-hidden="true">‹</span>}
          <button
            type="button"
            className="crumb"
            title={t("crumbSelect", { kind: t(META[n.data.kind].label) })}
            onClick={() => {
              tools.select(n.id);
              tools.center(n.id);
            }}
          >
            <span className="dot" style={{ background: KIND_COLOR[n.data.kind] }} />
            {t(META[n.data.kind].label)} · <span lang="ar">{tools.cardName(n.id)}</span>
          </button>
        </span>
      ))}
    </nav>
  );
}

/** Nothing selected (EDT-182): how to begin, and what the map holds by kind. */
function MapSummary({ tools, title }: { tools: CanvasTools; title: string }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const { forkedFrom } = useSharedMap();
  const cards = tools.nodes.filter((n) => n.data.kind !== "frame").length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] leading-relaxed text-t2">{t("nothingSelectedHint")}</p>
      <p className="text-[12.5px] leading-relaxed text-t3">{t("nothingSelectedHow")}</p>
      <p className="label-caps mt-2">{t("thisMap")}</p>
      <p className="text-[15px] font-semibold text-t1">{title}</p>
      <p className="text-[12.5px] text-t2">
        {t(`mapType_${tools.kind}`)} · {t("cards", cnt(cards, locale))} · {t("links", cnt(tools.edges.length, locale))}
      </p>
      {forkedFrom && (
        <p className="text-[12.5px] leading-relaxed text-t2">
          {t("forkedFromLabel")}{" "}
          <Link href={publishedPath(forkedFrom.slug, forkedFrom.version)} className="underline underline-offset-2" dir="auto">
            {forkedFrom.title || forkedFrom.slug}
          </Link>{" "}
          <span className="text-t3">{t("publishedVersionN", { v: formatNumber(forkedFrom.version, locale) })}</span>
        </p>
      )}
      <Breakdown nodes={tools.nodes} />
    </div>
  );
}

function Breakdown({ nodes }: { nodes: GraphNode[] }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {KINDS.map((k) => [k, nodes.filter((n) => n.data.kind === k).length] as const)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => (
          <li key={k} className="flex items-center gap-2 text-[12.5px] text-t2">
            <span className="dot" style={{ background: KIND_COLOR[k] }} />
            {t(META[k].label)}
            <span className="mono ms-auto text-[11.5px] text-t3">{formatNumber(n, locale)}</span>
          </li>
        ))}
    </ul>
  );
}

/** Several cards (EDT-187): what they are by kind, and what can be done to them together. */
function ManySettings({ tools }: { tools: CanvasTools }) {
  const t = useTranslations("graph");
  const ids = tools.selected.map((n) => n.id);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] leading-relaxed text-t2">{t("manySelectedHint")}</p>
      <Breakdown nodes={tools.selected} />
      <div className="mt-1 flex flex-wrap gap-1.5">
        <button type="button" className="btn text-[12.5px]" onClick={() => tools.foldTo(ids, true)} title={t("foldAllHint")}>{t("foldAll")}</button>
        <button type="button" className="btn text-[12.5px]" onClick={() => tools.foldTo(ids, false)} title={t("unfoldAllHint")}>{t("unfoldAll")}</button>
        <button type="button" className="btn text-[12.5px]" onClick={tools.tidy} title={t("tidyHint")}>{t("tidy")}</button>
        {tools.editable && (
          <button type="button" className="btn btn-danger text-[12.5px]" onClick={() => tools.remove(ids)} title={t("deleteHint")}>{t("deleteSelected")}</button>
        )}
      </div>
    </div>
  );
}

/**
 * One card's settings (EDT-183…185, EDT-223): its headword — a note's words edited here as one step; a card of the
 * dataset shows its own and says why it is not edited (L1, L2) — its fields, added from the ten kinds and renamed
 * here, and its links, from and to, each a way to the card at its other end and cut with ✕.
 */
function CardSettings({ tools, card }: { tools: CanvasTools; card: GraphNode }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const d = card.data;
  const [draft, setDraft] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const fields = d.fields ?? [];
  const into = tools.edges.filter((e) => e.target === card.id);
  const out = tools.edges.filter((e) => e.source === card.id);
  const ownText = d.kind === "note" && !d.entry;
  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-1.5" aria-label={t("headword")}>
        <p className="label-caps">{t("headword")}</p>
        {ownText && tools.editable ? (
          <textarea
            className="field-input min-h-[80px] resize-y"
            dir="auto"
            aria-label={t("headwordNote")}
            value={draft ?? d.text ?? ""}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft !== null && draft !== (d.text ?? "")) tools.editHeadword(card.id, draft);
              setDraft(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setDraft(null);
                const el = e.currentTarget;
                requestAnimationFrame(() => el.blur());
              }
            }}
          />
        ) : (
          <>
            <dl className="headword-rows">
              <dt>{t("headwordArabic")}</dt>
              <dd className="ar-classical text-[17px]" lang="ar">{d.kind === "verse" ? tools.cardName(card.id) : d.entry ? tools.cardName(card.id) : d.ar || d.text || "—"}</dd>
              {d.sub && d.kind !== "note" && (
                <>
                  <dt>{t(d.kind === "lemma" ? "headwordGrammar" : "headwordTranslit")}</dt>
                  <dd className={d.kind === "lemma" ? "text-[13px]" : "mono text-[12px]"} dir="auto">{d.sub}</dd>
                </>
              )}
            </dl>
            <p className="text-[11.5px] leading-relaxed text-t3">{t(d.kind === "verse" ? "headwordVerse" : d.entry ? "headwordQuote" : "headwordData")}</p>
          </>
        )}
      </section>

      <section className="flex flex-col gap-1.5" aria-label={t("fieldsTitle")}>
        <div className="flex items-center gap-2">
          <p className="label-caps">{t("fieldsTitle")}</p>
          <span className="h-px flex-1 bg-line" />
          {tools.editable && (
            <button type="button" className="text-[11.5px] text-word" onClick={() => setMenu(!menu)} aria-expanded={menu} title={t("fieldAddHint")}>
              {t("fieldAdd")}
            </button>
          )}
        </div>
        {menu && (
          <div className="field-menu" role="menu" aria-label={t("fieldAddHint")}>
            {/* the map type's own fields (B37): on this card, or on every card of its kind that lacks it */}
            {tools.templates(d.kind).map((tp) => {
              const lack = tools.nodes.filter((n) => n.data.kind === d.kind && !(n.data.fields ?? []).some((f) => f.tpl === tp.id));
              const here = lack.some((n) => n.id === card.id);
              return (
                <div key={tp.id} className="field-menu-tpl">
                  {here && (
                    <button
                      type="button"
                      role="menuitem"
                      className="is-template"
                      onClick={() => {
                        setMenu(false);
                        tools.addTemplate([card.id], tp.id);
                      }}
                    >
                      {t(`tpl_${tp.id}`)}
                    </button>
                  )}
                  {lack.length > 1 && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenu(false);
                        tools.addTemplate(lack.map((n) => n.id), tp.id);
                      }}
                    >
                      {t("tplEvery", { label: t(`tpl_${tp.id}`), ...cnt(lack.length, locale) })}
                    </button>
                  )}
                </div>
              );
            })}
            {tools.templates(d.kind).length > 0 && <p className="field-menu-note">{t("tplNote")}</p>}
            {FIELD_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  tools.addField(card.id, k);
                }}
              >
                {t(`field_${k}`)}
              </button>
            ))}
          </div>
        )}
        {fields.length === 0 ? (
          <p className="text-[12px] text-t3">{t("fieldsNoneHere")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {fields.map((f) => (
              <FieldEditor
                key={f.id}
                field={f}
                density="panel"
                editable={tools.editable}
                onValue={(v, name) => tools.editField(card.id, f.id, v, name)}
                onRemove={() => tools.removeField(card.id, f.id)}
                onLabel={(label) => tools.renameField(card.id, f.id, label)}
                onError={(m) => tools.toast(m)}
                onOptions={f.kind === "select" ? (o) => tools.editOptions(card.id, f.id, o) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-1.5" aria-label={t("linksTitle")}>
        <p className="label-caps">{t("linksTitle")}</p>
        {into.length + out.length === 0 ? (
          <p className="text-[12px] leading-relaxed text-t3">{t("linksNone")}</p>
        ) : (
          <ul className="flex flex-col">
            {[...into.map((e) => ({ e, other: e.source, dir: "from" as const })), ...out.map((e) => ({ e, other: e.target, dir: "to" as const }))].map(({ e, other, dir }) => {
              const o = tools.nodes.find((n) => n.id === other);
              if (!o) return null;
              return (
                <li key={e.id} className="link-row">
                  <span className="dot" style={{ background: KIND_COLOR[o.data.kind] }} />
                  <span className="w-9 shrink-0 text-[11.5px] text-t3">{t(dir === "from" ? "linkFrom" : "linkTo")}</span>
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-start text-[12.5px] text-t1 hover:underline"
                    title={t("linkSelect")}
                    onClick={() => {
                      tools.select(other);
                      tools.center(other);
                    }}
                  >
                    {t(META[o.data.kind].label)} · <span lang="ar">{tools.cardName(other)}</span>
                  </button>
                  <span className="shrink-0 text-[11.5px] text-t3">{t(`rel_${e.data?.rel ?? "next"}`)}</span>
                  {tools.editable && (
                    <button type="button" className="field-remove" onClick={() => tools.unlink(e.id)} title={t("linkRemove")} aria-label={`${t("linkRemove")}: ${tools.cardName(other)}`}>
                      ×
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** A frame's settings (EDT-148, EDT-149): its name — kept as one undo step on Enter or leaving the field, Escape
 * leaving it as it was; how many cards sit inside; selecting them and releasing the group. */
function FrameDetails({ tools, frame }: { tools: CanvasTools; frame: GraphNode }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const inside = tools.frameMembers(frame.id);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <label className="label-caps" htmlFor={`frame-name-${frame.id}`}>{t("groupName")}</label>
      <input
        id={`frame-name-${frame.id}`}
        className="h-9 rounded-lg border border-line bg-card px-3 text-[14px] outline-none focus:border-ring"
        value={draft ?? frame.data.title ?? ""}
        placeholder={t("groupUntitled")}
        aria-label={t("groupName")}
        readOnly={!tools.editable}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null && draft.trim() !== (frame.data.title ?? "")) tools.renameFrame(frame.id, draft.trim());
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") {
            e.stopPropagation();
            setDraft(null);
            // the draft is dropped before the blur keeps it
            const el = e.currentTarget;
            requestAnimationFrame(() => el.blur());
          }
        }}
      />
      <p className="text-[12.5px] leading-relaxed text-t2">{t("groupInside", cnt(inside.length, locale))}</p>
      {tools.editable && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="btn text-[12.5px]" onClick={() => tools.selectIds(inside)} disabled={!inside.length}>{t("frameSelectInside")}</button>
          <button type="button" className="btn text-[12.5px]" onClick={tools.ungroup}>{t("frameUngroup")}</button>
        </div>
      )}
    </div>
  );
}
