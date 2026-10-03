"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "@/i18n/navigation";
import { useAfterMount } from "@/lib/client";
import { cnt, formatNumber } from "@/lib/format";
import { usePersonal, usePrefs, useReader, verseRef } from "@/lib/reader/store";
import { useAudio } from "@/lib/store/audio";
import type { ChapterInfo } from "./ReaderShell";
import { useDebounced } from "@/lib/useDebounced";
import { GrammarBand } from "./GrammarBand";
import { HoverCard, type HoverWord } from "./HoverCard";
import { InlineGloss } from "./InlineGloss";
import { useSaved } from "@/lib/store/saved";
import { InlineLines } from "./InlineLines";
import { VerseDrawer, type DrawerTool } from "./VerseDrawer";

/**
 * Wraps the server-rendered sūra and owns its interaction through event delegation (design 03 §3.4):
 * word and verse clicks, the URL (?w=slug&at=location, ?v=2:255 — read and written, RDR-449/539),
 * selection and root-family underlines, word states (opt-in, D20), verse tools (hover, focus, 420 ms
 * long-press), drawers, reading progress and the resume marker, keyboard movement between words, and a
 * copy handler that puts the reference after the copied text.
 */
export type InitialSelection = { verse?: string; word?: { slug: string; at: string } };

export function ReadingSurface({ chapter, initial, children }: { chapter: ChapterInfo; initial?: InitialSelection; children: React.ReactNode }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const selection = useReader((s) => s.selection);
  const verse = useReader((s) => s.verse);
  const mode = useReader((s) => s.mode);
  const focusRoot = useReader((s) => s.focusRoot);
  const openWord = useReader((s) => s.openWord);
  const openVerse = useReader((s) => s.openVerse);
  const closeEntry = useReader((s) => s.closeEntry);
  const setMode = useReader((s) => s.setMode);
  const setCite = useReader((s) => s.setCite);
  const showToast = useReader((s) => s.showToast);
  const tintRoot = usePrefs((s) => s.tintRoot);
  const size = usePrefs((s) => s.size);
  const translitPref = usePrefs((s) => s.translitLine);
  const wordStatesOn = usePrefs((s) => s.wordStates);
  const grammarBand = usePrefs((s) => s.grammarBand);
  const imlaeiLine = usePrefs((s) => s.imlaeiLine);
  const panelOpen = usePrefs((s) => s.panelOpen);
  const notes = useSaved((s) => s.notes);
  const links = usePersonal((s) => s.links);
  const verseTopics = usePersonal((s) => s.verseTopics);
  const topicList = usePersonal((s) => s.topics);
  const topicLabel = new Map(topicList.map((x) => [x.id, x.label]));
  const inChapter = (k: string) => k.startsWith(`quran:${chapter.number}:`);
  const markedVerses = [
    ...new Set([
      ...Object.keys(notes).filter((k) => k.startsWith(`${chapter.number}:`)),
      ...Object.keys(links).filter(inChapter).map((k) => k.slice(6)),
      ...Object.keys(verseTopics).filter(inChapter).map((k) => k.slice(6)),
    ]),
  ];
  const setPrefs = usePrefs((s) => s.set);
  const wordStates = usePersonal((s) => s.wordStates);
  const setProgress = usePersonal((s) => s.setProgress);
  const playVerse = useAudio((s) => s.playVerse);
  const stopAudio = useAudio((s) => s.stop);
  const playingKey = useAudio((s) => (s.playing && s.mode !== "word" && s.surah && s.queue[s.index] ? `${s.surah}:${s.queue[s.index].ayah}` : null));
  // the Recite tool of the verse being recited reads as pressed, and says it stops
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>('.ptool[data-tool="audio"][aria-pressed="true"]').forEach((el) => {
      el.setAttribute("aria-pressed", "false");
      el.removeAttribute("aria-label");
    });
    if (!playingKey) return;
    const el = root.querySelector<HTMLElement>(`.ptool[data-tool="audio"][data-verse-key="${CSS.escape(playingKey)}"]`);
    el?.setAttribute("aria-pressed", "true");
    el?.setAttribute("aria-label", t("stopRecite"));
  }, [playingKey, t]);
  const [drawer, setDrawer] = useState<{ key: string; tool: DrawerTool } | null>(null);
  // The verse whose full toolbar is drawn: hovered, else focused, else long-pressed, else open.
  const [hoverVerse, setHoverVerse] = useState<string | null>(null);
  const [focusVerse, setFocusVerse] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const arrival = useRef(false);
  const [hover, setHover] = useState<{ slug: string; at: string } | null>(null);
  const hoverIntent = useDebounced(hover, 140);
  // The hover card (RDR-117…122): shown after the pointer rests on a word, hidden 160 ms after it leaves
  // the word unless it has moved into the card, 120 ms after it leaves the card (RDR-584); Esc, a click
  // or a scroll put it away. Timers live in the event handlers.
  const [card, setCard] = useState<HoverWord | null>(null);
  const cardTimers = useRef<{ show?: ReturnType<typeof setTimeout>; hide?: ReturnType<typeof setTimeout>; inCard: boolean; at: string | null }>({ inCard: false, at: null });
  const hideCard = (ms: number) => {
    const c = cardTimers.current;
    clearTimeout(c.hide);
    c.hide = setTimeout(() => {
      if (c.inCard) return;
      c.at = null;
      setCard(null);
    }, ms);
  };
  const closeCard = () => {
    const c = cardTimers.current;
    clearTimeout(c.show);
    clearTimeout(c.hide);
    c.inCard = false;
    c.at = null;
    setCard(null);
  };
  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCard();
    // only a scroll that moves the word itself (the page, the reading column) — not a tool row scrolling
    const onScroll = (e: Event) => {
      const t = e.target;
      const word = document.querySelector(`.w[data-w="${CSS.escape(card.at)}"]`);
      if (t === document || (t instanceof Node && word && t.contains(word))) closeCard();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [card]);
  useEffect(() => () => {
    clearTimeout(cardTimers.current.show);
    clearTimeout(cardTimers.current.hide);
  }, []);
  const mounted = useAfterMount();
  // Where the last visit stopped in this sūra, captured once: reading on moves progress, not the marker.
  const [resume] = useState(() => {
    const prev = usePersonal.getState().progress.quran;
    return prev && prev.chapter === chapter.number && prev.passage > 1 ? { passage: prev.passage, at: prev.at } : null;
  });
  // Words are buttons; only one of them is in the tab order at a time (the server markup leaves that
  // to the browser, to keep al-Baqara light).
  useEffect(() => {
    if (!ref.current) return;
    ref.current.querySelectorAll<HTMLElement>(".w").forEach((w) => (w.tabIndex = -1));
    roving(ref.current, null);
  }, []);

  // URL → state on arrival (a route's own verse or word first: /quran/2/255, /word/2:255:3); then the
  // resume marker from the last visit (shown, then the reader goes on).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const w = p.get("w") ?? initial?.word?.slug ?? (p.get("at") ? "" : null);
    const at = p.get("at") ?? initial?.word?.at ?? null;
    const v = p.get("v") ?? initial?.verse ?? null;
    if (w || v) arrival.current = true;
    if (w !== null && (w || at)) {
      openWord({ slug: w, at: at && at.startsWith(`${chapter.number}:`) ? at : null });
      setPrefs({ panelOpen: true });
    } else if (v && v.startsWith(`${chapter.number}:`)) {
      openVerse(v);
      setPrefs({ panelOpen: true });
    }
    const target = at ? `v${at.split(":")[1]}` : v ? `v${v.split(":")[1]}` : window.location.hash.slice(1);
    requestAnimationFrame(() => {
      const el = target ? document.getElementById(target) : resume ? document.getElementById(`v${resume.passage}`) : null;
      if (el) {
        el.scrollIntoView({ block: "center" });
        el.setAttribute("data-target", "");
        setTimeout(() => el.removeAttribute("data-target"), 2400);
      }
    });
    // the route's initial selection is compared by value
  }, [chapter.number, openWord, openVerse, setPrefs, resume, initial?.verse, initial?.word?.slug, initial?.word?.at]);

  // State → URL, without navigation, once something changes: a verse of this sūra is its own path
  // (/quran/2/255), a word and the index are parameters on the sūra (?w=…&at=…, ?mode=lookup). Each
  // change is a history entry, so the browser's back and forward step through what was opened; the
  // selection applied on arrival only replaces the entry it came from.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const url = new URL(window.location.href);
    const prefix = /^\/en(\/|$)/.test(url.pathname) ? "/en" : "";
    url.pathname = `${prefix}/quran/${chapter.number}`;
    for (const k of ["w", "at", "v", "mode", "q"]) url.searchParams.delete(k);
    if (mode === "word" && selection) {
      if (selection.slug) url.searchParams.set("w", selection.slug);
      if (selection.at) url.searchParams.set("at", selection.at);
    } else if (mode === "verse" && verse) {
      const [s, a] = verse.split(":");
      if (Number(s) === chapter.number) url.pathname += `/${a}`;
      else url.searchParams.set("v", verse);
    } else if (mode === "index") url.searchParams.set("mode", "lookup");
    else if (mode === "surah") url.searchParams.set("mode", "about");
    if (url.href === window.location.href) return;
    // a word's own permalink (/word/2:255:3) stays in the address bar until the reader moves on
    if (arrival.current && /^(\/en)?\/word\//.test(window.location.pathname)) {
      arrival.current = false;
      return;
    }
    if (arrival.current) {
      arrival.current = false;
      window.history.replaceState(window.history.state, "", url.href);
    } else window.history.pushState(window.history.state, "", url.href);
  }, [mode, selection, verse, chapter.number]);

  // Back and forward: read the entry's URL back into the reader (another sūra is Next's navigation).
  useEffect(() => {
    function onPop() {
      const u = new URL(window.location.href);
      const m = u.pathname.match(/\/quran\/(\d+)(?:\/(\d+))?\/?$/);
      if (!m || Number(m[1]) !== chapter.number) return;
      const w = u.searchParams.get("w");
      const v = u.searchParams.get("v");
      const mode = u.searchParams.get("mode");
      const s = useReader.getState();
      if (m[2]) s.openVerse(`${m[1]}:${m[2]}`);
      else if (w || u.searchParams.get("at")) s.openWord({ slug: w ?? "", at: u.searchParams.get("at") }, { fromHistory: true });
      else if (v) s.openVerse(v);
      else if (mode === "lookup") s.setMode("index");
      else if (mode === "about") s.setMode("surah");
      else s.closeEntry();
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [chapter.number]);

  // Selection, root-family and focus-root underlines; the hot passage.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll(".is-selected, .is-family, .is-focus").forEach((el) => el.classList.remove("is-selected", "is-family", "is-focus"));
    root.querySelectorAll("[data-hot]").forEach((el) => el.removeAttribute("data-hot"));
    let familyRoot: string | undefined;
    if (mode === "word" && selection?.at) {
      const [vs, va] = selection.at.split(":");
      const direct = Array.from(root.querySelectorAll<HTMLElement>(`.w[data-w="${CSS.escape(selection.at)}"], .w[data-w2="${CSS.escape(selection.at)}"]`));
      // a word inside a mushaf token that holds several corpus words (rare): look within its verse only
      const tokens = direct.length
        ? direct
        : Array.from(root.querySelectorAll<HTMLElement>(`[data-verse="${vs}:${va}"] .w[data-w2]`)).filter((el) => covers(el, selection.at!));
      tokens.forEach((el) => el.classList.add("is-selected"));
      familyRoot = tokens[0]?.dataset.r;
      tokens[0]?.closest(".passage")?.setAttribute("data-hot", "");
      tokens[0]?.scrollIntoView({ block: "nearest" });
      // On phones the sheet covers the lower half: keep the tapped word above it (RDR-416).
      const word = tokens[0];
      const sheet = document.querySelector<HTMLElement>(".reader-sheet");
      if (word && sheet)
        requestAnimationFrame(() => {
          const r = word.getBoundingClientRect();
          const top = sheet.getBoundingClientRect().top;
          if (r.bottom > top - 12) root.closest(".reader-surface")?.scrollBy({ top: r.bottom - top + 64, behavior: "smooth" });
        });
      roving(root, tokens[0] ?? null);
    }
    if (mode === "verse" && verse) root.querySelector(`[data-verse="${CSS.escape(verse)}"]`)?.setAttribute("data-hot", "");
    if (tintRoot && familyRoot)
      root.querySelectorAll<HTMLElement>(`.w[data-r="${CSS.escape(familyRoot)}"]`).forEach((el) => !el.classList.contains("is-selected") && el.classList.add("is-family"));
    if (focusRoot) root.querySelectorAll<HTMLElement>(`.w[data-r="${CSS.escape(focusRoot)}"]`).forEach((el) => el.classList.add("is-focus"));
  }, [mode, selection, verse, tintRoot, focusRoot]);

  // The tool whose drawer is open reads as pressed.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll('.ptool[aria-pressed="true"]').forEach((el) => el.setAttribute("aria-pressed", "false"));
    if (drawer) root.querySelector(`.ptool[data-tool="${drawer.tool}"][data-verse-key="${CSS.escape(drawer.key)}"]`)?.setAttribute("aria-pressed", "true");
  }, [drawer]);

  // Word states drawn in the text only in study mode (D20); a known word carries no mark.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>(".w").forEach((el) => {
      const st = el.dataset.l ? wordStates[el.dataset.l] : undefined;
      el.classList.toggle("is-learning", wordStatesOn && st === "learning");
      // unmarked words are new, and so is a word the reader set back to "new" (RDR-106, 535)
      el.classList.toggle("is-new", wordStatesOn && !!el.dataset.l && (!st || st === "new"));
    });
  }, [wordStates, wordStatesOn]);

  // Reading progress: the top-most verse in view (advances on reading, not only on taps — RDR-572).
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let last = 0;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
        if (!visible.length) return;
        const ayah = Number((visible[0].dataset.verse ?? "").split(":")[1]);
        if (ayah && ayah !== last) {
          last = ayah;
          setProgress("quran", { chapter: chapter.number, passage: ayah });
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    root.querySelectorAll(".passage").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [chapter.number, setProgress]);

  // Arrow keys move between words in reading order; Esc closes the entry.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      // Esc closes the innermost layer only: a dialog, a term card or a popover handles its own Esc.
      if (e.key === "Escape" && !document.querySelector("[role=dialog]:not(.onboarding)")) {
        if (drawer) setDrawer(null);
        else closeEntry();
        return;
      }
      // Alt+↑/↓ move to the previous / next sūra from anywhere in the reader.
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        const n = chapter.number + (e.key === "ArrowDown" ? 1 : -1);
        if (n >= 1 && n <= 114) {
          e.preventDefault();
          router.push(`/quran/${n}`);
        }
        return;
      }
      if (!el?.classList.contains("w") || !ref.current) return;
      // ↑/↓ move to the first word of the previous / next verse.
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const verses = Array.from(ref.current.querySelectorAll<HTMLElement>(".passage"));
        const i = verses.indexOf(el.closest<HTMLElement>(".passage")!);
        const to = verses[i + (e.key === "ArrowDown" ? 1 : -1)]?.querySelector<HTMLElement>(".w");
        if (to) {
          e.preventDefault();
          roving(ref.current, to);
          to.focus();
        }
        return;
      }
      const rtl = document.documentElement.dir === "rtl";
      const dir = e.key === (rtl ? "ArrowLeft" : "ArrowRight") ? 1 : e.key === (rtl ? "ArrowRight" : "ArrowLeft") ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const all = Array.from(ref.current.querySelectorAll<HTMLElement>(".w"));
      const next = all[all.indexOf(el) + dir];
      if (next) {
        roving(ref.current, next);
        next.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeEntry, drawer, chapter.number, router]);

  // Touch: a 420 ms long-press reveals a verse's tools; moving cancels it, so scrolling never does (RDR-149).
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null }>({ timer: null });
  function onTouchStart(e: React.TouchEvent) {
    const passage = (e.target as HTMLElement).closest<HTMLElement>(".passage");
    if (!passage) return;
    press.current.timer = setTimeout(() => setPressed(passage.dataset.verse ?? null), 420);
  }
  function cancelPress() {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
  }
  useEffect(() => () => cancelPress(), []); // nor after the page has gone (RDR-540)

  function onClick(e: React.MouseEvent) {
    closeCard();
    const el = e.target as HTMLElement;
    const tool = el.closest<HTMLElement>("[data-tool]");
    if (tool) {
      runTool(tool.dataset.tool as DrawerTool | "audio" | "tafsir" | "copy" | "cite", tool.dataset.verseKey!);
      return;
    }
    if (el.closest("[data-about]")) {
      setMode("surah");
      setPrefs({ panelOpen: true });
      return;
    }
    const verseBtn = el.closest<HTMLElement>("[data-verse-btn]");
    if (verseBtn) {
      openVerse(verseBtn.dataset.verseBtn!);
      setPrefs({ panelOpen: true });
      return;
    }
    const w = el.closest<HTMLElement>(".w");
    if (w && !window.getSelection()?.toString()) {
      // A mushaf word holding two corpus words (لَّوۡمَا): a second tap opens the second.
      const second = selection?.at === w.dataset.w && w.dataset.w2;
      const at = second ? w.dataset.w2! : w.dataset.w!;
      const slug = second ? w.dataset.l2 : w.dataset.l;
      // a word with no lemma (a pronoun, the Quranic initials) opens its own entry by location (RDR-548)
      openWord({ slug: slug ?? "", at });
      setPrefs({ panelOpen: true });
    }
  }

  async function runTool(tool: DrawerTool | "audio" | "tafsir" | "copy" | "cite", key: string) {
    if (tool === "audio") {
      // the verse being recited: its Recite tool stops it (RDR-144)
      if (playingKey === key) return stopAudio();
      return void playVerse(key);
    }
    if (tool === "tafsir") {
      openVerse(key);
      setPrefs({ panelOpen: true });
      return;
    }
    if (tool === "cite") return setCite({ kind: "verse", key, label: key });
    if (tool === "copy") {
      const ayah = Number(key.split(":")[1]);
      const words = Array.from(ref.current?.querySelectorAll<HTMLElement>(`[data-verse="${CSS.escape(key)}"] .w`) ?? []).map((w) => w.textContent);
      // the translation shown under the verse goes with it, credited (RDR-555)
      const tr = ref.current?.querySelector<HTMLElement>(`[data-inline="${CSS.escape(key)}"] .inline-translation`);
      const trText = tr?.querySelector(".inline-tr-text")?.textContent;
      const text = `﴿${words.join(" ")}﴾ [${chapter.nameAr}: ${formatNumber(ayah, "ar")}]` + (tr && trText ? `\n${trText} — ${tr.dataset.credit ?? ""}` : "");
      try {
        await navigator.clipboard.writeText(text);
        showToast(t("verseCopied"));
      } catch {
        showToast(t("copyFailed"));
      }
      return;
    }
    setDrawer((d) => (d && d.key === key && d.tool === tool ? null : { key, tool }));
  }

  function onCopy(e: React.ClipboardEvent) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) return;
    const range = sel.getRangeAt(0);
    const parts: string[] = [];
    const refs: number[] = [];
    for (const v of Array.from(ref.current.querySelectorAll<HTMLElement>(".passage"))) {
      if (!range.intersectsNode(v)) continue;
      const words = Array.from(v.querySelectorAll<HTMLElement>(".w")).filter((w) => range.intersectsNode(w));
      if (!words.length) continue;
      parts.push(words.map((w) => w.textContent).join(" "));
      refs.push(Number((v.dataset.verse ?? "").split(":")[1]));
    }
    if (!parts.length) return;
    const span = refs.length > 1 ? `${formatNumber(refs[0], "ar")}–${formatNumber(refs[refs.length - 1], "ar")}` : formatNumber(refs[0], "ar");
    e.clipboardData.setData("text/plain", `﴿${parts.join(" ")}﴾ [${chapter.nameAr}: ${span}]`);
    e.preventDefault();
  }

  // The grammar band follows the hovered word (after a short intent delay), else the selected one.
  function onPointerOver(e: React.PointerEvent) {
    // A real mouse only: a tap emits pointer/mouse-over first, and tools drawn then would move the word
    // from under the finger before the click lands (the lesson of the first phone build).
    if (e.pointerType !== "mouse") return;
    const pv = (e.target as HTMLElement).closest<HTMLElement>(".passage")?.dataset.verse ?? null;
    if (pv !== hoverVerse) setHoverVerse(pv);
    const w = (e.target as HTMLElement).closest<HTMLElement>(".w");
    const c = cardTimers.current;
    if (w?.dataset.w) {
      if (c.at === w.dataset.w) clearTimeout(c.hide);
      else {
        clearTimeout(c.show);
        c.show = setTimeout(() => {
          const r = w.getBoundingClientRect();
          c.at = w.dataset.w!;
          clearTimeout(c.hide);
          setCard({ slug: w.dataset.l ?? "", at: w.dataset.w!, rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right } });
        }, 350);
      }
    } else {
      clearTimeout(c.show);
      if (c.at) hideCard(160);
    }
    if (!grammarBand) return;
    // words with no lemma get the band too, read by their place (RDR-136)
    const next = w?.dataset.w ? { slug: w.dataset.l ?? "", at: w.dataset.w } : null;
    if (next?.at !== hover?.at) setHover(next);
  }
  const bandWord = grammarBand ? (hoverIntent ?? (mode === "word" && selection?.at ? { slug: selection.slug, at: selection.at } : null)) : null;
  const bandEl = mounted && bandWord ? document.querySelector(`[data-band="${CSS.escape(bandWord.at.split(":").slice(0, 2).join(":"))}"]`) : null;

  // Phone with the sheet put away: the selected word's gloss stands under its verse (RDR-605).
  const phone = mounted && document.querySelector(".reader-v5")?.getAttribute("data-bp") === "phone";
  const glossEl =
    phone && !panelOpen && mode === "word" && selection?.at?.startsWith(`${chapter.number}:`)
      ? document.querySelector(`[data-gloss="${CSS.escape(selection.at.split(":").slice(0, 2).join(":"))}"]`)
      : null;

  const hotVerse = mode === "verse" && verse ? verse : mode === "word" && selection?.at ? selection.at.split(":").slice(0, 2).join(":") : null;
  const openDrawerVerse = drawer?.key ?? null;
  const activeVerse = hoverVerse ?? focusVerse ?? pressed ?? openDrawerVerse ?? hotVerse;
  const moreEl = mounted && activeVerse ? document.querySelector(`[data-more="${CSS.escape(activeVerse)}"]`) : null;

  const translitOn = translitPref ?? locale !== "ar";
  const resumeEl = mounted && resume ? document.querySelector(`#v${resume.passage} .passage-label`) : null;
  const drawerEl = mounted && drawer ? document.querySelector(`[data-drawer="${CSS.escape(drawer.key)}"]`) : null;

  return (
    <div
      ref={ref}
      className="reading"
      data-translit={translitOn ? "on" : "off"}
      data-grammar={grammarBand ? "on" : undefined}
      data-imlaei={imlaeiLine ? "on" : undefined}
      style={{ ["--size" as string]: String(size), ["--band-hint" as string]: JSON.stringify(t("bandHint")) }}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onMouseLeave={() => {
        setHover(null);
        setHoverVerse(null);
        clearTimeout(cardTimers.current.show);
        if (cardTimers.current.at) hideCard(160);
      }}
      onCopy={onCopy}
      onTouchStart={onTouchStart}
      onTouchMove={cancelPress}
      onTouchEnd={cancelPress}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusVerse(null);
      }}
      onFocus={(e) => {
        const el = e.target as HTMLElement;
        // the first Tab into the text lands on one word; arrows move from there
        if (el.classList.contains("w")) roving(ref.current!, el);
        setFocusVerse(el.matches(":focus-visible") ? (el.closest<HTMLElement>(".passage")?.dataset.verse ?? null) : null);
      }}
    >
      {children}
      {mounted && <InlineLines chapter={chapter.number} />}
      {resumeEl &&
        createPortal(
          <span className="resume-mark">
            <span className="dot" style={{ background: "var(--c-root)" }} />
            {t("youStoppedHere", { date: new Date(resume!.at).toLocaleDateString(locale === "ar" ? "ar" : "en-GB", { day: "numeric", month: "long" }) })}
          </span>,
          resumeEl,
        )}
      {glossEl && selection?.at && createPortal(<InlineGloss key={selection.at} slug={selection.slug} at={selection.at} />, glossEl)}
      {mounted &&
        markedVerses.map((key) => {
          const slot = document.querySelector(`[data-note="${CSS.escape(key)}"]`);
          if (!slot) return null;
          const n = notes[key];
          const linkCount = links[verseRef(key)]?.length ?? 0;
          const verseTopicIds = verseTopics[verseRef(key)] ?? [];
          return createPortal(
            <>
              {n && (
                <button type="button" className="margin-note" data-tool="note" data-verse-key={key}>
                  <em>{t("noteMark")}</em>
                  <span className="line-clamp-2 flex-1" dir="auto">{n.text}</span>
                </button>
              )}
              {(linkCount > 0 || verseTopicIds.length > 0) && (
                // the marks row (RDR-142): the reader's links and topics on this verse, each opening its drawer
                <div className="marks-row">
                  {linkCount > 0 && (
                    <button type="button" className="mark" data-tool="links" data-verse-key={key} title={t("marksLinksTitle")}>
                      {t("marksLinks", cnt(linkCount, locale))}
                    </button>
                  )}
                  {verseTopicIds.map((id) => (
                    <button key={id} type="button" className="mark" data-tool="topic" data-verse-key={key} title={t("marksTopicTitle")}>
                      {t("marksTopic", { label: topicLabel.get(id) ?? "" })}
                    </button>
                  ))}
                </div>
              )}
            </>,
            slot,
            `marks-${key}`,
          );
        })}
      {bandEl && bandWord && createPortal(<GrammarBand key={bandWord.at} slug={bandWord.slug} at={bandWord.at} />, bandEl)}
      {moreEl && activeVerse && createPortal(<MoreTools verseKey={activeVerse} drawer={drawer} />, moreEl, `more-${activeVerse}`)}
      {drawerEl && drawer && createPortal(<VerseDrawer verseKey={drawer.key} tool={drawer.tool} onClose={() => setDrawer(null)} />, drawerEl)}
      {card && (
        <HoverCard
          key={card.at}
          word={card}
          onEnter={() => {
            cardTimers.current.inCard = true;
            clearTimeout(cardTimers.current.hide);
            clearTimeout(cardTimers.current.show); // words crossed on the way into the card do not take it over
          }}
          onLeave={() => {
            cardTimers.current.inCard = false;
            hideCard(120);
          }}
          onClose={closeCard}
        />
      )}
    </div>
  );
}

