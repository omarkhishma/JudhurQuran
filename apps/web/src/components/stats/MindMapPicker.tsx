"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Link, useRouter } from "@/i18n/navigation";
import { getJSON } from "@/lib/reader/api";

type Subject = { kind: "lemma"; slug: string } | { kind: "root"; key: string };

const ROOTS = ["علم", "رحم", "صبر", "كتب", "هدي", "نور"];
const WORDS: [string, string][] = [
  ["ilm", "عِلْم"],
  ["rahma", "رَحْمَة"],
  ["sabr", "صَبْر"],
  ["kitab", "كِتَٰب"],
  ["huda", "هُدًى"],
  ["qalb", "قَلْب"],
];
const spaced = (k: string) => [...k].join(" ");

/**
 * Where a mind map starts (P16.4): a word or a root typed in any spelling — resolved by the questions' resolver (typed
 * vowels, the article, the hamza's seat; English glosses) — or one of the examples; and the reader's own way to it,
 * from any word's panel.
 */
export function MindMapPicker() {
  const t = useTranslations("stats");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "none">("idle");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    setState("busy");
    try {
      const r = await getJSON<{ subject: Subject | null }>(`/ask/resolve?q=${encodeURIComponent(v)}`);
      const s = r.subject;
      if (!s) return setState("none");
      router.push(s.kind === "root" ? `/mindmap?root=${encodeURIComponent(s.key)}` : `/mindmap?word=${encodeURIComponent(s.slug)}`);
    } catch {
      setState("none");
    }
  }
  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={go} className="askq-box" role="search" aria-label={t("mindPickLabel")}>
        <Icon name="search" size={18} className="shrink-0 text-t3" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setState("idle"); }} placeholder={t("mindPickPlaceholder")} aria-label={t("mindPickLabel")} dir="auto" className="askq-input" maxLength={120} />
        <button type="submit" className="btn btn-primary" disabled={state === "busy"}>{t("mindPickGo")}</button>
      </form>
      {state === "none" && (
        <p className="text-[13px] text-t2" role="status">{t("mindPickNone", { q: q.trim() })}</p>
      )}
      <section className="flex flex-col gap-2" aria-labelledby="mind-roots">
        <h2 id="mind-roots" className="label-caps">{t("mindPickRoots")}</h2>
        <ul className="flex flex-wrap gap-2">
          {ROOTS.map((r) => (
            <li key={r}>
              <Link href={`/mindmap?root=${encodeURIComponent(r)}`} className="chip min-h-[40px]">
                <span className="ar-classical text-[18px] text-root" lang="ar">{spaced(r)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2" aria-labelledby="mind-words">
        <h2 id="mind-words" className="label-caps">{t("mindPickWords")}</h2>
        <ul className="flex flex-wrap gap-2">
          {WORDS.map(([slug, ar]) => (
            <li key={slug}>
              <Link href={`/mindmap?word=${slug}`} className="chip min-h-[40px]">
                <span className="ar-classical text-[18px] text-word" lang="ar">{ar}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-[12.5px] leading-relaxed text-t3">{t("mindPickReader")}</p>
    </div>
  );
}
