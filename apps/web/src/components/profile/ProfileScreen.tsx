"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { initial, SignInSheet } from "@/components/account/AccountButton";
import { Dialog } from "@/components/ui/Dialog";
import { Link, usePathname } from "@/i18n/navigation";
import { authFetch, useAccount } from "@/lib/account/store";
import { myProposals, type ProposalOut } from "@/lib/contrib";
import { useIsClient } from "@/lib/client";
import { cnt, cnt2, formatNumber, verseRef } from "@/lib/format";
import { useMyGraphs } from "@/lib/graph/useMyGraphs";
import { listTexts, loadText } from "@/lib/library/texts";
import { applyImport, type ImportPlan, MAX_IMPORT_BYTES, planCounts, planImport } from "@/lib/importData";
import { deleteLocalData, exportLocalData } from "@/lib/localData";
import { TABS, type Tab } from "@/lib/profile";
import { mergeSessions, usePersonal } from "@/lib/reader/store";
import { useNotebook, useNotebookReady } from "@/lib/store/notebook";
import { useReview } from "@/lib/store/review";
import { useSaved } from "@/lib/store/saved";
import { runSync, useSyncStatus } from "@/lib/sync/run";
import { AccountPanel, type Me } from "./AccountPanel";


const download = (name: string, data: unknown) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // PRF-13: the blob is let go
};

/**
 * The Profile (06 §6.7, inventory PRF-01…35 with PRF-Q01…Q07): who the reader is here — a local reader, or an
 * account with its name, affiliation, ORCID and role — what they have, their own records in tabs that link back
 * to where each was made, and their data as a first-class part of the screen: export everything, export the
 * account's copy, download the texts, delete this device's data in two clicks, and, in the Account tab, the
 * settings, devices, replaced versions, signing out and deleting the account. Nothing is public by default.
 */
export function ProfileScreen({ initialTab }: { initialTab: Tab }) {
  const t = useTranslations("me");
  const client = useIsClient();
  const user = useAccount((s) => s.user);
  const session = useAccount((s) => s.session);
  const [tab, setTab] = useState<Tab>(initialTab);
  const me = useQuery({ queryKey: ["me", session], queryFn: () => authFetch<Me>("/me"), enabled: client && !!session, staleTime: 30_000 });
  // what the server keeps (B35) and the devices change with each sync: read again after one
  const synced = useSyncStatus((s) => s.last);
  const { refetch } = me;
  useEffect(() => {
    if (synced) void refetch();
  }, [synced, refetch]);
  const strip = useRef<HTMLDivElement>(null);
  // on a phone the strip scrolls sideways: the open tab is brought into view, as the shared nav does
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);

  function go(next: Tab) {
    setTab(next);
    // the tab is in the address (PRF-02), without asking the server
    window.history.replaceState(null, "", `${window.location.pathname}${next === "contributions" ? "" : `?tab=${next}`}`);
  }

  const signedIn = client && !!user;
  return (
    <div className="profile-screen">
      <aside className="profile-id" aria-label={t("counts")}>
        <Identity signedIn={signedIn} me={me.data} />
        <Counts />
        {/* on a phone the data controls come after the open tab's list: one tap away from the top (PRF-35, F27) */}
        <a href="#your-data" className="btn self-start min-[900px]:hidden">
          {t("toData")}
        </a>
      </aside>
      <div className="profile-main">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-semibold">{t("tab." + tab)}</h1>
          <span className="flex-1" />
          <SyncLine signedIn={signedIn} devices={me.data?.devices.length ?? null} />
        </div>
        <div ref={strip} className="profile-tabs" role="group" aria-label={t("tabs")}>
          {TABS.map((x) => (
            <button key={x} type="button" className="seg" aria-pressed={tab === x} onClick={() => go(x)}>
              {t("tab." + x)}
            </button>
          ))}
        </div>
        {client && (tab === "account" ? <AccountPanel me={me.data ?? null} onChanged={() => void me.refetch()} /> : <TabList tab={tab} />)}
        {tab !== "account" && <p className="profile-credit">{t("credit")}</p>}
      </div>
      <section className="profile-data" aria-labelledby="your-data">
        <h2 id="your-data" className="label-caps">{t("yourData")}</h2>
        <DataControls signedIn={signedIn} />
      </section>
    </div>
  );
}

