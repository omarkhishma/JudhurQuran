import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { pick, SCOPES } from "@/lib/i18nScopes";
import { SiteHeader } from "@/components/shell/SiteHeader";

/** Full-bleed working surfaces (the graph editor): the canvas fills the viewport under the header.
 * The editor gets its own bespoke header with its tools in P8; until then it wears the shared one. */
export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <NextIntlClientProvider locale={locale} messages={pick(await getMessages(), SCOPES.app)}>
      <SiteHeader />
      <main id="main" className="flex h-[calc(100dvh-52px)] min-h-0 min-w-0 flex-col">
        {children}
      </main>
    </NextIntlClientProvider>
  );
}
