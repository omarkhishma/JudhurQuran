/** Small stroke icon set (12–16px, stroke 1.2), decorative unless labelled by the parent control. */
const PATHS: Record<string, string> = {
  search: "M7 12.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11Zm4-1.5 3.5 3.5",
  sun: "M8 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7ZM8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1",
  moon: "M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7Z",
  menu: "M2 4h12M2 8h12M2 12h12",
  close: "M3.5 3.5l9 9M12.5 3.5l-9 9",
  book: "M2.5 3h4a1.5 1.5 0 0 1 1.5 1.5V13a1 1 0 0 0-1-1H2.5V3Zm11 0h-4A1.5 1.5 0 0 0 8 4.5V13a1 1 0 0 1 1-1h4.5V3Z",
  root: "M8 14V8m0 0L4 4m4 4 4-4M8 8V2",
  graph: "M5.5 8h5M3.5 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm9 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  bookmark: "M4 2h8v12l-4-3-4 3V2Z",
  chevronStart: "M10 3 5 8l5 5",
  chevronEnd: "M6 3l5 5-5 5",
  play: "M5 3.5v9l7-4.5-7-4.5Z",
  pause: "M5 3.5v9M11 3.5v9",
  copy: "M5 5h8v8H5zM3 11V3h8",
  share: "M10.5 4.5 5.5 7.5m0 1 5 3M12 3.5a1.5 1.5 0 1 1 0 .01M4 8a1.5 1.5 0 1 1 0 .01M12 12.5a1.5 1.5 0 1 1 0 .01",
  tafsir: "M3 3h10M3 6h10M3 9h6M3 12h8",
  external: "M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5",
  info: "M8 7v4.5M8 4.6v.1M8 14.5a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z",
  globe: "M8 14.5a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13ZM1.5 8h13M8 1.5c2 2 2.5 4 2.5 6.5S10 12.5 8 14.5C6 12.5 5.5 10.5 5.5 8S6 3.5 8 1.5Z",
  settings: "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5.5-2a5.5 5.5 0 0 0-.1-1l1.4-1.1-1.4-2.4-1.7.6a5.5 5.5 0 0 0-1.7-1L9.7 1.5H6.3L6 3.1a5.5 5.5 0 0 0-1.7 1l-1.7-.6L1.2 5.9 2.6 7a5.5 5.5 0 0 0 0 2l-1.4 1.1 1.4 2.4 1.7-.6a5.5 5.5 0 0 0 1.7 1l.3 1.6h3.4l.3-1.6a5.5 5.5 0 0 0 1.7-1l1.7.6 1.4-2.4L13.4 9c.1-.3.1-.7.1-1Z",
  plus: "M8 3v10M3 8h10",
  minus: "M3 8h10",
  arrowUp: "M8 13V3m0 0L4 7m4-4 4 4",
  check: "M3 8.5 6.5 12 13 4.5",
  note: "M3 13h2.5L13 5.5 10.5 3 3 10.5V13Z",
  layers: "M8 2 2 5l6 3 6-3-6-3Zm-6 6 6 3 6-3M2 11l6 3 6-3",
};

const DIRECTIONAL = new Set(["chevronStart", "chevronEnd", "external", "share"]);

export function Icon({ name, size = 14, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  const cls = [className, DIRECTIONAL.has(name) ? "rtl:-scale-x-100" : null].filter(Boolean).join(" ") || undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cls}
    >
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}
