import { setRequestLocale } from "next-intl/server";
import { SharedGraph } from "@/components/graph/SharedGraph";

export const metadata = { robots: { index: false } };

export default async function SharedGraphPage({ params }: PageProps<"/[locale]/graph/view">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SharedGraph />;
}