function covers(el: HTMLElement, location: string): boolean {
  if (el.dataset.w === location || el.dataset.w2 === location) return true;
  if (!el.dataset.w2) return false;
  const [s, a, from] = el.dataset.w!.split(":").map(Number);
  const to = Number(el.dataset.w2.split(":")[2]);
  const [ls, la, lw] = location.split(":").map(Number);
  return ls === s && la === a && lw >= from && lw <= to;
}

/** One word in the text is tabbable at a time (a roving tabindex): the selected or last-focused one. */
function roving(root: HTMLElement, el: HTMLElement | null) {
  root.querySelectorAll<HTMLElement>(".w[tabindex='0']").forEach((x) => x.setAttribute("tabindex", "-1"));
  (el ?? root.querySelector<HTMLElement>(".w"))?.setAttribute("tabindex", "0");
}

const MORE = ["tafsir", "related", "links", "topic", "copy", "cite", "note", "graph"] as const;
const MORE_DRAWERS = new Set<string>(["related", "links", "topic", "note", "graph"]);

/** The six verse tools beyond Recite and Roots, drawn only into the verse being read (P2.10a). */
function MoreTools({ verseKey, drawer }: { verseKey: string; drawer: { key: string; tool: DrawerTool } | null }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const me = verseRef(verseKey);
  // the count on each tool, hidden at zero (RDR-146, 147)
  const links = usePersonal((s) => s.links[me]?.length ?? 0);
  const topics = usePersonal((s) => s.verseTopics[me]?.length ?? 0);
  const note = useSaved((s) => (s.notes[verseKey] ? 1 : 0));
  const badge: Partial<Record<(typeof MORE)[number], number>> = { links, topic: topics, note };
  return (
    <>
      {MORE.map((tool) => (
        <button
          key={tool}
          type="button"
          className="ptool"
          data-tool={tool}
          data-verse-key={verseKey}
          aria-pressed={MORE_DRAWERS.has(tool) ? drawer?.key === verseKey && drawer.tool === tool : undefined}
          title={t(`tool_${tool}_hint`)}
        >
          {t(`tool_${tool}`)}
          {!!badge[tool] && <span className="ptool-badge mono">{formatNumber(badge[tool]!, locale)}</span>}
        </button>
      ))}
    </>
  );
}