function Identity({ signedIn, me }: { signedIn: boolean; me: Me | undefined }) {
  const t = useTranslations("me");
  const user = useAccount((s) => s.user);
  const pathname = usePathname();
  const [signIn, setSignIn] = useState<string | null>(null);
  if (!signedIn || !user)
    return (
      <div className="flex flex-col gap-3">
        <span className="profile-avatar" aria-hidden="true" />
        <div>
          <p className="text-[17px] font-semibold">{t("localName")}</p>
          <p className="text-[13px] text-t3">{t("notSignedIn")}</p>
        </div>
        <div className="profile-callout">
          <p>{t("localCallout")}</p>
          <button type="button" className="btn btn-primary min-h-[40px] self-start" onClick={() => setSignIn(pathname)}>
            {t("signIn")}
          </button>
        </div>
        <SignInSheet returnTo={signIn} onClose={() => setSignIn(null)} />
      </div>
    );
  const name = user.display_name || user.email;
  return (
    <div className="flex flex-col gap-3">
      <span className="profile-avatar is-account" aria-hidden="true">
        {initial(user.display_name, user.email)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[17px] font-semibold" dir="auto">{name}</p>
        <p className="truncate text-[13px] text-t3" dir="auto">{user.affiliation || user.email}</p>
        {user.orcid && (
          <p className="mono text-[11px] text-t3" dir="ltr">
            ORCID {user.orcid}
          </p>
        )}
        <p className="mt-1 text-[11.5px] text-t3">{t("role." + ((me?.role ?? user.role) as "member"))}</p>
      </div>
    </div>
  );
}

function Counts() {
  const t = useTranslations("me");
  const locale = useLocale();
  const client = useIsClient();
  const ready = useNotebookReady();
  const proposals = usePersonal((s) => s.proposals.length);
  const stars = useSaved((s) => s.bookmarks.length);
  const verseNotes = useSaved((s) => Object.keys(s.notes).length);
  const notes = useNotebook((s) => s.notes.length);
  const cards = useReview((s) => Object.keys(s.cards).length);
  const session = useAccount((s) => s.session);
  const server = useQuery({ queryKey: ["my-proposals", session], queryFn: myProposals, enabled: client && !!session, staleTime: 30_000 });
  const merged = server.data?.data.filter((p) => p.status === "merged").length ?? 0;
  const inQueue = server.data?.data.filter((p) => p.status === "open" || p.status === "approved" || p.status === "changes").length ?? 0;
  const graphs = useMyGraphs(client);
  const texts = useQuery({ queryKey: ["user-texts"], queryFn: listTexts, enabled: client });
  const n = (x: number | undefined) => (client && x !== undefined ? formatNumber(x, locale) : "–");
  const rows: [string, string][] = [
    // merged and pending: the account's proposals in the queue, and the drafts kept here (PRF-08, P7)
    [t("merged"), n(merged)],
    [t("pending"), n(proposals + inQueue)],
    [t("graphs"), n(graphs.data?.length)],
    [t("texts"), n(texts.data?.length)],
    [t("notes"), ready ? n(notes + verseNotes) : "–"],
    [t("stars"), n(stars)],
    [t("cards"), n(cards)],
  ];
  return (
    <dl className="profile-counts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd className="mono">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * PRF-04: green when synced (with the true number of devices, PRF-05), amber when only on this device. Nothing here is
 * re-announced on each run (F24): a screen reader hears when sync stops working, and the result of a sync the
 * reader asked for — not the five-minute rhythm.
 */
function SyncLine({ signedIn, devices }: { signedIn: boolean; devices: number | null }) {
  const t = useTranslations("me");
  const ta = useTranslations("account");
  const locale = useLocale();
  const s = useSyncStatus();
  const [said, setSaid] = useState("");
  const when = (ms: number) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { hour: "numeric", minute: "2-digit" }).format(new Date(ms));
  if (!signedIn)
    return (
      <span className="profile-status">
        <span className="dot" style={{ background: "var(--amber)" }} aria-hidden="true" />
        {t("statusLocal")}
      </span>
    );
  // the line says only what it knows: synced, and on how many devices once the account has said (F23)
  const text = s.state === "syncing" ? t("statusSyncing") : s.state === "offline" ? t("statusOffline") : s.state === "error" ? t("statusError") : devices !== null ? t("statusSynced", cnt(devices, locale)) : t("statusSyncedPlain");
  async function now() {
    setSaid("");
    await runSync();
    const after = useSyncStatus.getState();
    setSaid(after.state === "idle" ? t("syncDone", { when: when(after.last ?? Date.now()) }) : after.state === "offline" ? t("statusOffline") : t("statusError"));
  }
  return (
    <span className="profile-status">
      <span className="dot" style={{ background: s.state === "idle" ? "var(--good)" : s.state === "syncing" ? "var(--c-word)" : "var(--amber)" }} aria-hidden="true" />
      <span>{text}</span>
      {s.last && s.state === "idle" && <span className="text-t3">{t("lastSync", { when: when(s.last) })}</span>}
      {s.tooLarge.length > 0 && <span className="text-amber">{t("tooLarge", cnt(s.tooLarge.length, locale))}</span>}
      {s.full > 0 && <span className="text-amber">{t("full", cnt(s.full, locale))}</span>}
      {s.unreadable.length > 0 && <span className="text-amber">{t("unreadable", { stores: s.unreadable.map((x) => ta(`store.${x}`)).join(locale === "ar" ? "، " : ", ") })}</span>}
      <button type="button" className="btn" onClick={() => void now()} disabled={s.state === "syncing"}>
        {t("syncNow")}
      </button>
      <span className="sr-only" role="status">
        {s.state === "offline" || s.state === "error" ? text : said}
      </span>
    </span>
  );
}

/** PRF-09…14, Q03: everything this site keeps, exported or deleted, and the account's copy too. */
function DataControls({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("me");
  const [said, setSaid] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!confirm) return;
    const id = setTimeout(() => setConfirm(false), 3000); // PRF-12: the second click within three seconds
    return () => clearTimeout(id);
  }, [confirm]);
  const done = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("deleted");

  async function exportTexts() {
    const metas = await listTexts();
    const texts = (await Promise.all(metas.map((m) => loadText(m.id)))).filter(Boolean);
    download(`jadhr-texts-${new Date().toISOString().slice(0, 10)}.json`, { format: "jadhr-texts-1", texts });
    setSaid(t("exported"));
  }
  async function exportAccount() {
    try {
      download(`jadhr-account-${new Date().toISOString().slice(0, 10)}.json`, await authFetch("/me/export"));
      setSaid(t("exported"));
    } catch {
      setSaid(t("exportFailed"));
    }
  }
  async function deleteAll() {
    if (!confirm) return setConfirm(true);
    await deleteLocalData(); // signed in, this device leaves the account first
    window.location.replace(`${window.location.pathname}?deleted=1`);
  }
  return (
    <div className="flex flex-col gap-2">
      <button type="button" className="btn min-h-[40px] justify-start" onClick={() => void exportLocalData().then(() => setSaid(t("exported")))}>
        {t("exportAll")}
      </button>
      {signedIn && (
        <button type="button" className="btn min-h-[40px] justify-start" onClick={() => void exportAccount()}>
          {t("exportAccount")}
        </button>
      )}
      <button type="button" className="btn min-h-[40px] justify-start" onClick={() => void exportTexts()}>
        {t("exportTexts")}
      </button>
      <ImportControl
        onDone={(text, ok) => {
          setSaid(ok ? text : null);
          setFailed(ok ? null : text);
        }}
      />
      <button type="button" className={"btn min-h-[40px] justify-start " + (confirm ? "border-bad text-bad" : "text-bad")} onClick={() => void deleteAll()}>
        {confirm ? t("deleteLocalConfirm") : t("deleteLocal")}
      </button>
      {signedIn && <p className="text-[11.5px] text-t3">{t("deleteLocalSigned")}</p>}
      {(said || done) && (
        <p className="text-[12.5px] text-good" role="status">
          {said ?? t("deletedLocal")}
        </p>
      )}
      {failed && (
        <p className="text-[12.5px] text-bad" role="alert">
          {failed}
        </p>
      )}
    </div>
  );
}

