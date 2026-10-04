import { getTranslations, setRequestLocale } from "next-intl/server";

/** A published map framed by another page (P8.5, EDT-284): the map alone, filling the frame — no header, no footer. */
export default async function EmbedLayout({ children, params }: LayoutProps<"/[locale]">) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("graph");
  // named, so the page that frames it keeps one unnamed main landmark of its own
  return (
    <main id="main" aria-label={t("publishedEmbedTitle")} className="flex h-dvh min-h-0 min-w-0 flex-col">
      {children}
    </main>
  );
}
