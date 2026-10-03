"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useIsClient } from "@/lib/client";
import { noteOn, useSaved } from "@/lib/store/saved";

/** A personal note on a verse — clearly the reader's own words, kept on this device. */
export function VerseNote({ verseKey }: { verseKey: string }) {
  const t = useTranslations("saved");
  const client = useIsClient();
  const note = useSaved((s) => noteOn(s, verseKey));
  const setNote = useSaved((s) => s.setNote);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? (client ? (note?.text ?? "") : "");
  return (
    <section className="border-b border-line px-5 py-3">
      <label className="label-caps mb-1.5 block" htmlFor={`note-${verseKey}`}>
        {t("note")}
      </label>
      <textarea
        id={`note-${verseKey}`}
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) setNote(verseKey, draft);
          setDraft(null);
        }}
        placeholder={t("notePlaceholder")}
        rows={2}
        className="w-full resize-y rounded-lg border border-line bg-card-2 p-2 text-[14px] outline-none focus:border-ring"
      />
    </section>
  );
}