/**
 * Plan B32: a file this site exported, brought back into this browser — another device's, or this one's before it
 * was cleared. What is new is added; what differs from what is here is replaced only if the reader chooses the
 * file's; nothing is deleted. The file is read here and never sent.
 */
function ImportControl({ onDone }: { onDone: (text: string, ok: boolean) => void }) {
  const t = useTranslations("me");
  const ta = useTranslations("account");
  const locale = useLocale();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState(false);
  async function read(file: File) {
    if (file.size > MAX_IMPORT_BYTES) return onDone(t("importTooLarge"), false);
    const p = await planImport(await file.text());
    if (!p) return onDone(t("importBad"), false);
    setPlan(p);
  }
  async function go(takeTheirs: boolean) {
    if (!plan) return;
    setBusy(true);
    const r = await applyImport(plan, takeTheirs);
    setBusy(false);
    setPlan(null);
    void qc.invalidateQueries();
    onDone(t("imported", { added: formatNumber(r.added, locale), replaced: formatNumber(r.replaced, locale) }), true);
  }
  const c = plan ? planCounts(plan) : null;
  return (
    <>
      <button type="button" className="btn min-h-[40px] justify-start" onClick={() => input.current?.click()}>
        {t("importAll")}
      </button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void read(f);
        }}
      />
      <Dialog open={!!plan} onClose={() => setPlan(null)} label={t("importTitle")} width={480}>
        {plan && c && (
          <div className="flex flex-col gap-3 p-5 text-[13.5px] leading-relaxed">
            <h2 className="text-[17px] font-semibold">{t("importTitle")}</h2>
            {c.add + c.differ === 0 ? (
              <p>{t("importNothing")}</p>
            ) : (
              <>
                {c.add > 0 && <p>{t("importNew", cnt(c.add, locale))}</p>}
                {c.differ > 0 && <p>{t("importDiffer", cnt(c.differ, locale))}</p>}
                {c.same > 0 && <p className="text-t3">{t("importSame", cnt(c.same, locale))}</p>}
              </>
            )}
            {plan.refused.length > 0 && <p className="text-t3">{t("importRefused", { stores: plan.refused.map((x) => ta(`store.${x}`)).join(locale === "ar" ? "، " : ", ") })}</p>}
            <div className="flex flex-col gap-2">
              {c.add + c.differ > 0 && (
                <button type="button" className="btn btn-primary min-h-[40px] justify-center" disabled={busy} onClick={() => void go(false)}>
                  {c.differ > 0 ? t("importKeep") : t("importAdd")}
                </button>
              )}
              {c.differ > 0 && (
                <button type="button" className="btn min-h-[40px] justify-center" disabled={busy} onClick={() => void go(true)}>
                  {t("importTake")}
                </button>
              )}
              <button type="button" className="btn min-h-[40px] justify-center" disabled={busy} onClick={() => setPlan(null)}>
                {t("importCancel")}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

type Row = { id: string; dot: string; ar: string | null; text: string; when: string; href: string };

/** PRF-15…28: the reader's own records, each linking back to where it was made, with copy naming what fills an empty tab. */
function TabList({ tab }: { tab: Exclude<Tab, "account"> }) {
  const t = useTranslations("me");
  const tc = useTranslations("contrib");
  const tw = useTranslations("wordContrib");
  const locale = useLocale();
  const statusText = (p: ProposalOut) =>
    p.status === "merged" ? tc("filter.merged") : p.status === "withdrawn" ? tc("withdrawn") : tw(`status.${p.status}`, { n: formatNumber(p.approvals, locale) });
  const ready = useNotebookReady();
  const proposals = usePersonal((s) => s.proposals);
  const sessions = usePersonal((s) => s.sessions);
  const session = useAccount((s) => s.session);
  const server = useQuery({ queryKey: ["my-proposals", session], queryFn: myProposals, enabled: tab === "contributions" && !!session, staleTime: 30_000 });
  const bookmarks = useSaved((s) => s.bookmarks);
  const verseNotes = useSaved((s) => s.notes);
  const notes = useNotebook((s) => s.notes);
  const graphs = useMyGraphs(tab === "graphs");
  const texts = useQuery({ queryKey: ["user-texts"], queryFn: listTexts, enabled: tab === "library" });
  const date = (ms: number) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ms));
  const day = (d: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${d}T12:00:00`));

  const rows: Row[] | null = useMemo(() => {
    if (tab === "contributions") {
      // PRF-17…19: the account's proposals with their status (merged green, waiting amber, settled grey), the
      // drafts kept here; each links to where it is decided, and every label is a word, never a raw id
      const sent = (server.data?.data ?? []).map((p) => ({
        id: p.id,
        dot: p.status === "merged" ? "var(--good)" : p.status === "declined" || p.status === "withdrawn" ? "var(--line-2)" : "var(--amber)",
        ar: p.lemma_ar,
        text: `${tc("kind." + p.kind)} • ${p.text.slice(0, 90)}`,
        when: `${statusText(p)} • ${date(Date.parse(p.created_at))}`,
        href: `/review?filter=mine&id=${p.id}`,
        at: Date.parse(p.created_at),
      }));
      const drafts = proposals.map((p) => ({ id: p.id, dot: "var(--amber)", ar: p.label, text: `${tc("kind." + p.kind)} • ${p.text.slice(0, 90)}`, when: t("draft", { date: date(p.ts) }), href: `/read?w=${encodeURIComponent(p.slug)}`, at: p.ts }));
      return [...drafts, ...sent].sort((a, b) => b.at - a.at).map((r) => ({ id: r.id, dot: r.dot, ar: r.ar, text: r.text, when: r.when, href: r.href }));
    }
    if (tab === "bookmarks")
      return [...bookmarks]
        .sort((a, b) => b.at - a.at)
        .map((b) => ({
          id: `${b.kind}:${b.key}`,
          dot: b.kind === "root" ? "var(--c-root)" : b.kind === "verse" ? "var(--c-sentence)" : "var(--c-word)",
          ar: b.label,
          text: t("bookmarkKind." + b.kind) + (b.kind === "verse" || b.kind === "word" ? ` • ${verseRef(b.key.split(":").slice(0, 2).join(":"), locale)}` : ""),
          when: date(b.at),
          href: b.kind === "root" ? `/roots/${encodeURIComponent(b.key)}` : b.kind === "verse" ? `/quran/${b.key.replace(":", "/")}` : b.kind === "word" ? `/word/${b.key}` : `/read?w=${encodeURIComponent(b.key)}`,
        }));
    if (tab === "notes") {
      if (!ready) return null;
      return [
        ...notes.map((n) => ({ id: n.id, dot: "var(--c-desc)", ar: null, text: n.title || n.body.split("\n")[0].slice(0, 90) || t("untitled"), when: date(n.updated), href: `/notebook#note=${n.id}`, at: n.updated })),
        ...Object.values(verseNotes).map((n) => ({ id: `v:${n.verse}`, dot: "var(--c-sentence)", ar: null, text: `${t("verseNote", { ref: verseRef(n.verse, locale) })} • ${n.text.slice(0, 80)}`, when: date(n.at), href: `/notebook#note=v:${n.verse}`, at: n.at })),
      ]
        .sort((a, b) => b.at - a.at)
        .map((r) => ({ id: r.id, dot: r.dot, ar: r.ar, text: r.text, when: r.when, href: r.href }));
    }
    if (tab === "graphs")
      return graphs.data
        ? graphs.data.map((g) => ({ id: g.id, dot: "var(--c-form)", ar: null, text: `${g.title} • ${t("cardsCount", cnt(g.nodeCount, locale))}`, when: date(g.updatedAt), href: `/graph/edit/${g.id}` }))
        : null;
    if (tab === "library")
      return texts.data
        ? texts.data.map((x) => ({ id: x.id, dot: "var(--c-sentence)", ar: x.title, text: `${t("wordsCount", cnt(x.words, locale))} • ${t("entriesCount", cnt2(x.lemmas.length, locale))}`, when: date(x.updatedAt), href: `/library/text/${x.id}` }))
        : null;
    // journal: a day read on several devices is one day (P6)
    return mergeSessions(sessions)
      .sort((a, b) => b.day.localeCompare(a.day))
      .map((s) => ({ id: `${s.day}:${s.text}`, dot: "var(--c-root)", ar: s.roots.slice(0, 3).join(" • ") || null, text: `${s.text === "quran" ? t("quran") : s.text} • ${t("lookupsCount", cnt(s.lookups, locale))}`, when: day(s.day), href: "/notebook?tab=journal" }));
  }, [tab, proposals, server.data, bookmarks, notes, verseNotes, graphs.data, texts.data, sessions, ready, t, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows) return <div className="h-24 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  if (!rows.length) return <p className="profile-empty">{t("empty." + tab)}</p>;
  return (
    <ul className="profile-rows">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={r.href} prefetch={false} className="profile-row">
            <span className="dot" style={{ background: r.dot }} aria-hidden="true" />
            {r.ar && (
              <span className="ar-classical min-w-[70px] text-[20px] leading-tight" lang="ar" dir="rtl">
                {r.ar}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-[13px]" dir="auto">
              {r.text}
            </span>
            <span className="shrink-0 text-[11.5px] text-t3">{r.when}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
