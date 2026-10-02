/** Full-bleed working surfaces (the map editor): no footer, the canvas fills the viewport under the header. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex h-[calc(100dvh-52px)] min-h-0 flex-col">{children}</div>;
}
