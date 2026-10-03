import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { pick, SCOPES } from "@/lib/i18nScopes";

/** The reader is a full-bleed working surface with its own bespoke header (design 03 §3.2). */
export default async function ReaderLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <NextIntlClientProvider locale={locale} messages={pick(await getMessages(), SCOPES.reader)}>
      <main id="main" className="flex min-w-0 flex-1 flex-col">
        {children}
      </main>
    </NextIntlClientProvider>
  );
}
