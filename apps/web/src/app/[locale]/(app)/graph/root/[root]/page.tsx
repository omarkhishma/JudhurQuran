import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { api } from "@/lib/api";
import type { RootGraphPayload } from "@/lib/graph/build";
import { RootGraphView } from "@/components/graph/RootGraphView";
import { localized } from "@/lib/seo";

export const revalidate = 86400;

export async function generateMetadata({ params }: PageProps<"/[locale]/graph/root/[root]">): Promise<Metadata> {
  const { locale, root } = await params;
  const g = await api<RootGraphPayload>(`/roots/${encodeURIComponent(decodeURIComponent(root))}/graph`);
  const t = await getTranslations({ locale, namespace: "graph" });
  // The canvas repeats the root page's content in a form search engines cannot read: shareable, not indexed.
  return {
    title: t("rootTitle", { root: g.root.spaced }),
    description: t("rootLead"),
    alternates: localized(locale, `/graph/root/${encodeURIComponent(g.root.key)}`),
    robots: { index: false, follow: true },
  };
}

export default async function RootGraphPage({ params, searchParams }: PageProps<"/[locale]/graph/root/[root]">) {
  const { locale, root } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const focus = typeof sp.focus === "string" ? sp.focus : undefined;
  const g = await api<RootGraphPayload>(`/roots/${encodeURIComponent(decodeURIComponent(root))}/graph`);
  return <RootGraphView payload={g} focus={focus} />;
}
