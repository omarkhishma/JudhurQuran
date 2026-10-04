"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { SignInPanel } from "@/components/account/SignInPanel";
import { Link, usePathname } from "@/i18n/navigation";
import { signOutHere } from "@/lib/account/actions";
import { errorKind } from "@/lib/account/errors";
import { type Account, authFetch, useAccount } from "@/lib/account/store";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import type { ReadingContext, Session } from "@/lib/reader/store";
import { runSync } from "@/lib/sync/run";

type Kept = { count: number; first_goes: string | null };
/** What the server keeps for the account (plan B35): counts, the cap, and when the oldest of each kind goes. */
export type Held = { stores: Partial<Record<string, number>>; used: number; limit: number; deletions: Kept; history: Kept; lookups: Kept };
export type Me = Account & { created_at: string; devices: { id: string; device: string | null; created_at: string; last_seen_at: string; current: boolean }[]; records: number; held?: Held };
type Version = { id: number; store: string; key: string; value: unknown; deleted: boolean; updated_at: number; replaced_at: number };

/** An error as the reader is told it, in their language (F21). */
function useErrorText() {
  const t = useTranslations("account");
  return (e: unknown, sent?: { orcid?: string }) => t(`err.${errorKind(e, sent)}`);
}

/**
 * The account (PRF-14, Q02, Q04; NTB-Q02; P6.1): the name contributions are credited to, with affiliation and ORCID
 * for scholars and nothing public by default; the two choices that send more than sync needs, each off until
 * turned on and saying what it keeps and for how long; the devices signed in; the versions sync replaced, kept 30
 * days and restorable; signing out, with or without this device's data; deleting the account in two steps.
 * Signed out, the sign-in panel.
 */
