"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useLocalStorage } from "@/lib/client";
import { PROGRESS_KEY, type Progress } from "@/lib/personal";

export function ContinueReading() {
  const t = useTranslations("home");
  const raw = useLocalStorage(PROGRESS_KEY);
  let p: Progress | null = null;
  try {
    p = raw ? (JSON.parse(raw) as Progress) : null;
  } catch {
    p = null;
  }
  if (!p) return null;
  return (
    <Link href={`/quran/${p.surah}#v${p.ayah}`} className="mt-5 inline-flex items-center gap-2 text-[13.5px] text-word hover:underline">
      {t("continueReading")} — <span className="mono" dir="ltr">{`${p.surah}:${p.ayah}`}</span>
    </Link>
  );
}
