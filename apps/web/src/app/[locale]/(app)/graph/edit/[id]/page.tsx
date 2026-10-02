import { setRequestLocale } from "next-intl/server";
import { GraphEditor } from "@/components/graph/GraphEditor";

export const metadata = { robots: { index: false } };

export default async function GraphEditPage({ params }: PageProps<"/[locale]/graph/edit/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <GraphEditor id={id} />;
}