export function AccountPanel({ me, onChanged }: { me: Me | null; onChanged: () => void }) {
  const user = useAccount((s) => s.user);
  const pathname = usePathname();
  const t = useTranslations("me");
  if (!user)
    return (
      <div className="flex flex-col gap-3">
        {/* the account just deleted says so here, where the reader is left */}
        {new URLSearchParams(window.location.search).has("account-deleted") && (
          <p className="text-[13px] text-good" role="status">
            {t("deleted")}
          </p>
        )}
        <SignInPanel returnTo={`${pathname}?tab=account`} />
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <ProfileForm />
      <Choices onChanged={onChanged} />
      <Devices me={me} onChanged={onChanged} />
      <OnTheServer me={me} />
      <ApiKeys />
      <History />
      <SignOut />
      <DeleteAccount />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="account-card" aria-label={title}>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ProfileForm() {
  const t = useTranslations("me");
  const user = useAccount((s) => s.user)!;
  const setUser = useAccount((s) => s.setUser);
  const [f, setF] = useState({ display_name: user.display_name ?? "", affiliation: user.affiliation ?? "", orcid: user.orcid ?? "" });
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const errorText = useErrorText();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const out = await authFetch<Me>("/me", { method: "PATCH", body: JSON.stringify(f) });
      setUser({ id: out.id, email: out.email, display_name: out.display_name, affiliation: out.affiliation, orcid: out.orcid, role: out.role, settings: out.settings });
      setSaid({ ok: true, text: t("saved") });
    } catch (err) {
      setSaid({ ok: false, text: t("saveFailed", { error: errorText(err, f) }) });
    }
  }
  const field = (k: keyof typeof f, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="flex flex-col gap-1 text-[13px]">
      <span className="font-medium">{label}</span>
      <input className="field min-h-[44px]" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} dir="auto" {...extra} />
    </label>
  );
  return (
    <Card title={t("accountTitle")}>
      <form className="flex flex-col gap-3" onSubmit={save}>
        <p className="text-[12.5px] text-t3" dir="ltr">
          {user.email}
        </p>
        {field("display_name", t("displayName"), { maxLength: 120, autoComplete: "name" })}
        {field("affiliation", t("affiliation"), { maxLength: 120, autoComplete: "organization" })}
        {field("orcid", t("orcid"), { maxLength: 19, placeholder: "0000-0000-0000-0000", inputMode: "numeric" })}
        <p className="text-[12px] text-t3">{t("noPublic")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn btn-primary min-h-[40px]">
            {t("save")}
          </button>
          {said && (
            <span className={"text-[12.5px] " + (said.ok ? "text-good" : "text-bad")} role={said.ok ? "status" : "alert"}>
              {said.text}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

/** NTB-Q02 and P6.1: each choice off until the reader turns it on, saying what it keeps and for how long. */
function Choices({ onChanged }: { onChanged: () => void }) {
  const t = useTranslations("me");
  const user = useAccount((s) => s.user)!;
  const setUser = useAccount((s) => s.setUser);
  // the choice shows at once, and goes back if the server does not take it
  const [pending, setPending] = useState<Partial<Record<"sync_journal" | "share_lookups", boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const errorText = useErrorText();
  async function set(k: "sync_journal" | "share_lookups", v: boolean) {
    setPending((p) => ({ ...p, [k]: v }));
    setError(null);
    try {
      const out = await authFetch<Me>("/me", { method: "PATCH", body: JSON.stringify({ settings: { [k]: v } }) });
      setUser({ ...user, settings: out.settings });
      onChanged();
      void runSync(); // the journal goes up (or stops) at once
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[k];
        return next;
      });
    }
  }
  const toggle = (k: "sync_journal" | "share_lookups", label: string, help: string) => (
    <label className="account-choice">
      <input type="checkbox" checked={pending[k] ?? !!user.settings?.[k]} disabled={k in pending} onChange={(e) => void set(k, e.target.checked)} />
      <span className="flex flex-col gap-1">
        <span className="text-[13.5px] font-medium">{label}</span>
        <span className="text-[12.5px] leading-relaxed text-t2">{help}</span>
      </span>
    </label>
  );
  return (
    <Card title={t("syncTitle")}>
      {toggle("sync_journal", t("syncJournal"), t("syncJournalHelp"))}
      {toggle("share_lookups", t("shareLookups"), t("shareLookupsHelp"))}
      {error && (
        <p className="text-[12.5px] text-bad" role="alert">
          {t("saveFailed", { error })}
        </p>
      )}
    </Card>
  );
}

function Devices({ me, onChanged }: { me: Me | null; onChanged: () => void }) {
  const t = useTranslations("me");
  const locale = useLocale();
  const when = (s: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(new Date(s));
  if (!me) return null;
  return (
    <Card title={t("devices")}>
      <ul className="flex flex-col gap-1.5">
        {me.devices.map((d) => (
          <li key={d.id} className="account-row">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13.5px]" dir="ltr">
                {d.device || t("unknownDevice")}
              </span>
              <span className="text-[11.5px] text-t3">{d.current ? t("thisDevice") : t("lastSeen", { when: when(d.last_seen_at) })}</span>
            </span>
            {!d.current && (
              <button
                type="button"
                className="btn min-h-[40px]"
                aria-label={t("signOutDeviceNamed", { device: d.device || t("unknownDevice"), when: when(d.last_seen_at) })}
                onClick={() => void authFetch(`/me/sessions/${d.id}`, { method: "DELETE" }).then(onChanged)}
              >
                {t("signOutDevice")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

type ApiKey = { id: string; name: string; prefix: string; created_at: string; last_used_on: string | null; revoked_at: string | null };
type Limits = { per_minute_without_key: number; per_minute_with_key: number };

/**
 * Keys for the public API (P10.2b): made here, each shown once and never again — the server keeps its hash, its
 * first characters and the last day it was used, never the requests; revoked here. Reading without a key is open at
 * a lower limit per address.
 */
function ApiKeys() {
  const t = useTranslations("me");
  const err = useErrorText();
  const locale = useLocale();
  const fmt = (n: number) => formatNumber(n, locale);
  const day = (s: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(s));
  const list = useQuery({ queryKey: ["api-keys"], queryFn: () => authFetch<{ data: ApiKey[]; most: number }>("/me/keys") });
  const limits = useQuery({ queryKey: ["public-limits"], queryFn: () => fetch("/api/v1/public").then((r) => r.json() as Promise<{ data: { limits: Limits } }>), staleTime: 3_600_000 });
  const [name, setName] = useState("");
  const [made, setMade] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const l = limits.data?.data.limits;
  return (
    <Card title={t("keysTitle")}>
      <p className="text-[12.5px] leading-relaxed text-t2">{l ? t("keysLead", { without: fmt(l.per_minute_without_key), with: fmt(l.per_minute_with_key) }) : t("keysLeadPlain")}</p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaid("");
          try {
            const k = await authFetch<ApiKey & { key: string }>("/me/keys", { method: "POST", body: JSON.stringify({ name }) });
            setMade(k.key);
            setName("");
            await list.refetch();
          } catch (x) {
            setSaid(err(x));
          }
        }}
      >
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[12.5px] text-t2">
          {t("keyName")}
          <input className="field-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} dir="auto" />
        </label>
        <button type="submit" className="btn" disabled={!name.trim()}>{t("keyMake")}</button>
      </form>
      {made && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-card-2 p-3" role="status">
          <p className="text-[12.5px] text-t1">{t("keyMade")}</p>
          <div className="flex flex-wrap gap-2">
            <input className="field-input mono min-w-0 flex-1 text-[12.5px]" readOnly value={made} dir="ltr" aria-label={t("keyValue")} onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(made);
                  setSaid(t("keyCopied"));
                } catch {
                  setSaid(t("keyCopyFailed"));
                }
              }}
            >
              {t("keyCopy")}
            </button>
          </div>
        </div>
      )}
      {said && <p className="text-[12.5px] text-t2" role="status">{said}</p>}
      {list.data && (
        <ul className="flex flex-col gap-1.5">
          {list.data.data.length === 0 && <li className="text-[12.5px] text-t3">{t("keysNone")}</li>}
          {list.data.data.map((k) => (
            <li key={k.id} className="account-row">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13.5px]" dir="auto">{k.name}</span>
                <span className="text-[11.5px] text-t3">
                  <span className="mono" dir="ltr">{k.prefix}…</span> · {t("keyCreated", { day: day(k.created_at) })} · {k.last_used_on ? t("keyLastUsed", { day: day(k.last_used_on) }) : t("keyNeverUsed")}
                  {k.revoked_at && ` · ${t("keyRevoked")}`}
                </span>
              </span>
              {!k.revoked_at &&
                (asking === k.id ? (
                  <button
                    type="button"
                    className="btn min-h-[40px] text-bad"
                    onClick={async () => {
                      await authFetch(`/me/keys/${k.id}`, { method: "DELETE" });
                      setAsking(null);
                      await list.refetch();
                    }}
                  >
                    {t("keyRevokeConfirm")}
                  </button>
                ) : (
                  <button type="button" className="btn min-h-[40px]" aria-label={t("keyRevokeNamed", { name: k.name })} onClick={() => setAsking(k.id)}>
                    {t("keyRevoke")}
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
      <Link href="/developers" className="self-start text-[12.5px] underline underline-offset-2">{t("keysDocs")}</Link>
    </Card>
  );
}

/**
 * Plan B35: what the server keeps for this account — how many of each kind, against the account's cap, and the day
 * the oldest deletion marker, replaced version and shared lookup goes. The privacy page's periods, for this account.
 */
function OnTheServer({ me }: { me: Me | null }) {
  const t = useTranslations("me");
  const ta = useTranslations("account");
  const locale = useLocale();
  const held = me?.held;
  if (!held) return null;
  const day = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  const kept = (key: "heldDeletions" | "heldHistory" | "heldLookups", k: Kept) => (
    <li className="flex flex-wrap justify-between gap-x-3">
      <span>{t(key, cnt(k.count, locale))}</span>
      {k.first_goes && <span className="text-t3">{t("heldFirstGoes", { date: day(k.first_goes) })}</span>}
    </li>
  );
  const stores = Object.entries(held.stores).filter(([, n]) => (n ?? 0) > 0) as [string, number][];
  return (
    <Card title={t("heldTitle")}>
      {stores.length ? (
        <dl className="account-held">
          {stores.map(([store, n]) => (
            <div key={store}>
              <dt>{ta(`store.${store}`)}</dt>
              <dd>{formatNumber(n, locale)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-[12.5px] text-t3">{t("heldNone")}</p>
      )}
      <p className="text-[12.5px] text-t2">{t("heldUsed", { used: formatNumber(held.used, locale), limit: formatNumber(held.limit, locale) })}</p>
      <ul className="flex flex-col gap-1 text-[12.5px] text-t2">
        {kept("heldDeletions", held.deletions)}
        {kept("heldHistory", held.history)}
        {kept("heldLookups", held.lookups)}
      </ul>
      <Link href="/privacy" className="self-start text-[12.5px] underline-offset-2 hover:underline">
        {t("heldHow")}
      </Link>
    </Card>
  );
}

/** PRF-33: what sync replaced, kept thirty days, each restorable — a merge never destroys anything. */
function History() {
  const t = useTranslations("me");
  const ta = useTranslations("account");
  const locale = useLocale();
  const session = useAccount((s) => s.session);
  const q = useQuery({ queryKey: ["me-history", session], queryFn: () => authFetch<{ data: Version[] }>("/me/history"), staleTime: 10_000 });
  const [restored, setRestored] = useState<number | null>(null);
  const describe = useDescribe(q.data?.data ?? []);
  const when = (ms: number) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(new Date(ms));
  async function restore(id: number) {
    await authFetch(`/me/history/${id}/restore`, { method: "POST" });
    setRestored(id);
    await runSync();
    void q.refetch();
  }
  const list = q.data?.data ?? [];
  return (
    <Card title={t("history")}>
      {restored !== null && (
        <p className="text-[12.5px] text-good" role="status">
          {t("restored")}
        </p>
      )}
      {q.isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-card-2" aria-hidden="true" />
      ) : list.length === 0 ? (
        <p className="text-[12.5px] text-t3">{t("historyEmpty")}</p>
      ) : (
        <ul className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto">
          {list.slice(0, 100).map((v) => {
            const what = v.deleted ? `${describe(v)} (${t("aDeletion")})` : describe(v);
            return (
              <li key={v.id} className="account-row">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px]" dir="auto">
                    {ta(`store.${v.store}`)} • {what}
                  </span>
                  <span className="text-[11.5px] text-t3">{t("replacedAt", { when: when(v.replaced_at) })}</span>
                </span>
                <button type="button" className="btn min-h-[40px]" aria-label={t("restoreNamed", { what, when: when(v.replaced_at) })} onClick={() => void restore(v.id)}>
                  {t("restore")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/**
 * A replaced version named by what the reader would recognise in it, in their language — never a record's key or a
 * raw value (F20): a note by its title, a word by its Arabic, a day by its date, a setting as a setting.
 */
function useDescribe(list: Version[]): (v: Version) => string {
  const t = useTranslations("me");
  const locale = useLocale();
  // word states are keyed by the word's slug: its Arabic is asked for in a body, kept nowhere (as the review deck does)
  const slugs = [...new Set(list.filter((v) => v.store === "personal" && v.key.startsWith("w:")).map((v) => v.key.slice(2)))].sort();
  const words = useQuery({
    queryKey: ["history-words", slugs],
    enabled: slugs.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const r = await fetch("/api/v1/lemmas/roots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs }) });
      if (!r.ok) return {};
      return Object.fromEntries(((await r.json()) as { data: { slug: string; ar: string }[] }).data.map((x) => [x.slug, x.ar]));
    },
  });
  const day = (d: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${d}T12:00:00`));
  const text = (id: string) => (id === "quran" ? t("quran") : t("pv.yourText"));
  const verse = (ref: string) => verseRef(ref.replace(/^quran:/, ""), locale);
  return (v) => {
    const x = v.value as Record<string, unknown> | string | number | boolean | null;
    const [kind, rest] = v.key.includes(":") ? [v.key.slice(0, v.key.indexOf(":")), v.key.slice(v.key.indexOf(":") + 1)] : [v.key, ""];
    switch (v.store) {
      case "personal":
        if (kind === "w") return t("pv.word", { word: words.data?.[rest] ?? t("pv.aWord"), state: t(`pv.state.${typeof x === "string" ? x : "new"}`) });
        if (kind === "p") return t("pv.position", { text: text(rest) });
        if (kind === "r") return t("pv.furthest", { surah: formatNumber(Number(rest.split(":").pop()), locale) });
        if (kind === "l") return t("pv.links", { verse: verse(rest) });
        if (kind === "vt") return t("pv.verseTopics", { verse: verse(rest) });
        if (kind === "t") return t("pv.trail");
        if (kind === "f") return t("pv.flag");
        break;
      case "journal":
        if (kind === "s") return t("pv.day", { day: day((x as Session | null)?.day ?? rest.split(":")[0]) });
        if (kind === "rm") return t("pv.root", { root: rest });
        if (kind === "ctx") return (x as ReadingContext | null)?.wordAr ? t("pv.placeAt", { word: (x as ReadingContext).wordAr ?? "" }) : t("pv.place");
        if (kind === "cc") return t("pv.cleared");
        break;
      case "review":
        if (kind === "c") return t("pv.card", { root: rest });
        break;
      case "analyse":
        return t("pv.analyse", { form: v.key.split("|")[0] });
    }
    // a note, a star, a proposal, a map or a text: by its own words
    if (x && typeof x === "object") for (const k of ["label", "title", "text", "body"]) if (typeof x[k] === "string" && (x[k] as string).trim()) return (x[k] as string).slice(0, 80);
    return t(`pv.of.${v.store as "saved"}`);
  };
}

function SignOut() {
  const t = useTranslations("me");
  return (
    <Card title={t("signOutTitle")}>
      <p className="text-[12.5px] text-t2">{t("signOutHelp")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn min-h-[40px]" onClick={() => void signOutHere(false)}>
          {t("signOut")}
        </button>
        <button type="button" className="btn min-h-[40px] text-bad" onClick={() => void signOutHere(true)}>
          {t("signOutRemove")}
        </button>
      </div>
    </Card>
  );
}

/** PRF-14: two steps — a confirmation token valid ten minutes, then the deletion of everything the account holds. The
 * focus moves with the step (F25): to the confirmation when it appears, back to the first button when it goes. */
function DeleteAccount() {
  const t = useTranslations("me");
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const errorText = useErrorText();
  const askRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!token) return;
    const id = setTimeout(() => setToken(null), 10 * 60_000);
    return () => clearTimeout(id);
  }, [token]);
  useEffect(() => {
    if (!moved.current) return;
    (token ? confirmRef : askRef).current?.focus();
  }, [token]);
  async function ask() {
    moved.current = true;
    try {
      setToken((await authFetch<{ confirm: string }>("/me/delete", { method: "POST" })).confirm);
    } catch (err) {
      setState({ ok: false, text: t("deleteFailed", { error: errorText(err) }) });
    }
  }
  async function confirm() {
    try {
      await authFetch("/me/delete/confirm", { method: "POST", body: JSON.stringify({ confirm: token }) });
      window.history.replaceState(null, "", `${window.location.pathname}?tab=account&account-deleted=1`);
      useAccount.getState().signOut();
    } catch (err) {
      setToken(null);
      setState({ ok: false, text: t("deleteFailed", { error: errorText(err) }) });
    }
  }
  return (
    <Card title={t("deleteTitle")}>
      <p className="text-[12.5px] leading-relaxed text-t2">{t("deleteHelp")}</p>
      <div className="flex flex-wrap gap-2">
        {token ? (
          <>
            <button ref={confirmRef} type="button" className="btn btn-danger min-h-[40px]" onClick={() => void confirm()}>
              {t("deleteConfirm")}
            </button>
            <button type="button" className="btn min-h-[40px]" onClick={() => setToken(null)}>
              {t("deleteCancel")}
            </button>
          </>
        ) : (
          <button ref={askRef} type="button" className="btn min-h-[40px] text-bad" onClick={() => void ask()}>
            {t("deleteAsk")}
          </button>
        )}
      </div>
      {state && (
        <p className={"text-[12.5px] " + (state.ok ? "text-good" : "text-bad")} role={state.ok ? "status" : "alert"}>
          {state.text}
        </p>
      )}
    </Card>
  );
}
