import { setRequestLocale } from "next-intl/server";
import { SharedMapView } from "@/components/graph/SharedMapView";

// a shared map is for those its owner sends the link to: never indexed
export const metadata = { robots: { index: false } };

export default async function SharedMapPage({ params }: PageProps<"/[locale]/graph/shared/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <SharedMapView id={id} />;
}
