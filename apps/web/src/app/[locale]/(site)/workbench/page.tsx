import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Workbench, type Place } from "@/components/workbench/Workbench";
import { KINDS, LAYERS, STATES, type Kind, type Layer, type State } from "@/lib/editorialShape";

// the board's work is read in the browser, fresh, behind its sign-in; the place comes from the address
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/workbench">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "workbench" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/workbench">) {
  setRequestLocale((await params).locale);
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const kind: Kind = one("kind") === "verdict" || (KINDS as string[]).includes(one("kind")) ? (one("kind") as Kind) : "root_gloss";
  const layer = (LAYERS as readonly string[]).includes(one("layer")) ? (one("layer") as Layer) : undefined;
  const state = (STATES as string[]).includes(one("state")) ? (one("state") as State) : "all";
  const initial: Place = { kind, layer, state, q: one("q").slice(0, 80), target: one("target").slice(0, 200) || undefined };
  return <Workbench initial={initial} />;
}
