/** The Profile's tabs (PRF-15 with PRF-Q06's Quran additions and the account), shared by the page and the screen. */
export const TABS = ["contributions", "bookmarks", "notes", "graphs", "library", "journal", "account"] as const;
export type Tab = (typeof TABS)[number];
