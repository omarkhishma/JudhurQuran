/** Numbers in the UI language: Arabic-Indic digits in Arabic, Latin digits in English. */
export function formatNumber(n: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(n);
}

/** A number typed in Arabic-Indic, Persian or Latin digits, with an Arabic or Latin decimal point; NaN when it is
 * not one. */
export function readNumber(v: string): number {
  const latin = v
    .replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) & 0xf))
    .replace(/\u066b/g, ".")
    .replace(/[\u066c,\s]/g, "")
    .replace(/\u2212/g, "-");
  return latin === "" ? NaN : Number(latin);
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

/** A second count in the same message ({count2} picks the form, {n2} is shown). */
export function cnt2(count: number, locale: string): { count2: number; n2: string } {
  return { count2: count, n2: formatNumber(count, locale) };
}

/** Standard citation: «البقرة: ٢٥٥» in Arabic, “al-Baqarah 2:255” in English. */
export function citeVerse(surahNameAr: string, surah: number, ayah: number, locale: string, surahNameEn?: string): string {
  return locale === "ar" ? `${surahNameAr}: ${formatNumber(ayah, locale)}` : `${surahNameEn ?? surahNameAr} ${surah}:${ayah}`;
}
