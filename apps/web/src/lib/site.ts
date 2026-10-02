/** Product identity in one place. The public name is an owner decision (working title). */
export const SITE = {
  name: { ar: "جُذور", en: "Judhur" },
  tagline: {
    ar: "اقرأ القرآن الكريم من جذور كلماته",
    en: "Read the Quran through the roots of its words",
  },
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3210",
} as const;

export const THEME_KEY = "judhur-theme";
