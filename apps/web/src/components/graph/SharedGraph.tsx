"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { translitOn, useGraphUi } from "@/lib/graph/uiPrefs";
import { useSyncExternalStore } from "react";
import { useRouter } from "@/i18n/navigation";
import { decodeShare, fileBase, saveGraph } from "@/lib/graph/persist";
import { useWindowTitle } from "@/lib/windowTitle";
import { GraphCanvas } from "./GraphCanvas";

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function SharedGraph() {
  const t = useTranslations("graph");
  const translit = translitOn(useGraphUi((u) => u.translit), useLocale());
  const router = useRouter();
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => null);
  // read (and, for a link made before version 2, migrated) once per link
  const q = useQuery({ queryKey: ["shared-graph", hash], queryFn: () => (hash ? decodeShare(hash) : null), enabled: hash !== null, staleTime: Infinity, gcTime: 0, retry: false });
  useWindowTitle(q.data ? q.data.title || t("untitled") : null);
  if (hash === null || q.isPending) return null;
  const doc = q.data;
  if (!doc) return <p className="p-6 text-t2">{t(q.isError ? "sharedFailed" : "invalidShare")}</p>;
  return (
    <GraphCanvas
      key={hash}
      initialNodes={doc.nodes}
      initialEdges={doc.edges}
      title={doc.title || t("untitled")}
      fileName={fileBase(doc.title || t("untitled"))}
      kind={doc.kind}
      translit={translit}
      status={<span className="text-[12px] text-t3">{t("viewShared")}</span>}
      toolbarExtra={
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            await saveGraph(doc);
            router.push(`/graph/edit/${doc.id}`);
          }}
        >
          {t("saveCopy")}
        </button>
      }
    />
  );
}
