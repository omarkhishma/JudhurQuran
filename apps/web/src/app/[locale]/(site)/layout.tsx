import { SiteFooter } from "@/components/shell/SiteFooter";

/** Content pages: page body + footer with attribution. The reader and the map are full-bleed and skip this. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </>
  );
}
