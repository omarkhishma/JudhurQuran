import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("nav");
  const tf = await getTranslations("footer");
  const locale = await getLocale();
  return (
    <footer className="mt-16 border-t border-line bg-panel">
      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-8 text-[13px] text-t2 md:grid-cols-[1fr_auto]">
        <div className="max-w-[70ch] space-y-2">
          <p>{tf("attribution")}</p>
          <p className="text-t3">{tf("integrity")}</p>
        </div>
        <nav aria-label={tf("label")} className="flex flex-wrap content-start gap-x-4 gap-y-2">
          <Link href="/about" className="hover:text-t1">{t("about")}</Link>
          <Link href="/sources" className="hover:text-t1">{t("sources")}</Link>
          <Link href="/developers" className="hover:text-t1">{t("developers")}</Link>
          <Link href="/privacy" className="hover:text-t1">{t("privacy")}</Link>
        </nav>
      </div>
      <div className="border-t border-line py-3 text-center text-[12px] text-t3" lang={locale}>
        {tf("noAds")}
      </div>
    </footer>
  );
}
