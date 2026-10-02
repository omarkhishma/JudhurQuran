/** Product identity in one place: the name the design handoff uses (decision D1). */
export const SITE = {
  name: { ar: "جذر", en: "Jadhr" },
  tagline: {
    ar: "اقرأ القرآن الكريم من جذور كلماته",
    en: "Read the Quran through the roots of its words",
  },
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3210",
} as const;

export const THEME_KEY = "jadhr-theme";
