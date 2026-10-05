"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { useNotebook } from "@/lib/store/notebook";

/**
 * The reader's notes that mention this root, word, verse, hadith or book paragraph (NTB-31: backlinks; B58), on its
 * page, linked to each note. Read from this browser; nothing is asked of the server. Nothing is shown when no note
 * mentions it.
 */
export function Backlinks({ root, slug, verse, uri, className = "" }: { root?: string | null; slug?: string | null; verse?: string | null; uri?: string | null; className?: string }) {
  const t = useTranslations("notebook");
  const client = useIsClient();
  const notes = useNotebook((s) => s.notes);
  if (!client) return null;
  const hits = notes
    .filter((n) => (root && n.links.roots.includes(root)) || (slug && n.links.words?.includes(slug)) || (verse && n.links.verses.includes(verse)) || (uri && n.links.passages?.includes(uri)))
    .sort((a, b) => b.updated - a.updated);
  if (!hits.length) return null;
  return (
    <section className={"backlinks " + className} aria-label={t("backlinks")}>
      <p className="label-caps">{t("backlinks")}</p>
      <ul className="flex flex-col gap-1">
        {hits.map((n) => (
          <li key={n.id}>
            <Link href={`/notebook#note=${n.id}`} prefetch={false} className="backlink" dir="auto">
              <span className="truncate font-medium">{n.title || n.body.split("\n")[0].slice(0, 80) || t("untitled")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
