"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { dictHref } from "@/lib/dictionary";

/** Find a root as it is typed — علم, ع ل م, ʿ-l-m, or as a lexicon prints it (سما, رد) — and go to its page. */
export function FindRoot() {
  const t = useTranslations("dictionary");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (e: FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (!text) return;
    setBusy(true);
    setSaid("");
    try {
      const r = await fetch(`/api/v1/dictionary/roots/${encodeURIComponent(text)}`);
      if (r.ok) router.push(dictHref(((await r.json()) as { key: string }).key));
      else setSaid(t(r.status === 404 ? "notFound" : "failed"));
    } catch {
      setSaid(t("failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={go} className="flex flex-wrap items-center gap-2" role="search">
      <label className="flex min-w-[min(100%,280px)] flex-1 flex-col gap-1 text-[12.5px] text-t3">
        {t("findLabel")}
        <input value={q} onChange={(e) => setQ(e.target.value)} dir="auto" placeholder={t("findPlaceholder")} className="field ar-classical h-11 text-[18px]" />
      </label>
      <button type="submit" className="btn btn-primary self-end" disabled={busy}>
        {t("findGo")}
      </button>
      <p role="status" className="w-full text-[12.5px] text-t2">
        {said}
      </p>
    </form>
  );
}
