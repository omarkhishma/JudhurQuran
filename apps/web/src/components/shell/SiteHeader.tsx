import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { NavLinks } from "./NavLinks";
import { MobileMenu } from "./MobileMenu";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitch } from "./LanguageSwitch";
import { SearchLauncher } from "@/components/search/SearchLauncher";
import { AccountButton } from "@/components/account/AccountButton";

export async function SiteHeader() {
  const t = await getTranslations("common");
  return (
    <header className="sticky top-0 z-40 print:hidden border-b border-line bg-panel/95 backdrop-blur supports-[backdrop-filter]:bg-panel/80">
      <div className="mx-auto flex h-[52px] max-w-[1400px] items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={t("home")}>
          <span className="block h-[18px] w-[18px] rounded-[5px] bg-root" aria-hidden="true" />
          <span className="ar-classical text-[19px] font-bold leading-none text-t1">{t("siteName")}</span>
        </Link>
        <NavLinks />
        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          <SearchLauncher />
          <Suspense fallback={<span className="btn">…</span>}>
            <LanguageSwitch />
          </Suspense>
          <ThemeToggle />
          <AccountButton />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
