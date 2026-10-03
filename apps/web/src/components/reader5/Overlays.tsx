"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Segmented } from "@/components/ui/Segmented";
import { Link, useRouter } from "@/i18n/navigation";
import { hasArabic } from "@/lib/arabic/normalize";
import { cnt, cnt2, formatNumber } from "@/lib/format";
import { getJSON, useWord } from "@/lib/reader/api";
import { tokenText } from "@/lib/reader/verseText";
import { useIsClient } from "@/lib/client";
import { type CiteTarget, type MorphKey, usePersonal, usePrefs, useReader, type SuggestTarget } from "@/lib/reader/store";
import { ReviewDeck } from "./ReviewDeck";
import { SITE } from "@/lib/site";
import { useDebounced } from "@/lib/useDebounced";
import type { ChapterInfo } from "./ReaderShell";
import { GraphHandoff } from "./GraphHandoff";

/** Every reader overlay (design 03 §3.11): omnibox, cite, graph hand-off, suggest, onboarding, toast, review. */
export function Overlays({ chapter }: { chapter: ChapterInfo }) {
  const omnibox = useReader((s) => s.omnibox);
  const setOmnibox = useReader((s) => s.setOmnibox);
  const ask = useReader((s) => s.ask);

  // ⌘K / Ctrl+K anywhere opens the omnibox with an empty query (RDR-423).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOmnibox(true);
      }
      // Alt+P opens or closes the dictionary panel (RDR-428); e.code, as Alt changes the key on macOS
      if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === "KeyP") {
        e.preventDefault();
        const p = usePrefs.getState();
        p.set({ panelOpen: !p.panelOpen });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOmnibox]);

  return (
    <>
      {omnibox && <Omnibox onClose={() => setOmnibox(false)} />}
      <CiteDialog chapter={chapter} />
      <GraphHandoff />
      <SuggestDialog />
      {!ask && <Onboarding chapter={chapter} />}
      <Toast />
      <ReviewDeck chapter={chapter} />
    </>
  );
}

type OmniResults = {
  detected: { kind: string; label_ar: string; label_en: string; surah?: number; ayah?: number; number?: number };
  results: {
    verses: { key: string; surah: number; ayah: number; text_qpc: string; name_ar: string }[];
    surahs: { number: number; name_ar: string; name_translit: string; verse_count: number }[];
    roots: { key: string; spaced: string; translit: string; occurrences: number; lemma_count: number }[];
    lemmas: { slug: string; ar: string; envelope: { translit: string }; gloss_en: string | null; senses_en?: string[]; occurrences: number }[];
    patterns?: { slug: string; ar: { full: string; translit: string }; lemma_count: number }[];
  };
};

type Row = { group: string; key: string; dot: string; ar: string; sub: string; meta: string; go: () => void };

/**
 * The omnibox (design 03 §3.11, RDR-371…382, RDR-565): verses, words, roots and patterns in one list,
 * every verse-reference form understood (2:255, ٢:٢٥٥, البقرة 255), arrow keys and Enter, Esc closes.
 */
