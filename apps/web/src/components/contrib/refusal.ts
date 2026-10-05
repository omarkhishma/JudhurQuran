"use client";

import { useTranslations } from "next-intl";
import { errorKind } from "@/lib/account/errors";
import { ApiError } from "@/lib/account/store";

/** The reasons the API gives for refusing a contribution, each with its own copy (audit 12 F19). */
const CODES = [
  "needs_source", "already_approved", "same_wording", "settled", "own_proposal", "not_reviewer", "waiting_board",
  "too_many_today", "too_many_open", "blocked", "no_word", "no_place", "place_mismatch", "no_sense", "sense_needed",
  "no_field", "unknown_source", "source_shape", "quran_ref", "not_revisable", "not_withdrawable", "not_revertible",
  "not_board", "not_open_report", "not_found", "not_admin", "own_account", "no_account", "unknown_kind", "no_target", "wrong_target",
] as const; // prettier-ignore

/** An error as the reader is told it: the API's reason in their language, else what went wrong in general (offline,
 * signed out, too many requests) — never the API's English or the browser's "Failed to fetch". */
export function useRefusal(): (e: unknown) => string {
  const t = useTranslations("contrib");
  const ta = useTranslations("account");
  return (e) => (e instanceof ApiError && e.code && (CODES as readonly string[]).includes(e.code) ? t(`err.${e.code as (typeof CODES)[number]}`) : ta(`err.${errorKind(e)}`));
}
