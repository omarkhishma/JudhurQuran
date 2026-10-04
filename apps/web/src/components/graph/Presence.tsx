"use client";

import { useLocale, useTranslations } from "next-intl";
import { cnt, formatNumber } from "@/lib/format";
import type { Presence } from "@/lib/graph/presence";

// each person's circle in a card colour, the reader's own first (EDT-296)
const TINTS = ["var(--c-root)", "var(--c-form)", "var(--c-word)", "var(--c-sentence)", "var(--c-desc)"];

/** Who is on a shared map now (P8.6; EDT-014, EDT-296, EDT-297): «مباشر» with its dot, then a circle for each
 * person — the reader first, the signed-in by their name's first letter with their name on it — and one for the
 * others, counted. The group names everyone for a screen reader. */
export function PresenceBlock({ presence }: { presence: Presence }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const named = (p: Presence["people"][number]) => (p.you ? t("presenceYou") : p.name || t("presenceUnnamed")) + (p.editing ? ` (${t("presenceEditing")})` : "");
  const all = [...presence.people.map(named), ...(presence.guests ? [t("presenceGuests", cnt(presence.guests, locale))] : [])];
  return (
    <span className="presence shrink-0" role="group" aria-label={t("presenceLabel", { names: all.join(locale === "ar" ? "، " : ", ") })}>
      <span className="presence-live" aria-hidden="true">
        <span className="dot" style={{ background: "var(--good)" }} />
        {t("live")}
      </span>
      <span className="presence-stack" aria-hidden="true">
        {presence.people.map((p, i) => (
          <span key={i} className="presence-avatar" style={{ "--tint": TINTS[i % TINTS.length] } as React.CSSProperties} title={named(p)}>
            {(p.you ? p.name || t("presenceYou") : p.name || "؟").trim().charAt(0)}
          </span>
        ))}
        {presence.guests > 0 && (
          <span className="presence-avatar is-guests" title={t("presenceGuests", cnt(presence.guests, locale))}>
            +{formatNumber(presence.guests, locale)}
          </span>
        )}
      </span>
    </span>
  );
}
