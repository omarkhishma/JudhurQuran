"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { ApiError, SignedOut, useAccount } from "@/lib/account/store";
import { useIsClient } from "@/lib/client";
import { getAwaiting, getTargets, getWorklists, KINDS, LAYERS, STATES, type Kind, type Layer, type State } from "@/lib/editorial";
import { cnt, formatNumber } from "@/lib/format";
import { EntryView } from "./EntryView";
import { LayerView } from "./LayerView";

export type Place = { kind: Kind; layer?: Layer; target?: string; state: State; q: string };

/**
 * The editorial workbench (P3.0, research 14): for the board only — anyone else is told what it is and who it is
 * for. Its worklists with their counts; a worklist's targets, the most used in the Quran first, by the state of the
 * board's work; a target's page with the sources' candidates, the form, the review and the history; the rows a book
 * gave, judged in batches; and what waits on this editor's review. The place is held in the address.
 */
export function Workbench({ initial }: { initial: Place }) {
  const t = useTranslations("workbench");
  const locale = useLocale();
  const client = useIsClient();
  const session = useAccount((s) => s.session);
  const [place, setPlace] = useState<Place>(initial);
  const lists = useQuery({ queryKey: ["editorial-worklists", session], queryFn: getWorklists, enabled: client && !!session, retry: false, refetchOnWindowFocus: true });

  useEffect(() => {
    const qs = new URLSearchParams({ kind: place.kind });
    if (place.layer) qs.set("layer", place.layer);
    if (place.target) qs.set("target", place.target);
    if (place.state !== "all") qs.set("state", place.state);
    if (place.q) qs.set("q", place.q);
    window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
  }, [place]);

  if (!client) return <div className="mx-auto h-64 max-w-[1200px] animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  if (!session || lists.error instanceof SignedOut)
    return (
      <Gate title={t("gateTitle")}>
        <p>{t("gateSignIn")}</p>
        <Link href="/signin?next=/workbench" className="btn btn-primary self-start">{t("signIn")}</Link>
      </Gate>
    );
  if (lists.error instanceof ApiError && lists.error.status === 403)
    return (
      <Gate title={t("gateTitle")}>
        <p>{t("gateNotBoard")}</p>
        <Link href="/review/guidelines" className="btn self-start">{t("gateGuidelines")}</Link>
      </Gate>
    );
  if (lists.isError) return <Gate title={t("gateTitle")}><p role="alert">{t("loadFailed")}</p></Gate>;

  const go = (p: Partial<Place>) => setPlace((x) => ({ ...x, target: undefined, ...p }));
  const w = lists.data;
  return (
    <div className="workbench">
      <nav className="workbench-nav" aria-label={t("worklists")}>
        <h1 className="text-[18px] font-semibold">{t("title")}</h1>
        <p className="text-[12px] leading-relaxed text-t3">{t("lead")}</p>
        {/* on a phone the worklists are one choice, not a column */}
        <label className="workbench-picker">
          <span className="sr-only">{t("worklists")}</span>
          <select
            className="field-input"
            value={place.layer ? `layer:${place.layer}` : place.kind === "verdict" ? "awaiting" : `kind:${place.kind}`}
            onChange={(e) => {
              const [what, name] = e.target.value.split(":");
              if (what === "awaiting") go({ kind: "verdict", layer: undefined, state: "all" });
              else if (what === "kind") go({ kind: name as Kind, layer: undefined, state: "all", q: "" });
              else go({ kind: "verdict", layer: name as Layer, state: "all", q: "" });
            }}
          >
            <option value="awaiting">{`${t("awaitingMe")} (${formatNumber(w?.awaiting_me ?? 0, locale)})`}</option>
            <optgroup label={t("writing")}>
              {KINDS.map((k) => (
                <option key={k} value={`kind:${k}`}>{t(`kind_${k}`)}</option>
              ))}
            </optgroup>
            <optgroup label={t("rows")}>
              {LAYERS.map((l) => (
                <option key={l} value={`layer:${l}`}>{t(`layer_${l}`)}</option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="workbench-nav-list">
        <button type="button" className={"workbench-tab" + (place.kind === "verdict" && !place.layer ? " is-on" : "")} onClick={() => go({ kind: "verdict", layer: undefined, state: "all" })}>
          <span>{t("awaitingMe")}</span>
          <span className="mono">{formatNumber(w?.awaiting_me ?? 0, locale)}</span>
        </button>
        <p className="label-caps mt-2">{t("writing")}</p>
        {KINDS.map((k) => {
          const c = w?.kinds.find((x) => x.kind === k);
          return (
            <button key={k} type="button" className={"workbench-tab" + (place.kind === k ? " is-on" : "")} aria-current={place.kind === k ? "page" : undefined} onClick={() => go({ kind: k, layer: undefined, state: "all", q: "" })}>
              <span>{t(`kind_${k}`)}</span>
              {c && <span className="text-[11.5px] text-t3">{t("countOf", { done: formatNumber(c.approved, locale), total: formatNumber(c.total, locale) })}</span>}
            </button>
          );
        })}
        <p className="label-caps mt-2">{t("rows")}</p>
        {LAYERS.map((l) => {
          const c = w?.layers.find((x) => x.layer === l);
          return (
            <button key={l} type="button" className={"workbench-tab" + (place.layer === l ? " is-on" : "")} aria-current={place.layer === l ? "page" : undefined} onClick={() => go({ kind: "verdict", layer: l, state: "all", q: "" })}>
              <span>{t(`layer_${l}`)}</span>
              {c && <span className="text-[11.5px] text-t3">{t("countOf", { done: formatNumber(c.approved, locale), total: formatNumber(c.total, locale) })}</span>}
            </button>
          );
        })}
        </div>
      </nav>
      {/* the page's main landmark is the site's; the workbench's own column is a part of it */}
      <div className="workbench-main" id="workbench-main">
        {place.kind === "verdict" && !place.layer ? (
          <Awaiting onOpen={(kind, target) => setPlace({ kind, target, state: "all", q: "", layer: kind === "verdict" ? (target.split(":")[0] as Layer) : undefined })} />
        ) : place.kind === "verdict" && place.layer && !place.target ? (
          <LayerView layer={place.layer} state={place.state} q={place.q} onPlace={(p) => setPlace((x) => ({ ...x, ...p }))} />
        ) : place.target ? (
          <EntryView kind={place.kind} target={place.target} onBack={() => setPlace((x) => ({ ...x, target: undefined }))} />
        ) : (
          <TargetList place={place} counts={w?.kinds.find((x) => x.kind === place.kind)} onPlace={(p) => setPlace((x) => ({ ...x, ...p }))} />
        )}
      </div>
    </div>
  );
}

function Gate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-3 px-4 py-16 text-[14px] leading-relaxed text-t2">
      <h1 className="text-[22px] font-semibold text-t1">{title}</h1>
      {children}
    </div>
  );
}

/** The work in review that waits on this editor: none of it their own, none they have decided. */
function Awaiting({ onOpen }: { onOpen: (kind: Kind, target: string) => void }) {
  const t = useTranslations("workbench");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["editorial-awaiting"], queryFn: getAwaiting, refetchOnWindowFocus: true });
  return (
    <section className="flex flex-col gap-3" aria-labelledby="awaiting-h">
      <h2 id="awaiting-h" className="text-[16px] font-semibold">{t("awaitingMe")}</h2>
      <p className="text-[12.5px] text-t3">{t("awaitingLead")}</p>
      {q.isPending ? (
        <span className="block h-24 animate-pulse rounded-lg bg-card-2" aria-hidden="true" />
      ) : !q.data?.data.length ? (
        <p className="text-[13px] text-t2">{t("awaitingNone")}</p>
      ) : (
        <ul className="workbench-rows">
          {q.data.data.map((e) => (
            <li key={e.id}>
              <button type="button" className="workbench-row" onClick={() => onOpen(e.kind, e.target)}>
                <span className="text-[12px] text-t3">{t(e.kind === "verdict" ? `layer_${e.target.split(":")[0]}` : `kind_${e.kind}`)}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-t1" dir="auto">{e.kind === "verdict" ? e.target.split(":").slice(1).join(":") : e.target}</span>
                <span className="text-[12px] text-t3">{t("byAt", { name: e.author.name ?? t("anEditor"), date: new Date(e.updated_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB") })}</span>
                <span className="state-chip is-review">{t("revisionN", { n: formatNumber(e.revision, locale) })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A worklist's targets, the most used in the Quran first, by the state of the board's work on each. */
function TargetList({ place, counts, onPlace }: { place: Place; counts?: { total: number; approved: number; review: number }; onPlace: (p: Partial<Place>) => void }) {
  const t = useTranslations("workbench");
  const locale = useLocale();
  const [query, setQuery] = useState(place.q);
  const q = useInfiniteQuery({
    queryKey: ["editorial-targets", place.kind, place.state, place.q],
    queryFn: ({ pageParam }) => getTargets(place.kind, { state: place.state, q: place.q, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (all.reduce((n, p) => n + p.data.length, 0) < last.total ? all.reduce((n, p) => n + p.data.length, 0) : undefined),
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="targets-h">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 id="targets-h" className="text-[16px] font-semibold">{t(`kind_${place.kind}`)}</h2>
        {counts && <span className="text-[12.5px] text-t3">{t("inForceOf", { done: formatNumber(counts.approved, locale), total: formatNumber(counts.total, locale) })}</span>}
      </div>
      <p className="text-[12.5px] leading-relaxed text-t3">{t(`kindLead_${place.kind}`)}</p>
      {place.kind === "topic" && (
        // a topic of the board's own: a new key, named and sourced on its page (P8.3b)
        <button type="button" className="btn self-start" onClick={() => onPlace({ target: `board:${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}` })}>
          {t("newTopic")}
        </button>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="seg-group" role="group" aria-label={t("state")}>
          {STATES.map((s) => (
            <button key={s} type="button" className={"seg" + (place.state === s ? " is-on" : "")} aria-pressed={place.state === s} onClick={() => onPlace({ state: s })}>
              {t(`state_${s}`)}
            </button>
          ))}
        </div>
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onPlace({ q: query.trim() });
          }}
        >
          <input className="field-input flex-1" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} dir="auto" />
        </form>
      </div>
      <p className="text-[12px] text-t3" role="status">{q.isPending ? "" : t("found", cnt(total, locale))}</p>
      <ul className="workbench-rows">
        {items.map((it) => (
          <li key={it.key}>
            <button type="button" className="workbench-row" onClick={() => onPlace({ target: it.key })}>
              <span className="ar-classical min-w-[96px] text-[19px] text-t1" lang="ar">{it.label}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-t3" dir="auto">{it.sub}</span>
              {it.occurrences != null && place.kind !== "glossary" && <span className="mono text-[11.5px] text-t3">{formatNumber(it.occurrences, locale)}</span>}
              <span className={`state-chip is-${it.state}`}>{t(`state_${it.state}`)}</span>
            </button>
          </li>
        ))}
      </ul>
      {q.hasNextPage && (
        <button type="button" className="btn self-start" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {t("more")}
        </button>
      )}
    </section>
  );
}
