import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import ar from "../messages/ar.json";

/**
 * A counted noun agrees with its number (audit 27 F04): «١٠٣ مواضع» not «١٠٣ موضعًا», «٨ صيغ» not «٨ صيغة». The
 * messages that carry a varying number go through the plural rules; a scan keeps new ones from slipping past them.
 */
const t = createTranslator({ locale: "ar", messages: ar });

describe("counted nouns", () => {
  it("agree with the number in every class of the plural rules", () => {
    expect(t("roots.statOccurrences", { count: 103 })).toBe("مواضع");
    expect(t("roots.statOccurrences", { count: 15 })).toBe("موضعًا");
    expect(t("roots.statOccurrences", { count: 200 })).toBe("موضع");
    expect(t("roots.statLemmas", { count: 8 })).toBe("صيغ");
    expect(t("roots.rootMetaTitle", { root: "ص ب ر", n: "١٠٣", nC: 103 })).toBe("جذر «ص ب ر» في القرآن — ١٠٣ مواضع");
    expect(t("stats.countIn", { n: "١", nC: 1 })).toBe("مرة واحدة");
    expect(t("stats.countIn", { n: "٢", nC: 2 })).toBe("مرتين");
    expect(t("stats.countIn", { n: "٧", nC: 7 })).toBe("٧ مرات");
    expect(t("stats.countIn", { n: "٤٥", nC: 45 })).toBe("٤٥ مرة");
    expect(t("stats.netNode", { count: "٣", countC: 3, verses: "٧", versesC: 7 })).toBe("٣ مرات في ٧ آيات");
    expect(t("library.surahCell", { name: "الفاتحة", read: "٢", of: "٧", ofC: 7 })).toBe("سورة الفاتحة: قرأت ٢ من ٧ آيات");
    expect(t("search.rootMeta", { occ: 103, occN: "١٠٣", lem: 8, lemN: "٨" })).toBe("١٠٣ مواضع • ٨ صيغ");
  });

  it("are never written beside a varying number outside the plural rules", () => {
    const nouns = "موضعًا|مواضع|كلمة|كلمات|آية|آيات|مرة|مرات|صيغة|صيغ|سورة|سور|جذرًا|جذور|مقطعًا|مقاطع";
    // these carry numbers that do not vary and agree as written: 1,642 roots, 114 sūras and 6,236 verses, the corpus's
    // 77,429 words, 45 texts, the words and lemmas counted, a sampled preview, a mean, the top-n charts' sizes
    const fixed = new Set([
      "roots.indexLead",
      "rd.textsSummary",
      "library.quranMeta",
      "library.previewFirst",
      "workbench.dashOfWords",
      "workbench.dashOfSurahs",
      "workbench.ctxPreviewFirst",
      "stats.versesSub",
      "stats.facts",
      "stats.freqCaption",
      "stats.heatTitle",
      "stats.rankCaption",
      "stats.method",
      "stats.netTitle",
      "stats.colCaption",
      "roots.occ",
      "books.why_backs",
      "books.why_turath",
      "roots.variantNone", // {source} is a source's name, not a number: «لا يرى لها {source} جذرًا»
    ]);
    const stripPlurals = (s: string) => {
      let out = "";
      for (let i = 0; i < s.length; i++) {
        if (/^\{\w+, (plural|select|selectordinal),/.test(s.slice(i))) {
          let depth = 0;
          for (; i < s.length; i++) {
            if (s[i] === "{") depth++;
            else if (s[i] === "}" && --depth === 0) break;
          }
          out += "§";
        } else out += s[i];
      }
      return out;
    };
    const found: string[] = [];
    const walk = (o: unknown, path: string[]) => {
      if (typeof o === "string") {
        if (new RegExp(`\\{\\w+\\}\\s*(${nouns})(?![\\u0621-\\u064A])`).test(stripPlurals(o)) && !fixed.has(path.join("."))) found.push(path.join("."));
      } else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, [...path, k]);
    };
    walk(ar, []);
    expect(found).toEqual([]);
  });
});
