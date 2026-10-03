"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { formatNumber } from "@/lib/format";
import { usePersonal } from "@/lib/reader/store";

export type SurahName = [number, string, string];

/**
 * "Pick up where you left off" (06 §6.1, SHL-22…27, HUB-46, Q04): the place reached in the Quran (sūra
 * and verse, from the reading position) or the verse last opened, the last word and the last root, each a
 * link back. Hidden when there is nothing to resume. Clear forgets the place shown here, not the reading:
 * positions, sessions and furthest verses stay, and the next lookup brings the strip back.
 */
export function ContextStrip({ surahs }: { surahs: SurahName[] }) {
  const t = useTranslations("hub");
  const locale = useLocale();
  const client = useIsClient();
  const progress = usePersonal((s) => s.progress.quran);
  const context = usePersonal((s) => s.context);
  const clearedAt = usePersonal((s) => s.contextClearedAt);
  const clear = usePersonal((s) => s.clearContext);
  if (!client) return null;

  const name = (n: number) => {
    const s = surahs.find((x) => x[0] === n);
    return s ? (locale === "ar" ? s[1] : s[2]) : String(n);
  };
  const chips: { key: string; href: string; label: string; ar: boolean; color: string }[] = [];
  if (progress && progress.at > clearedAt && progress.chapter >= 1 && progress.chapter <= 114) {
    chips.push({
      key: "text",
      href: `/quran/${progress.chapter}${progress.passage > 1 ? `#v${progress.passage}` : ""}`,
      label: t("resumeSurah", { name: name(progress.chapter), ayah: formatNumber(progress.passage, locale) }),
      ar: locale === "ar",
      color: "var(--c-sentence)",
    });
  } else if (context?.verse) {
    const [s, a] = context.verse.split(":").map(Number);
    if (s >= 1 && s <= 114 && a >= 1) chips.push({ key: "text", href: `/quran/${s}/${a}`, label: t("resumeVerse", { name: name(s), ayah: formatNumber(a, locale) }), ar: locale === "ar", color: "var(--c-sentence)" });
  }
  if (context?.word && context.wordAr) chips.push({ key: "word", href: `/read?w=${encodeURIComponent(context.word)}`, label: context.wordAr, ar: true, color: "var(--c-word)" });
  if (context?.root) chips.push({ key: "root", href: `/concordance?root=${encodeURIComponent(context.root)}`, label: context.root.split("").join(" "), ar: true, color: "var(--c-root)" });
  if (!chips.length) return null;

  return (
    <section className="hub-context" aria-label={t("resume")}>
      <div className="hub-context-row">
        <div className="hub-context-scroll">
          <span className="hub-context-label">{t("resume")}</span>
          <ul className="hub-context-chips">
            {chips.map((c) => (
              <li key={c.key}>
                <Link href={c.href} className="hub-chip" data-kind={c.key}>
                  <span className="dot" style={{ background: c.color }} aria-hidden="true" />
                  {c.key !== "text" && <span className="text-[11.5px] text-t3">{t(c.key === "word" ? "resumeWord" : "resumeRoot")}</span>}
                  <span className={c.key === "text" ? "" : "ar-classical text-[16px]"} lang={c.ar ? "ar" : undefined} dir="auto">
                    {c.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {/* outside the scroller: on a phone the chips scroll, Clear stays in reach */}
        <button type="button" className="hub-context-clear" onClick={clear} title={t("clearLabel")}>
          {t("clear")}
        </button>
      </div>
    </section>
  );
}
