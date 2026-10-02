import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="mx-auto flex max-w-[640px] flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="ar-classical mb-4 text-[44px] text-root" lang="ar" aria-hidden="true">
        ب ح ث
      </p>
      <h1 className="text-[24px] font-semibold">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-t2">{t("notFoundBody")}</p>
      <Link href="/" className="btn mt-6 min-h-[40px] px-5">
        {t("home")}
      </Link>
    </div>
  );
}
