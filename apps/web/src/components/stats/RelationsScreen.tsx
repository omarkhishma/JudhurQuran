"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { BarList } from "@/components/charts/BarList";
import { Figure, RampKey } from "@/components/charts/Figure";
import { Matrix } from "@/components/charts/Matrix";
import { Network } from "@/components/charts/Network";
import { Link, useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import type { Collocations, NetworkData, Similarity } from "@/lib/stats";

/**
 * Patterns and relations (P16, PV-14): the most frequent roots joined to those they share verses with most (a
 * statistic of co-occurrence, named as one — never a claim that the meanings are related); the sūras ordered so that
 * those alike in vocabulary stand together; and any root's companions in its verses, with PMI and log-likelihood.
 */
export function RelationsScreen({ network, similarity, colloc }: { network: NetworkData; similarity: Similarity; colloc: Collocations }) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const ar = locale === "ar";
  const router = useRouter();
  const n = (x: number) => formatNumber(x, locale);
  const [root, setRoot] = useState(colloc.root.key);
  const [typed, setTyped] = useState(colloc.root.spaced);
  const c = useQuery({
    queryKey: ["stats-colloc", root],
    queryFn: () => getJSON<Collocations>(`/stats/collocations?root=${encodeURIComponent(root)}&limit=20`),
    initialData: root === colloc.root.key ? colloc : undefined,
    placeholderData: (prev) => prev,
    retry: false,
    staleTime: Infinity,
  });
  const labels = similarity.surahs.map((s) => `${n(s.surah)}. ${ar ? s.name_ar : s.name_translit}`);
  // the closest pairs: the matrix's table, since its 12,996 cells are too many to list
  const pairs: { a: number; b: number; v: number }[] = [];
  for (let i = 0; i < similarity.order.length; i++) for (let j = i + 1; j < similarity.order.length; j++) pairs.push({ a: i, b: j, v: similarity.matrix[i][j] });
  pairs.sort((x, y) => y.v - x.v);
  return (
    <div className="flex flex-col gap-5">
      <Figure
        id="net"
        title={t("netTitle", { n: n(network.nodes.length) })}
        caption={t("netCaption")}
        table={
          <table>
            <thead>
              <tr>
                <th scope="col">{t("rootA")}</th>
                <th scope="col">{t("rootB")}</th>
                <th scope="col" className="num">{t("shared")}</th>
                <th scope="col" className="num">PMI</th>
                <th scope="col" className="num">G²</th>
              </tr>
            </thead>
            <tbody>
              {[...network.edges].sort((x, y) => y.g2 - x.g2).map((e) => (
                <tr key={`${e.a}-${e.b}`}>
                  <td lang="ar">{network.nodes.find((x) => x.key === e.a)?.spaced}</td>
                  <td lang="ar">{network.nodes.find((x) => x.key === e.b)?.spaced}</td>
                  <td className="num">{n(e.verses)}</td>
                  <td className="num">{n(e.pmi)}</td>
                  <td className="num">{n(e.g2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <Network
          label={t("netTitle", { n: n(network.nodes.length) })}
          nodes={network.nodes.map((r) => ({ id: r.key, label: r.spaced, size: r.count, href: `/roots/${encodeURIComponent(r.key)}`, sub: t("netNode", { count: n(r.count), verses: n(r.verses) }) }))}
          edges={network.edges.map((e) => ({ a: e.a, b: e.b, weight: e.g2 }))}
        />
      </Figure>

      <div className="stats-grid is-two">
        <Figure
          id="sim"
          title={t("simTitle")}
          caption={t("simCaption")}
          legend={<RampKey hue="var(--chart-medinan)" low={t("lessAlike")} high={t("moreAlike")} />}
          table={
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("surahA")}</th>
                  <th scope="col">{t("surahB")}</th>
                  <th scope="col" className="num">{t("similarity")}</th>
                </tr>
              </thead>
              <tbody>
                {pairs.slice(0, 60).map((p) => (
                  <tr key={`${p.a}-${p.b}`}>
                    <td>{labels[p.a]}</td>
                    <td>{labels[p.b]}</td>
                    <td className="num">{n(p.v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <Matrix labels={labels} values={similarity.matrix} label={t("simTitle")} onPick={(i) => router.push(`/stats/surah/${similarity.order[i]}`)} />
          <p className="mt-2 text-[11.5px] text-t3">{t("simOrder")}</p>
        </Figure>

        <Figure id="col" title={t("colTitle", { root: c.data?.root.spaced ?? typed })} caption={c.data ? t("colCaption", { verses: n(c.data.verses), min: n(c.data.min_shared) }) : undefined}>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setRoot(typed.replace(/[\s\-ـ]/g, ""));
            }}
          >
            <input className="field-input w-40" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={t("colRoot")} placeholder={t("colRoot")} dir="rtl" lang="ar" />
            <button type="submit" className="btn">{t("show")}</button>
          </form>
          {c.isError ? (
            <p role="status" className="text-[12.5px] text-t2">{t("colNoRoot")}</p>
          ) : c.data ? (
            <div className={c.isFetching ? "opacity-60" : undefined}>
              <BarList
                format={(v) => n(v)}
                items={c.data.items.map((it) => ({
                  key: it.key,
                  value: it.g2,
                  href: `/roots/${encodeURIComponent(it.key)}`,
                  label: (
                    <span>
                      <span className="ar-classical text-[15px]" lang="ar">{it.spaced}</span>
                      <span className="text-[11px] text-t3">{` • ${t("sharedN", { n: n(it.verses) })} • PMI ${n(it.pmi)}`}</span>
                    </span>
                  ),
                }))}
              />
              <p className="mt-2 text-[11.5px] text-t3">
                {t("colG2")}{" "}
                <Link href={`/concordance?root=${encodeURIComponent(c.data.root.key)}`} className="text-word underline underline-offset-2">{t("colConcordance")}</Link>
              </p>
            </div>
          ) : null}
        </Figure>
      </div>
    </div>
  );
}
