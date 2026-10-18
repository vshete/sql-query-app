import type { CSSProperties } from "react";

const paths = {
  terminal: "m6 7 4 4-4 4m7 0h5M3 3h18v18H3z",
  database:
    "M20 6c0 2.2-3.6 4-8 4S4 8.2 4 6s3.6-4 8-4 8 1.8 8 4ZM4 6v12c0 2.2 3.6 4 8 4s8-1.8 8-4V6M4 12c0 2.2 3.6 4 8 4s8-1.8 8-4",
  sparkles:
    "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4",
  play: "m7 4 14 8-14 8V4Z",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  table: "M3 4h18v16H3zM3 9h18M9 9v11",
  check: "m5 12 4 4L19 6",
} as const;

/** Render a decorative shared SVG; the surrounding control supplies its accessible name. */
export function WorkspaceIcon({
  name,
  size = 16,
  style,
}: {
  name: keyof typeof paths;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
