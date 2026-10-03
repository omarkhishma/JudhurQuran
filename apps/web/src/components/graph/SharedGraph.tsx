"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { useRouter } from "@/i18n/navigation";
import { decodeShare, fileBase, saveGraph } from "@/lib/graph/persist";
import { GraphCanvas } from "./GraphCanvas";

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function SharedGraph() {
  const t = useTranslations("graph");
  const router = useRouter();
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => null);
  if (hash === null) return null;
  const doc = hash ? decodeShare(hash) : null;
  if (!doc) return <p className="p-6 text-t2">{t("invalidShare")}</p>;
  return (
    <GraphCanvas
      initialNodes={doc.nodes}
      initialEdges={doc.edges}
      title={doc.title || t("untitled")}
      fileName={fileBase(doc.title || t("untitled"))}
      kind={doc.kind}
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