function Omnibox({ onClose }: { onClose: () => void }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const router = useRouter();
  const openShapes = useReader((s) => s.openShapes);
  const openWord = useReader((s) => s.openWord);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const dq = useDebounced(q.trim(), 150);
  const res = useQuery({ queryKey: ["omni", dq], queryFn: () => getJSON<OmniResults>(`/search?q=${encodeURIComponent(dq)}&limit=5`), enabled: dq.length > 0 });

  const rows: Row[] = useMemo(() => {
    const r = res.data?.results;
    if (!r) return [];
    const out: Row[] = [];
    const det = res.data!.detected;
    // a juzʾ, ḥizb or page opens the reader where it begins (RDR-565), not the verse panel
    const division = ["juz", "hizb", "page"].includes(det.kind) ? det : null;
    for (const v of r.verses.slice(0, 5))
      out.push({
        group: t("omniVerses"),
        key: `v${v.key}`,
        dot: "var(--c-sentence)",
        ar: v.text_qpc.length > 60 ? v.text_qpc.slice(0, 60) + "…" : v.text_qpc,
        sub: division ? t("divisionStart", { kind: locale === "ar" ? det.label_ar : det.label_en, n: formatNumber(det.number ?? 0, locale) }) : v.name_ar,
        meta: v.key,
        go: () => {
          onClose();
          router.push(division ? `/quran/${v.surah}#v${v.ayah}` : `/quran/${v.surah}/${v.ayah}`);
        },
      });
    for (const s of r.surahs.slice(0, 3))
      out.push({ group: t("omniSurahs"), key: `s${s.number}`, dot: "var(--c-sentence)", ar: s.name_ar, sub: s.name_translit, meta: String(s.number), go: () => { onClose(); router.push(`/quran/${s.number}`); } });
    for (const l of r.lemmas.slice(0, 5))
      out.push({ group: t("omniWords"), key: `w${l.slug}`, dot: "var(--c-word)", ar: l.ar, sub: `${l.envelope.translit}${l.gloss_en ?? l.senses_en?.[0] ? ` • ${l.gloss_en ?? l.senses_en?.[0]}` : ""}`, meta: t("inQuranCount", cnt(l.occurrences, locale)), go: () => { onClose(); openWord({ slug: l.slug, at: null }); } });
    for (const x of r.roots.slice(0, 3))
      out.push({ group: t("omniRoots"), key: `r${x.key}`, dot: "var(--c-root)", ar: x.spaced, sub: x.translit, meta: t("rootCounts", { ...cnt(x.occurrences, locale), ...cnt2(x.lemma_count, locale) }), go: () => { onClose(); router.push(`/roots/${encodeURIComponent(x.key)}`); } });
    for (const p of (r.patterns ?? []).slice(0, 2))
      out.push({ group: t("omniPatterns"), key: `p${p.slug}`, dot: "var(--c-form)", ar: p.ar.full, sub: p.ar.translit, meta: t("wordsN", cnt(p.lemma_count, locale)), go: () => {
          onClose();
          // Shapes on that pattern (RDR-377): over the open word, else over the pattern's most used word
          if (useReader.getState().selection?.slug) return openShapes(p.slug);
          void getJSON<{ members: { slug: string }[] }>(`/patterns/${p.slug}?limit=1`).then((d) => {
            if (!d.members[0]) return;
            openWord({ slug: d.members[0].slug, at: null });
            openShapes(p.slug);
          });
        } });
    return out;
  }, [res.data, t, locale, onClose, router, openWord, openShapes]);

  const label = res.data ? (locale === "ar" ? res.data.detected.label_ar : res.data.detected.label_en) : t("typeToSearch");
  return (
    <Dialog open onClose={onClose} label={t("searchEverything")} width={640} align="top">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <input
          data-autofocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(rows.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              rows[active]?.go();
            }
          }}
          placeholder={t("omniPlaceholder")}
          aria-label={t("searchEverything")}
          role="combobox"
          aria-expanded={rows.length > 0}
          aria-controls="omni-list"
          aria-activedescendant={rows[active] ? `omni-${rows[active].key}` : undefined}
          dir="auto"
          className={"min-w-0 flex-1 bg-transparent text-[20px] outline-none " + (hasArabic(q) ? "ar-classical" : "")}
        />
        <span className="chip text-[11px] text-t3">{label}</span>
      </div>
      <ul id="omni-list" role="listbox" aria-label={t("searchEverything")} className="max-h-[60vh] overflow-y-auto py-1">
        {!dq && <li role="presentation" className="px-4 py-3 text-[12.5px] text-t3">{t("omniEmpty")}</li>}
        {dq && res.isFetched && rows.length === 0 && <li role="presentation" className="px-4 py-3 text-[12.5px] text-t3">{t("omniNone", { q: dq })}</li>}
        {rows.map((r, i) => (
          <li key={r.key} role="presentation">
            {(i === 0 || rows[i - 1].group !== r.group) && <p className="label-caps px-4 pt-2 pb-1" aria-hidden="true">{r.group}</p>}
            <button type="button" id={`omni-${r.key}`} role="option" aria-selected={i === active} aria-label={`${r.group}: ${r.ar} ${r.sub}`} tabIndex={-1} className={"omni-row" + (i === active ? " is-active" : "")} onMouseEnter={() => setActive(i)} onClick={r.go}>
              <span className="dot" style={{ background: r.dot }} />
              <span className={(hasArabic(r.ar) ? "ar-classical text-[19px] leading-[1.6]" : "text-[14px]") + " min-w-[90px] truncate"} lang="ar" dir="rtl">{r.ar}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-t2" dir="auto">{r.sub}</span>
              <span className="mono text-[11px] text-t3" dir="auto">{r.meta}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11.5px] text-t3">
        <span>{t("omniEnter")}</span>
        <span>{t("omniEsc")}</span>
        <span className="flex-1" />
        <Link href={`/search?q=${encodeURIComponent(q)}`} onClick={onClose} className="hover:text-t1">{t("allResults")}</Link>
      </div>
    </Dialog>
  );
}

