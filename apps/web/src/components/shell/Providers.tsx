"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SyncRunner } from "@/components/account/SyncRunner";
import { DueTitle } from "@/components/shell/DueTitle";
import { StorageWarning } from "@/components/shell/StorageWarning";
import { AudioEngine } from "@/components/audio/AudioEngine";
import { ClassroomSignals } from "@/components/classroom/ClassroomSignals";

export function Providers({ children }: { children: React.ReactNode }) {
  // Content is immutable within a dataset release: keep fetched words/roots for the session.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60 * 60 * 1000, gcTime: 60 * 60 * 1000, retry: 1, refetchOnWindowFocus: false } },
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
