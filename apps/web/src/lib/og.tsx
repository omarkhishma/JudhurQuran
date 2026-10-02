import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };

// Design tokens (globals.css, light theme).
const PAPER = "#fffffe";
const INK = "#16161a";
const MUTED = "#686872";
const ROOT = "#945c27";
const LINE = "#e5e5ea";

const fonts = Promise.all([
  readFile(join(process.cwd(), "src/fonts/og/IBMPlexSansArabic-Medium.ttf")),
  readFile(join(process.cwd(), "src/fonts/og/IBMPlexSansArabic-Bold.ttf")),
]);

/** Quranic and vowel marks are dropped: the renderer misplaces them (src/fonts/og/README.md). */
export const bare = (s: string) => s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "").replace(/\u0671/g, "\u0627");

// Contextual forms [isolated, final, initial, medial] from Arabic Presentation Forms-B; two entries = joins only
// to the letter before it.
const FORMS: Record<string, number[]> = {
  "\u0621": [0xfe80], "\u0622": [0xfe81, 0xfe82], "\u0623": [0xfe83, 0xfe84], "\u0624": [0xfe85, 0xfe86],
  "\u0625": [0xfe87, 0xfe88], "\u0626": [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c], "\u0627": [0xfe8d, 0xfe8e],
  "\u0628": [0xfe8f, 0xfe90, 0xfe91, 0xfe92], "\u0629": [0xfe93, 0xfe94], "\u062a": [0xfe95, 0xfe96, 0xfe97, 0xfe98],
  "\u062b": [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c], "\u062c": [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0], "\u062d": [0xfea1, 0xfea2, 0xfea3, 0xfea4],
  "\u062e": [0xfea5, 0xfea6, 0xfea7, 0xfea8], "\u062f": [0xfea9, 0xfeaa], "\u0630": [0xfeab, 0xfeac], "\u0631": [0xfead, 0xfeae],
  "\u0632": [0xfeaf, 0xfeb0], "\u0633": [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4], "\u0634": [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8],
  "\u0635": [0xfeb9, 0xfeba, 0xfebb, 0xfebc], "\u0636": [0xfebd, 0xfebe, 0xfebf, 0xfec0], "\u0637": [0xfec1, 0xfec2, 0xfec3, 0xfec4],
  "\u0638": [0xfec5, 0xfec6, 0xfec7, 0xfec8], "\u0639": [0xfec9, 0xfeca, 0xfecb, 0xfecc], "\u063a": [0xfecd, 0xfece, 0xfecf, 0xfed0],
  "\u0641": [0xfed1, 0xfed2, 0xfed3, 0xfed4], "\u0642": [0xfed5, 0xfed6, 0xfed7, 0xfed8], "\u0643": [0xfed9, 0xfeda, 0xfedb, 0xfedc],
  "\u0644": [0xfedd, 0xfede, 0xfedf, 0xfee0], "\u0645": [0xfee1, 0xfee2, 0xfee3, 0xfee4], "\u0646": [0xfee5, 0xfee6, 0xfee7, 0xfee8],
  "\u0647": [0xfee9, 0xfeea, 0xfeeb, 0xfeec], "\u0648": [0xfeed, 0xfeee], "\u0649": [0xfeef, 0xfef0],
  "\u064a": [0xfef1, 0xfef2, 0xfef3, 0xfef4],
};
// لا ligatures [isolated, final] by the alef that follows the lam.
const LAM_ALEF: Record<string, number[]> = {
  "\u0622": [0xfef5, 0xfef6], "\u0623": [0xfef7, 0xfef8], "\u0625": [0xfef9, 0xfefa], "\u0627": [0xfefb, 0xfefc],
};

/**
 * Pre-shapes an unvocalised Arabic word into presentation forms. The renderer measures a word from its
 * unjoined letters but draws it joined, which leaves joined words off-centre; pre-shaped glyphs are
 * measured exactly as drawn.
 */
export function shape(word: string): string {
  const chars = [...word];
  const joinsForward = (c?: string) => !!c && (FORMS[c]?.length ?? 0) === 4;
  const joinable = (c?: string) => !!c && (FORMS[c]?.length ?? 0) >= 2;
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const forms = FORMS[c];
    if (!forms) {
      out += c;
      continue;
    }
    const prev = joinsForward(chars[i - 1]);
    if (c === "\u0644" && LAM_ALEF[chars[i + 1]]) {
      out += String.fromCodePoint(LAM_ALEF[chars[i + 1]][prev ? 1 : 0]);
      i++;
      continue;
    }
    const next = forms.length === 4 && joinable(chars[i + 1]);
    const form = prev && next ? 3 : prev ? 1 : next ? 2 : 0;
    out += String.fromCodePoint(forms[forms.length === 1 ? 0 : form]); // ء never joins
  }
  // Presentation forms are drawn left to right as given, so return the word in visual order; runs of
  // digits keep their own left-to-right order (٢٥٥).
  const runs = out.match(/[0-9\u0660-\u0669][0-9\u0660-\u0669\u066b\u066c.,]*|[^0-9\u0660-\u0669]+/g) ?? [];
  return runs
    .reverse()
    .map((r) => (/^[0-9\u0660-\u0669]/.test(r) ? r : [...r].reverse().join("")))
    .join("");
}

export type OgLine = { text: string; size: number; color?: string; bold?: boolean };

/**
 * One Arabic or English line. The renderer shapes Arabic letters but does not reorder right-to-left
 * runs, so Arabic is laid out word by word in a row-reverse box — every word keeps its shaping and the
 * line reads right to left whatever digits or punctuation it holds.
 */
function Line({ line, rtl }: { line: OgLine; rtl: boolean }) {
  const style = { display: "flex", fontSize: line.size, color: line.color ?? INK, fontWeight: line.bold ? 700 : 500 } as const;
  if (!rtl) return <div style={style}>{line.text}</div>;
  return (
    <div style={{ ...style, flexDirection: "row-reverse", gap: Math.round(line.size * 0.3) }}>
      {bare(line.text).split(/\s+/).filter(Boolean).map((w, i) => (
        <span key={i}>{shape(w)}</span>
      ))}
    </div>
  );
}

const isArabic = (s: string) => /[\u0600-\u06FF]/.test(s);

/** The shared share-card: brand mark, a title, up to three lines, and the tagline. */
export async function ogCard({
  locale,
  title,
  lines,
  footer,
}: {
  locale: string;
  title: OgLine;
  lines: OgLine[];
  /** Bottom line; defaults to the tagline. */
  footer?: string;
}) {
  const [medium, bold] = await fonts;
  const ar = locale === "ar";
  const brand = SITE.name[ar ? "ar" : "en"];
  const bottom = footer ?? SITE.tagline[ar ? "ar" : "en"];
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: PAPER,
          fontFamily: "Plex",
          padding: "56px 72px",
          borderBottom: `14px solid ${ROOT}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: ar ? "row-reverse" : "row", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: ROOT }} />
          <Line line={{ text: brand, size: 40, bold: true }} rtl={ar} />
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
          <Line line={title} rtl={isArabic(title.text)} />
          {lines.map((l, i) => (
            <Line key={i} line={l} rtl={isArabic(l.text)} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", borderTop: `2px solid ${LINE}`, paddingTop: 22 }}>
          <Line line={{ text: bottom, size: 30, color: MUTED }} rtl={isArabic(bottom)} />
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Plex", data: medium, style: "normal", weight: 500 },
        { name: "Plex", data: bold, style: "normal", weight: 700 },
      ],
    },
  );
}

export const OG_COLORS = { ROOT, MUTED, INK };
