/** Long-form page typography (headings, paragraphs, lists) for content pages. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="prose-page mx-auto max-w-[760px] px-4 py-10 text-[15.5px] leading-[1.9] text-t1 [&_h1]:mb-3 [&_h1]:text-[30px] [&_h1]:font-semibold [&_h1]:leading-tight [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:scroll-mt-24 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_li]:my-1.5 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:my-3 [&_ul]:list-disc [&_ul]:ps-6 [&_a]:text-word [&_a]:underline [&_a]:decoration-1 [&_a]:underline-offset-[3px] [&_a:hover]:decoration-2 [&_.lead]:text-[17px] [&_.lead]:text-t2">
      {children}
    </div>
  );
}
