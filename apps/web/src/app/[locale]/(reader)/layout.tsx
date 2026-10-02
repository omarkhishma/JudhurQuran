import { setRequestLocale } from "next-intl/server";

/** The reader is a full-bleed working surface with its own bespoke header (design 03 §3.2). */
export default async function ReaderLayout({ children, params }: LayoutProps<"/[locale]">) {
  setRequestLocale((await params).locale);
  return (
    <main id="main" className="flex min-w-0 flex-1 flex-col">
      {children}
    </main>
  );
}
