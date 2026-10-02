import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/** /read is the reader's own route (design 01 §1.3). It becomes the full reader in P2; until then it
 * opens the Quran reader at the first sūra, in the visitor's language. */
export default async function ReadPage({ params }: PageProps<"/[locale]/read">) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect({ href: "/quran/1", locale });
}
