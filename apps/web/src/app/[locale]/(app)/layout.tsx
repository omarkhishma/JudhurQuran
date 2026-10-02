import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/shell/SiteHeader";

/** Full-bleed working surfaces (the graph editor): the canvas fills the viewport under the header.
 * The editor gets its own bespoke header with its tools in P8; until then it wears the shared one. */
export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  setRequestLocale((await params).locale);
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex h-[calc(100dvh-52px)] min-h-0 min-w-0 flex-col">
        {children}
      </main>
    </>
  );
}
