"use client";

import { useTranslations } from "next-intl";
import { errorKind } from "@/lib/account/errors";
import { ApiError } from "@/lib/account/store";

/** The reasons the API gives for refusing the administration's work (P14), each with its own copy. */
const CODES = [
  "passages_overlap", "outside_surah", "context_without_word", "context_too_long", "unknown_verse", "sources_required",
  "self_link", "unknown_word", "duplicate_link", "not_admin", "needs_review", "not_author", "not_open", "not_published",
  "self_review", "already_decided", "empty", "too_long", "bad_value", "unknown_role", "no_account", "not_found",
] as const; // prettier-ignore

/** An error as the board is told it: the API's reason in their language, else what went wrong in general. */
export function useWorkbenchRefusal(): (e: unknown) => string {
  const t = useTranslations("workbench");
  const ta = useTranslations("account");
  return (e) => (e instanceof ApiError && e.code && (CODES as readonly string[]).includes(e.code) ? t(`err.${e.code as (typeof CODES)[number]}`) : ta(`err.${errorKind(e)}`));
}
