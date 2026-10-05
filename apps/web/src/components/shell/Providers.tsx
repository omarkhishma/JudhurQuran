"use client";

import { isServer, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SyncRunner } from "@/components/account/SyncRunner";
import { DueTitle } from "@/components/shell/DueTitle";
import { StorageWarning } from "@/components/shell/StorageWarning";
import { AudioEngine } from "@/components/audio/AudioEngine";
import { ClassroomSignals } from "@/components/classroom/ClassroomSignals";

export function Providers({ children }: { children: React.ReactNode }) {
  // Content is immutable within a dataset release: keep fetched words/roots for the session. On the server a client
  // lives for one render and is dropped with it: a finite gcTime there starts a timer for every query the render
  // builds, which held each page's data, and the render with it, for that long — an hour of pages, until the server
  // ran out of memory. Infinity starts none (TanStack's own server default).
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60 * 60 * 1000, gcTime: isServer ? Infinity : 60 * 60 * 1000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <AudioEngine />
      <SyncRunner />
      <StorageWarning />
      <DueTitle />
      <ClassroomSignals />
    </QueryClientProvider>
  );
}
