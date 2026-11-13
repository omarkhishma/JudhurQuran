"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/Icon";
import { chooseTheme, useTheme } from "@/lib/client";
import { THEME_KEY } from "@/lib/site";

export function ThemeToggle() {
  const t = useTranslations("common");
  const theme = useTheme();

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    chooseTheme(THEME_KEY, next);
  }

  const label = theme === "dark" ? t("themeLight") : t("themeDark");
  return (
    <button type="button" className="btn icon-btn" onClick={toggle} aria-label={label} title={label}>
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}
