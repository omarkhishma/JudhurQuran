"use client";

import { useAccount } from "@/lib/account/store";
import { useIsClient } from "@/lib/client";

/** Where this reader's maps are kept, as the editor says it (F7): in this browser, and with the account once signed
 * in (lib/sync/adapters, "graphs"). Null until the browser's own state is read, so nothing false is said first. */
export function useWhereSaved(): "browser" | "account" | null {
  const client = useIsClient();
  const signedIn = useAccount((s) => !!s.session);
  return client ? (signedIn ? "account" : "browser") : null;
}
