import { setRequestLocale } from "next-intl/server";
import { SiteFooter } from "@/components/shell/SiteFooter";

/** Content pages: page body + footer with attribution. The reader and the map are full-bleed and skip this. */
export default async function SiteLayout({ children, params }: LayoutProps<"/[locale]">) {
  // Without this the footer's translations read request headers and every content page renders dynamically.
  setRequestLocale((await params).locale);
  return (
    <>
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </>
  );
}