const FORMATS = ["chicago", "apa", "mla", "bibtex", "ris", "plain"] as const;

/**
 * Cite / share (design 03 §3.11, RDR-383…399, union of formats per P2.0): a versioned permalink that
 * matches its scope (RDR-387), the real access date (RDR-395), Quran conventions («[البقرة: ٢٥٥]»).
 */
function CiteDialog({ chapter }: { chapter: ChapterInfo }) {
  const cite = useReader((s) => s.cite);
  if (!cite) return null;
  return <CiteBody key={JSON.stringify(cite)} opened={cite} chapter={chapter} />;
}

function CiteBody({ opened, chapter }: { opened: CiteTarget; chapter: ChapterInfo }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const setCite = useReader((s) => s.setCite);
  const showToast = useReader((s) => s.showToast);
  const [format, setFormat] = useState<(typeof FORMATS)[number]>("chicago");
  const meta = useQuery({ queryKey: ["meta-version"], queryFn: () => getJSON<{ dataset: { version: string } }>("/meta"), staleTime: Infinity });
  // a word can be cited as itself, by its root or by its verse (RDR-385)
  const [scope, setScope] = useState<"word" | "root" | "verse">("word");
  const w = useWord(opened.kind === "word" && opened.slug ? opened.slug : null, opened.kind === "word" ? (opened.at ?? null) : null);
  const verseKey = opened.kind === "word" && opened.at ? opened.at.split(":").slice(0, 2).join(":") : null;
  const cite: CiteTarget =
    opened.kind === "word" && scope === "root" && w.data?.root
      ? { kind: "root", key: w.data.root.key, label: w.data.root.ar_spaced }
      : opened.kind === "word" && scope === "verse" && verseKey
        ? { kind: "verse", key: verseKey, label: verseKey }
        : opened;
  const version = meta.data?.dataset.version ?? "";
  const origin = typeof window !== "undefined" ? window.location.origin : SITE.url;
  const prefix = locale === "en" ? "/en" : "";
  // the permalink matches the scope cited (RDR-387): a word at its place, a verse, a root, an article's entry
  const path =
    cite.kind === "word"
      ? cite.at
        ? `/word/${cite.at}`
        : `/read?w=${encodeURIComponent(cite.slug)}`
      : cite.kind === "article"
        ? `/read?w=${encodeURIComponent(cite.slug)}`
        : cite.kind === "root"
          ? `/roots/${encodeURIComponent(cite.key)}`
          : `/quran/${cite.key.replace(":", "/")}`;
  const url = `${origin}${prefix}${path}`;
  const today = new Date().toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const name = locale === "ar" ? `${SITE.name.ar} — جذور ألفاظ القرآن الكريم` : `${SITE.name.en} — the Quran by its roots`;
  const ar = locale === "ar";
  const n = (x: string | number) => formatNumber(Number(x), locale);
  // Quran conventions (RDR-566): ﴿…﴾ [البقرة: ٢٥٥] / Q 2:255; a word adds its place; a dictionary
  // article is cited as the dictionary itself: «ابن منظور، لسان العرب، مادة (ع ل م)».
  const verseText = (key: string) =>
    typeof document === "undefined"
      ? "…"
      : Array.from(document.querySelectorAll<HTMLElement>(`[data-verse="${CSS.escape(key)}"] .w`))
          .map(tokenText)
          .join(" ") || "…";
  let title = cite.label;
  if (cite.kind === "verse") {
    const [, a] = cite.key.split(":");
    title = ar ? `﴿${verseText(cite.key)}﴾ [${chapter.nameAr}: ${n(a)}]` : `Q ${cite.key}`;
  } else if (cite.kind === "word" && cite.at) {
    const [, a, p] = cite.at.split(":");
    title = ar ? `«${cite.label}» [${chapter.nameAr}: ${n(a)}، الكلمة ${n(p)}]` : `“${cite.label}” (Q ${cite.at})`;
  } else if (cite.kind === "article") {
    title = ar
      ? `${cite.dict.author_ar.split("،")[0]}، ${cite.dict.title_ar}، مادة (${cite.root.spaced})${cite.page ? `، ${cite.page}` : ""}`
      : `${cite.dict.author_en}, ${cite.dict.title_en}, s.v. ${cite.root.translit}${cite.page ? `, ${cite.page}` : ""}`;
  }
  const year = new Date().getFullYear();
  const key = `jadhr_${(cite.kind === "word" || cite.kind === "article" ? cite.slug : cite.key.replace(":", "_")).replace(/[^a-z0-9_]/gi, "")}`;
  const texts: Record<(typeof FORMATS)[number], string> = {
    chicago:
      cite.kind === "article"
        ? `${title}. ${t("citedVia")} ${name}, ${t("datasetVersion", { v: version })}. ${t("accessed")} ${today}. ${url}.`
        : `“${title}.” ${name}, ${t("datasetVersion", { v: version })}. ${t("accessed")} ${today}. ${url}.`,
    apa: `${SITE.name.en}. (${year}). ${title}. In ${name} (${version}). ${url}`,
    mla: `“${title}.” ${name}, ${version}, ${url}. ${t("accessed")} ${today}.`,
    bibtex: `@misc{${key},\n  title = {${title}},\n  howpublished = {${name}, ${version}},\n  url = {${url}},\n  year = {${year}}\n}`,
    ris: `TY  - ELEC\nTI  - ${title}\nT2  - ${name}\nET  - ${version}\nUR  - ${url}\nPY  - ${year}\nY2  - ${new Date().toISOString().slice(0, 10)}\nER  - `,
    plain: `${title} — ${name} (${version}) — ${url}`,
  };
  function entryJson() {
    const base = { kind: cite.kind, permalink: url, dataset: version, licences: `${origin}${prefix}/sources` };
    if (cite.kind === "word" && w.data) {
      const d = w.data;
      return {
        ...base,
        slug: d.slug,
        ar: d.ar.full,
        translit: d.ar.translit,
        pos: d.pos,
        root: d.root ? { key: d.root.key, spaced: d.root.ar_spaced, translit: d.root.translit, occurrences: d.root.occurrences } : null,
        pattern: d.pattern ? { slug: d.pattern.slug, ar: d.pattern.ar.full } : null,
        occurrence: d.occurrence ? { location: d.occurrence.location, verse_key: d.occurrence.verse_key, surface: d.occurrence.surface.full } : null,
        occurrences: d.corpus_freq,
      };
    }
    return { ...base, key: cite.kind === "word" || cite.kind === "article" ? cite.slug : cite.key, label: cite.label };
  }
  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(msg);
    } catch {
      showToast(t("copyFailed"));
    }
  }
  return (
    <Dialog open onClose={() => setCite(null)} label={t("citeThis")} width={480}>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center">
          <h2 className="text-[15px] font-semibold">{t("citeThis")}</h2>
          <span className="flex-1" />
          <button type="button" className="btn icon-btn" onClick={() => setCite(null)} aria-label={t("close")}>✕</button>
        </div>
        {opened.kind === "word" && (w.data?.root || verseKey) && (
          <Segmented
            label={t("citeScope")}
            value={scope}
            onChange={setScope}
            options={[
              { value: "word" as const, label: t("citeScopeWord") },
              ...(w.data?.root ? [{ value: "root" as const, label: t("citeScopeRoot") }] : []),
              ...(verseKey ? [{ value: "verse" as const, label: t("citeScopeVerse") }] : []),
            ]}
          />
        )}
        <p className="label-caps">{t("permalink")}</p>
        <div className="flex items-center gap-2">
          <code className="mono min-w-0 flex-1 truncate rounded-md bg-card-2 px-2 py-1.5 text-[12px]" dir="ltr">{`${url} • ${version}`}</code>
          <button type="button" className="btn" onClick={() => copy(url, t("permalinkCopied"))}>{t("copy")}</button>
        </div>
        <div className="seg-group flex-wrap" role="group" aria-label={t("citationFormat")}>
          {FORMATS.map((f) => (
            <button key={f} type="button" className="seg" aria-pressed={format === f} onClick={() => setFormat(f)}>{t(`fmt_${f}`)}</button>
          ))}
        </div>
        <pre className="whitespace-pre-wrap rounded-md bg-card-2 p-3 text-[12.5px] leading-relaxed" dir="ltr">{texts[format]}</pre>
        <button type="button" className="btn btn-primary self-start" onClick={() => copy(texts[format], t("citationCopied"))}>{t("copyCitation")}</button>
        <p className="text-[11.5px] text-t3">{t("citeSourcesNote")}</p>
        {/* the entry as data (RDR-398): what we derived, with the permalink, the dataset version and where the licences are */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
          <button type="button" className="btn text-[12px]" onClick={() => copy(JSON.stringify(entryJson(), null, 2), t("jsonCopied"))}>
            {t("exportJson")}
          </button>
          <span className="flex-1" />
          <Link href="/sources" className="text-[11.5px] text-t3 underline-offset-2 hover:text-t1 hover:underline" onClick={() => setCite(null)}>
            {t("licencesLink")}
          </Link>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Suggest an edit / propose a sense / a gloss / a morphology correction / report an error (design 03 §3.7,
 * RDR-311…325, 567): wording and a required rationale (P2.0); sources optional but offered. Saved locally
 * until accounts exist (P6), then submitted to the review queue (P7) — the dialog says so plainly. No form
 * reaches the Quranic text: it is the KFGQPC text as published (L1).
 */
function SuggestDialog() {
  const target = useReader((s) => s.suggest);
  if (!target) return null;
  // a fresh form per target: the wording starts from the current text, the rationale empty
  return <SuggestForm key={`${target.kind}:${target.slug}:${target.ordinal ?? ""}:${target.at ?? ""}`} target={target} />;
}

const SUGGEST_TITLE = { sense: "proposeTitle", error: "errorTitle", gloss: "glossTitle", morphology: "morphTitle" } as const;

function SuggestForm({ target }: { target: SuggestTarget }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const setSuggest = useReader((s) => s.setSuggest);
  const showToast = useReader((s) => s.showToast);
  const addProposal = usePersonal((s) => s.addProposal);
  const morph = target.kind === "morphology";
  const fields = target.fields ?? [];
  const [field, setField] = useState<MorphKey | "">(fields[0]?.key ?? "");
  const startsFromCurrent = target.kind === "edit" || target.kind === "gloss";
  const [text, setText] = useState(startsFromCurrent ? target.current : "");
  const [why, setWhy] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const dicts = useQuery({ queryKey: ["dictionaries"], queryFn: () => getJSON<{ data: { key: string; name_ar: string; name_en: string }[] }>("/dictionaries"), staleTime: Infinity, enabled: !morph });
  const current = morph ? (fields.find((f) => f.key === field)?.value ?? "") : target.current;
  const valid = text.trim().length > 0 && why.trim().length > 0 && (!startsFromCurrent && !morph ? true : text.trim() !== current.trim()) && (!morph || !!field);
  const heading = target.kind === "edit" ? t("suggestTitle", { n: String(target.ordinal ?? 0).padStart(2, "0") }) : t(SUGGEST_TITLE[target.kind]);
  return (
    <Dialog open onClose={() => setSuggest(null)} label={heading} width={460}>
      <form
        className="flex flex-col gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          addProposal({ kind: target.kind, slug: target.slug, label: target.label, ordinal: target.ordinal ?? null, at: target.at ?? null, field: morph && field ? field : null, current, text: text.trim(), why: why.trim(), sources });
          setSuggest(null);
          showToast(t("proposalSaved"));
        }}
      >
        <h2 className="text-[15px] font-semibold">{heading}</h2>
        {target.at && <p className="text-[12px] text-t3">{t("suggestAt", { word: target.label, ref: target.at })}</p>}
        {morph && (
          <label className="conc-select">
            <span>{t("morphField")}</span>
            <select value={field} onChange={(e) => setField(e.target.value as MorphKey)} data-autofocus>
              {fields.map((f) => (
                <option key={f.key} value={f.key}>{t(f.key)}</option>
              ))}
            </select>
          </label>
        )}
        {current && (
          <div>
            <p className="label-caps">{t("current")}</p>
            <p className="mt-1 rounded-md bg-card-2 px-3 py-2 text-[13.5px]" dir="auto">{current}</p>
          </div>
        )}
        <label className="flex flex-col gap-1">
          <span className="label-caps">{morph ? t("morphProposed") : t("yourWording")}</span>
          <textarea data-autofocus={morph ? undefined : true} value={text} onChange={(e) => setText(e.target.value)} rows={morph ? 2 : 3} className="field" dir="auto" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps">{t("whySource")} <span className="text-bad">*</span></span>
          <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder={morph ? t("morphWhyPlaceholder") : t("whyPlaceholder")} className="field" dir="auto" required />
        </label>
        {!morph && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("sources")}>
            {(dicts.data?.data ?? []).map((d) => (
              <button key={d.key} type="button" className={"chip" + (sources.includes(d.key) ? " is-on" : "")} aria-pressed={sources.includes(d.key)} onClick={() => setSources((s) => (s.includes(d.key) ? s.filter((x) => x !== d.key) : [...s, d.key]))}>
                {locale === "ar" ? d.name_ar : d.name_en}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn flex-1" onClick={() => setSuggest(null)}>{t("cancel")}</button>
          <button type="submit" className={"btn flex-[2] " + (valid ? "btn-primary" : "")} disabled={!valid}>{t("submitForReview")}</button>
        </div>
        <p className="text-[11.5px] leading-relaxed text-t3">
          {[t("suggestFootnote"), morph ? t("morphFootnote") : null, t("quranTextClosed")].filter(Boolean).join(" ")}
        </p>
      </form>
    </Dialog>
  );
}

const BEATS = ["beat1", "beat2", "beat3"] as const;

/** Onboarding (design 03 §3.11, RDR-400…408): three beats, a Quranic demo word, dismissible. */
function Onboarding({ chapter }: { chapter: ChapterInfo }) {
  const t = useTranslations("rd");
  const router = useRouter();
  const onboarded = usePersonal((s) => s.onboarded);
  const setOnboarded = usePersonal((s) => s.setOnboarded);
  const review = useReader((s) => s.review);
  const openWord = useReader((s) => s.openWord);
  const jumpTo = useReader((s) => s.jumpTo);
  const beat = useReader((s) => s.onbBeat);
  const setBeat = useReader((s) => s.setOnbBeat);
  const hydrated = useIsClient();
  if (!hydrated || onboarded || review) return null;
  const b = BEATS[beat];
  return (
    <div className="onboarding popover" role="dialog" aria-label={t("onboardingLabel")}>
      <div className="flex items-center gap-2">
        <span className="mono text-[10.5px] uppercase text-root">{t("beatOf", { n: beat + 1 })}</span>
        <span className="flex gap-1" aria-hidden="true">
          {BEATS.map((x, i) => (
            <span key={x} className="h-1 w-4 rounded-full" style={{ background: i <= beat ? "var(--c-root)" : "var(--line-2)" }} />
          ))}
        </span>
        <span className="flex-1" />
        <button type="button" className="text-[12px] text-t3 hover:text-t1" onClick={setOnboarded}>{t("skip")}</button>
      </div>
      <p className="text-[15px] font-semibold">{t(`${b}Title`)}</p>
      <p className="text-[13px] leading-relaxed text-t2">{t(`${b}Body`)}</p>
      <button
        type="button"
        className="btn btn-primary self-start"
        onClick={() => {
          if (beat === 0) {
            // the demo word in its place: «وَقُل رَّبِّ زِدْنِى عِلْمًا» (Ṭā Hā 20:114, word 17)
            if (chapter.number === 20) openWord({ slug: "ilm", at: "20:114:17" });
            else router.push("/quran/20?w=ilm&at=20:114:17#v114");
            setBeat(1);
          } else if (beat === 1) {
            jumpTo("family");
            setBeat(2);
          } else setOnboarded();
        }}
      >
        {t(`${b}Action`)}
      </button>
    </div>
  );
}

function Toast() {
  const toast = useReader((s) => s.toast);
  const [expired, setExpired] = useState<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setExpired(toast.id), 1900);
    return () => clearTimeout(id);
  }, [toast]);
  const shown = toast && toast.id !== expired ? toast : null;
  return (
    <div role="status" aria-live="polite">
      {shown && (
        <div key={shown.id} className="toast">
          {shown.text}
        </div>
      )}
    </div>
  );
}

