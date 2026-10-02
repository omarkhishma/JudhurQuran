import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/shell/SiteHeader";

/** The reader is a full-bleed working surface. It gets its bespoke header (design 03 §3.1) in P2;
 * until then it wears the shared one. */
export default async function ReaderLayout({ children, params }: LayoutProps<"/[locale]">) {
  setRequestLocale((await params).locale);
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex min-w-0 flex-1 flex-col">
        {children}
      </main>
    </>
  );
}
