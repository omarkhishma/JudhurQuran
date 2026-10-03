import { setRequestLocale } from "next-intl/server";
import { GraphEditor } from "@/components/graph/GraphEditor";

export const metadata = { robots: { index: false } };

export default async function GraphEditPage({ params, searchParams }: PageProps<"/[locale]/graph/edit/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const q = await searchParams;
  // the word the map was made from: a slug and a place, only in their own shapes
  const w = typeof q.w === "string" && /^[\p{L}\p{N}_.'-]{1,80}$/u.test(q.w) ? q.w : undefined;
  const at = typeof q.at === "string" && /^\d{1,3}:\d{1,3}:\d{1,3}$/.test(q.at) ? q.at : undefined;
  return <GraphEditor id={id} from={{ w, at }} />;
}
