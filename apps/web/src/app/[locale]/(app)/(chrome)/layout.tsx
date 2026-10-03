import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/shell/SiteHeader";

/** The graph pages that wear the site's header: My maps, a root's map, a shared map, the hand-off, the split view.
 * The locale is set here too: without it the header's copy reads the request, and a prerendered page fails. */
export default async function ChromeLayout({ children, params }: LayoutProps<"/[locale]">) {
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
