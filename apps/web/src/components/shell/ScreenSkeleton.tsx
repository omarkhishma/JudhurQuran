import { getTranslations } from "next-intl/server";

type Screen = "explore" | "library" | "concordance" | "analyse" | "notebook" | "review" | "classroom" | "me" | "data" | "split" | "published";

/**
 * The designed frame of a screen whose body is built in a later phase of the plan (P1.6): its title,
 * its one-line purpose, and an honest note — never fake content.
 */
export async function ScreenSkeleton({ screen, phase }: { screen: Screen; phase: string }) {
  const t = await getTranslations("screens");
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-t1">{t(`${screen}.title`)}</h1>
      <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-t2">{t(`${screen}.lead`)}</p>
      <div className="card mt-8 flex items-center gap-3 p-4 text-[13.5px] text-t2" role="status">
        <span className="dot" style={{ background: "var(--amber)" }} aria-hidden="true" />
        <span>{t("building")}</span>
        <span className="ms-auto text-t3">
          {t("plan")} <span className="mono" dir="ltr">{phase}</span>
        </span>
      </div>
    </div>
  );
}
