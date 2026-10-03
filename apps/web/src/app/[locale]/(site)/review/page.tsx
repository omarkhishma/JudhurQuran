import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReviewQueue } from "@/components/contrib/ReviewQueue";

// the filter and the proposal come from the URL; the queue itself is read in the browser, fresh
export const dynamic = "force-dynamic";

const FILTERS = ["open", "mine", "approved", "changes", "merged", "declined"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/review">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("review.title"), robots: { index: false } };
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/review">) {
  setRequestLocale((await params).locale);
  const sp = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(String(sp.filter)) ? (sp.filter as (typeof FILTERS)[number]) : "open";
  const id = typeof sp.id === "string" && /^[0-9a-f-]{36}$/.test(sp.id) ? sp.id : null;
  return <ReviewQueue initialFilter={filter} initialId={id} />;
}
