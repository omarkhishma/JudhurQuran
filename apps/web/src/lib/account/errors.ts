"use client";

import { ApiError, SignedOut } from "./store";

/** What went wrong, as the reader is told it: in their language, never the API's English or the browser's
 * "Failed to fetch" (audit 11 F21). The keys are in the "account" copy, under `err`. */
export type ErrorKind = "offline" | "invalid" | "orcid" | "busy" | "expired" | "signedOut" | "failed";

const ORCID = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export function errorKind(e: unknown, sent?: { orcid?: string }): ErrorKind {
  if (e instanceof SignedOut) return "signedOut";
  if (!(e instanceof ApiError)) return typeof navigator !== "undefined" && !navigator.onLine ? "offline" : e instanceof TypeError ? "offline" : "failed";
  if (e.status === 401) return "signedOut";
  if (e.status === 429) return "busy";
  if (e.status === 400 || e.status === 410) return "expired";
  if (e.status === 422) return sent?.orcid && !ORCID.test(sent.orcid) ? "orcid" : "invalid";
  return "failed";
}
