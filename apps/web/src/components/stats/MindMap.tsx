"use client";

import { useLocale, useTranslations } from "next-intl";
import { Figure, Key } from "@/components/charts/Figure";
import { type MindNode, RadialTree } from "@/components/charts/RadialTree";
import { encodeSeed } from "@/lib/graph/seedCodec";
import { formatNumber } from "@/lib/format";
import { Link } from "@/i18n/navigation";

type Family = { pattern: { slug: string; ar: { full: string } } | null; members: { slug: string; ar: { full: string }; occurrences: number }[] }[];
type Linked = { slug: string; word: { ar: string; occurrences: number } };
export type MindData =
  | {
      kind: "word";
      word: { slug: string; ar: string; count: number };
      root: { key: string; spaced: string; count: number } | null;
      pattern: { slug: string; ar: string } | null;
      family: Family;
      defined: Record<"near" | "related" | "opposite", Linked[]>;
      topics: { id: string; name: string; word_verses: number }[];
    }
  | { kind: "root"; root: { key: string; spaced: string; count: number }; family: Family };

const C = { root: "var(--c-root)", form: "var(--c-form)", word: "var(--c-word)", verse: "var(--c-sentence)", desc: "var(--c-desc)" };

/**
 * A mind map (P16.4, PV-17): a word at the centre with its root and its root's words, its pattern, the near, related
 * and opposite words the administration set, and the topics it recurs in; or a root with its patterns and their words.
 * Every node leads where it names; the same data is the map editor's in one press (the root's map).
 */
export function MindMap({ data }: { data: MindData }) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const n = (x: number) => formatNumber(x, locale);
  const familyNodes = (f: Family, keep: number): MindNode[] =>
    f
      .filter((g) => g.members.length)
      .slice(0, 8)
      .map((g, i) => ({
        id: `p${i}-${g.pattern?.slug ?? "none"}`,
        label: g.pattern?.ar.full ?? t("mindNoPattern"),
        kind: "branch",
        color: C.form,
        children: g.members.slice(0, keep).map((m) => ({ id: `w-${m.slug}`, label: `${m.ar.full} (${n(m.occurrences)})`, kind: "leaf", color: C.word, href: `/quran/1?w=${encodeURIComponent(m.slug)}` })),
      }));
  let root: MindNode;
  if (data.kind === "root") {
    root = { id: "c", label: data.root.spaced, kind: "center", color: C.root, href: `/roots/${encodeURIComponent(data.root.key)}`, children: familyNodes(data.family, 6) };
  } else {
    const rel = (k: "near" | "related" | "opposite"): MindNode | null =>
      data.defined[k].length
        ? { id: `r-${k}`, label: t(`mindRel_${k}`), kind: "branch", color: C.desc, children: data.defined[k].map((x) => ({ id: `${k}-${x.slug}`, label: x.word.ar, kind: "leaf", color: C.word, href: `/quran/1?w=${encodeURIComponent(x.slug)}` })) }
        : null;
    const branches: (MindNode | null)[] = [
      data.root
        ? {
            id: "root",
            label: data.root.spaced,
            kind: "branch",
            color: C.root,
            href: `/roots/${encodeURIComponent(data.root.key)}`,
            children: data.family.flatMap((g) => g.members).filter((m) => m.slug !== data.word.slug).sort((a, b) => b.occurrences - a.occurrences).slice(0, 10).map((m) => ({ id: `fam-${m.slug}`, label: m.ar.full, kind: "leaf" as const, color: C.word, href: `/quran/1?w=${encodeURIComponent(m.slug)}` })),
          }
        : null,
      data.pattern ? { id: "pattern", label: data.pattern.ar, kind: "branch", color: C.form } : null,
      rel("near"),
      rel("related"),
      rel("opposite"),
      data.topics.length
        ? { id: "topics", label: t("mindTopics"), kind: "branch", color: C.verse, children: data.topics.slice(0, 6).map((x) => ({ id: `t-${x.id}`, label: x.name, kind: "leaf", color: C.verse, href: `/graph/seed?s=${encodeSeed({ seed: "topic", topic: x.id })}` })) }
        : null,
    ];
    root = { id: "c", label: data.word.ar, kind: "center", color: C.word, href: `/quran/1?w=${encodeURIComponent(data.word.slug)}`, children: branches.filter((b): b is MindNode => !!b) };
  }
  const title = data.kind === "word" ? t("mindOfWord", { word: data.word.ar }) : t("mindOfRoot", { root: data.root.spaced });
  const rows: [string, string][] = [];
  const walk = (m: MindNode, path: string[]) => {
    for (const c of m.children ?? []) {
      rows.push([path.concat(m.label).join(" ← "), c.label]);
      walk(c, path.concat(m.label));
    }
  };
  walk(root, []);
  return (
    <Figure
      id="mind"
      title={title}
      caption={data.kind === "word" ? t("mindWordCaption", { count: n(data.word.count) }) : t("mindRootCaption", { count: n(data.root.count) })}
      legend={
        <>
          <Key shape="dot" color={C.root} label={t("mindKeyRoot")} />
          <Key shape="dot" color={C.form} label={t("mindKeyPattern")} />
          <Key shape="dot" color={C.word} label={t("mindKeyWord")} />
          <Key shape="dot" color={C.verse} label={t("mindKeyTopic")} />
          <Key shape="dot" color={C.desc} label={t("mindKeyRelation")} />
        </>
      }
      table={
        <table>
          <tbody>
            {rows.map(([a, b], i) => (
              <tr key={i}>
                <td>{a}</td>
                <td>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <RadialTree root={root} label={title} />
      {data.root && (
        <Link href={`/graph/root/${encodeURIComponent(data.root.key)}`} className="btn mt-3 self-start">
          {t("mindOpenMap")}
        </Link>
      )}
    </Figure>
  );
}
