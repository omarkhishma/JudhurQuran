import { setRequestLocale } from "next-intl/server";

/** The split view fills the viewport with its own header — the hub, the panes, the context, the word sent to the map —
 * above the reader and the editor (P8.6, EDT-315). */
export default async function SplitLayout({ children, params }: LayoutProps<"/[locale]">) {
  setRequestLocale((await params).locale);
  return (
    <main id="main" className="flex h-dvh min-h-0 min-w-0 flex-col">
      {children}
    </main>
  );
}
