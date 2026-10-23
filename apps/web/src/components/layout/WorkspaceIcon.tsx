import type { SVGProps } from "react";

export type WorkspaceIconName =
  | "overview"
  | "patients"
  | "departments"
  | "doctors"
  | "appointments"
  | "staff"
  | "arrow"
  | "logout"
  | "plus";

const paths: Record<WorkspaceIconName, string> = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  patients:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  departments:
    "M4 21V5h16v16 M2 21h20 M8 9h1 M15 9h1 M8 13h1 M15 13h1 M10 21v-4h4v4",
  doctors:
    "M6 3v5a4 4 0 0 0 8 0V3 M4 3h4 M12 3h4 M10 12v3a5 5 0 0 0 10 0v-2 M22 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  appointments:
    "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M8 14h2 M14 14h2 M8 18h2",
  staff: "M12 3l9 4v5c0 5-9 9-9 9s-9-4-9-9V7l9-4 M8 12l3 3 5-6",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  logout: "M9 5H4v14h5 M10 12h11 M17 8l4 4-4 4",
  plus: "M12 5v14 M5 12h14",
};

export default function WorkspaceIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: WorkspaceIconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
