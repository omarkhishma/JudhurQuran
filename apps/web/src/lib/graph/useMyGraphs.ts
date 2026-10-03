"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { DOCS_EVENT, listGraphs } from "./persist";

/**
 * The reader's maps as this browser holds them, read again on every visit and whenever a map is made, saved or
 * deleted here (F8: an hour-old list missed maps made since). The index is one IndexedDB read, so it is never
 * kept for later; sync's writes invalidate it in SyncRunner.
 */
export function useMyGraphs(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    const changed = () => void qc.invalidateQueries({ queryKey: ["my-graphs"] });
    window.addEventListener(DOCS_EVENT, changed);
    return () => window.removeEventListener(DOCS_EVENT, changed);
  }, [qc]);
  return useQuery({ queryKey: ["my-graphs"], queryFn: listGraphs, enabled, staleTime: 0 });
}
