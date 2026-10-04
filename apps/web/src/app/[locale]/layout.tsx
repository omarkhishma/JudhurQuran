import type { Metadata, Viewport } from "next";
import { pick, SCOPES } from "@/lib/i18nScopes";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";
import { OfflineWorker } from "@/components/shell/OfflineWorker";
import { SITE, THEME_KEY } from "@/lib/site";
// the digits preference's key (lib/digits.ts), read here before the page paints
const DIGITS_KEY = "jadhr-digits";
import { Providers } from "@/components/shell/Providers";
import "../globals.css";

// Nothing is prerendered at build time: pages render from the live API on first request and stay cached
// (ISR) until the next dataset release expires them. A code deploy therefore never needs the data stack.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    metadataBase: new URL(SITE.url),
    title: { default: `${t("siteName")} — ${t("tagline")}`, template: `%s • ${t("siteName")}` },
    description: t("tagline"),
    applicationName: t("siteName"),
    openGraph: { siteName: t("siteName"), locale: locale === "ar" ? "ar_AR" : "en_US", type: "website" },
    twitter: { card: "summary_large_image" },
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#15151a" },
  ],
};

// Runs before first paint: apply the stored theme (default light, per the design system); then follow it when
// another window of the site changes it — another tab, or the split view's page and its panes (P8.6). A published
// map's embed takes its theme from its address alone and keeps none (EDT-302, EDT-288): it lives on other sites.
const themeScript = `if(/^\\/(en\\/)?embed\\//.test(location.pathname)){var m=/[?&]theme=(dark|light)/.exec(location.search);document.documentElement.dataset.theme=m?m[1]:"light"}else{try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}else{document.documentElement.dataset.theme="light"}}catch(e){document.documentElement.dataset.theme="light"}addEventListener("storage",function(e){if(e.key===${JSON.stringify(THEME_KEY)}&&(e.newValue==="dark"||e.newValue==="light"))document.documentElement.dataset.theme=e.newValue})}try{var d=localStorage.getItem(${JSON.stringify(DIGITS_KEY)});if(d==="arabic"||d==="latin")document.documentElement.dataset.digits=d}catch(e){}addEventListener("storage",function(e){if(e.key===${JSON.stringify(DIGITS_KEY)}){if(e.newValue==="arabic"||e.newValue==="latin")document.documentElement.dataset.digits=e.newValue;else delete document.documentElement.dataset.digits}})`;

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations("common");
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} data-theme="light" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:shadow-open"
        >
          {t("skipToContent")}
        </a>
        {/* only what every page's browser needs; each route group adds its own (lib/i18nScopes) */}
        <NextIntlClientProvider locale={locale} messages={pick(messages, SCOPES.root)}>
          {/* Each route group wears its own header: the shared shell, or the reader's and editor's bespoke ones. */}
          <Providers>{children}</Providers>
          {/* offline reading of what this browser read and saved (P12) */}
          <OfflineWorker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
