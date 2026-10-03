import { setRequestLocale } from "next-intl/server";
import { SeedImport } from "@/components/graph/SeedImport";

export const metadata = { robots: { index: false } };

// The seed is in the query string: rendered per request.
export const dynamic = "force-dynamic";

/** The editor's door for the reader's hand-off (RDR-369): `?s=` a base64url seed, `?into=` an existing graph. */
export default async function GraphSeedPage({ params, searchParams }: PageProps<"/[locale]/graph/seed">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  return <SeedImport encoded={typeof sp.s === "string" ? sp.s : ""} into={typeof sp.into === "string" ? sp.into : null} />;
}
