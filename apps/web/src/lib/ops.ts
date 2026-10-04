import { authFetch } from "@/lib/account/store";

/** What went wrong (B61, PLAN P12): the error counts by kind and place, for the board's administrators. */
export type OpsSource = "web" | "api" | "monitor";
export type OpsRow = { source: OpsSource; kind: string; message: string; place: string; release: string; count: number; last_at: string };
export type OpsErrors = { days: number; totals: Record<OpsSource, number>; rows: OpsRow[] };

export const OPS_DAYS = [1, 7, 30] as const;
export const getOpsErrors = (days: number) => authFetch<OpsErrors>(`/ops/errors?days=${days}`);
