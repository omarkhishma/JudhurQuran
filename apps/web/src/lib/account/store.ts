"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeJSONStorage } from "@/lib/store/safeStorage";

/**
 * The signed-in account on this device (PLAN P6, D3): an opaque session token sent as a bearer header — no
 * cookie (L6) — and the account it opens. Optional: every feature works without it. The token is a secret,
 * so the data export leaves this key out (lib/localData), while "delete local data" removes it.
 */
export type Account = { id: string; email: string; display_name: string | null; affiliation: string | null; orcid: string | null; role: string; settings: { sync_journal?: boolean; share_lookups?: boolean } };

type AccountState = {
  session: string | null;
  user: Account | null;
  signIn: (session: string, user: Account) => void;
  setUser: (user: Account) => void;
  signOut: () => void;
};

export const AUTH_KEY = "jadhr-auth";

export const useAccount = create<AccountState>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      signIn: (session, user) => set({ session, user }),
      setUser: (user) => set({ user }),
      // the sync memory belongs to the account: the next sign-in starts afresh (lib/sync/run)
      signOut: () => {
        try {
          localStorage.removeItem("jadhr-sync");
        } catch {}
        set({ session: null, user: null });
      },
    }),
    { name: AUTH_KEY, storage: safeJSONStorage, version: 1, partialize: (s) => ({ session: s.session, user: s.user }) },
  ),
);

export class SignedOut extends Error {}
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`${status} ${detail}`);
  }
}

/** The API as the signed-in reader: a 401 means the session ended elsewhere, so this device signs out too. */
export async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = useAccount.getState().session;
  if (!session) throw new SignedOut();
  const r = await fetch(`/api/v1${path}`, { ...init, headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers, Authorization: `Bearer ${session}` } });
  if (r.status === 401) {
    useAccount.getState().signOut();
    throw new SignedOut();
  }
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { error?: { message?: string }; detail?: string } | null;
    throw new ApiError(r.status, body?.error?.message ?? body?.detail ?? path);
  }
  return (await r.json()) as T;
}

/** A short, non-identifying name for this device in the account's device list ("Chrome on macOS"). */
export function deviceName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} • ${os}` : browser;
}
