import localFont from "next/font/local";
import { Amiri, IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";

// The official KFGQPC Hafs font is served byte-identical to the signed TTF (its license
// forbids modification or conversion). display: block avoids painting the Quranic text in a
// fallback font, where marks would render wrongly.
export const quranHafs = localFont({
  src: "../fonts/UthmanicHafs_V22.ttf",
  variable: "--font-quran-hafs",
  display: "block",
  preload: true,
  fallback: ["serif"],
});

export const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const fontVariables = [quranHafs, amiri, plexArabic, plexSans, plexMono].map((f) => f.variable).join(" ");
