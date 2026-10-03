import { setRequestLocale } from "next-intl/server";

/** The graph editor fills the viewport: its own header, then the library, the canvas and the details (EDT-001). */
export default async function EditorLayout({ children, params }: LayoutProps<"/[locale]">) {
  setRequestLocale((await params).locale);
  return (
    <main id="main" className="flex h-dvh min-h-0 min-w-0 flex-col">
      {children}
    </main>
  );
}
