import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { pick, SCOPES } from "@/lib/i18nScopes";
import { SyncPrompt } from "@/components/account/SyncPrompt";

/** Full-bleed working surfaces: the graph pages, under the site's header (`(chrome)`), and the graph editor, which
 * has its own header with its tools (`(editor)`, P8.1-A). */
export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <NextIntlClientProvider locale={locale} messages={pick(await getMessages(), SCOPES.app)}>
      {children}
      {/* what sync will not decide alone, asked wherever the reader is (F8, F11) */}
      <SyncPrompt />
    </NextIntlClientProvider>
  );
}
