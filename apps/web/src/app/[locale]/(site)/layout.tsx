import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { pick, SCOPES } from "@/lib/i18nScopes";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";

/** Pages that wear the shared shell (design 01 §1.4): header with the nav strip, page body, footer. */
export default async function SiteLayout({ children, params }: LayoutProps<"/[locale]">) {
  // Without this the footer's translations read request headers and every content page renders dynamically.
  const { locale } = await params;
  setRequestLocale(locale);
  // the copy this group's browser components use, and no more (lib/i18nScopes)
  return (
    <NextIntlClientProvider locale={locale} messages={pick(await getMessages(), SCOPES.site)}>
      <SiteHeader />
      <main id="main" className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1">{children}</div>
      </main>
      <SiteFooter />
    </NextIntlClientProvider>
  );
}
