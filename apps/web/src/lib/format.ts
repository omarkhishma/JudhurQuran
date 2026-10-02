/** Numbers in the UI language: Arabic-Indic digits in Arabic, Latin digits in English. */
export function formatNumber(n: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(n);
}

export function toArabicDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

export function verseRef(key: string, locale: string): string {
  return locale === "ar" ? toArabicDigits(key) : key;
}

/** ICU plural params with the number pre-formatted for the UI language ({count} picks the form, {n} is shown). */
export function cnt(count: number, locale: string): { count: number; n: string } {
  return { count, n: formatNumber(count, locale) };
}

/** Standard citation: «البقرة: ٢٥٥» in Arabic, “al-Baqarah 2:255” in English. */
export function citeVerse(surahNameAr: string, surah: number, ayah: number, locale: string, surahNameEn?: string): string {
  return locale === "ar" ? `${surahNameAr}: ${formatNumber(ayah, locale)}` : `${surahNameEn ?? surahNameAr} ${surah}:${ayah}`;
}
