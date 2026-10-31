import type { SVGProps } from "react";
export type HomeIconName =
  | "arrow"
  | "calendar"
  | "heart"
  | "flask"
  | "pill"
  | "video"
  | "file"
  | "check"
  | "shield"
  | "plus"
  | "chevron";
const paths: Record<HomeIconName, string[]> = {
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  calendar: [
    "M8 3v4m8-4v4",
    "M4 10h16",
    "M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z",
    "M8 14h2m4 0h2m-8 3h2",
  ],
  heart: [
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
    "M5 12h4l2-4 2 8 2-4h4",
  ],
  flask: [
    "M9 3h6m-5 0v6l-6 10a1.3 1.3 0 0 0 1 2h14a1.3 1.3 0 0 0 1-2L14 9V3",
    "M8 14h8",
    "M10 17h.01m4 1h.01",
  ],
  pill: [
    "m9 15 6-6",
    "M5 19a5 5 0 0 1 0-7l7-7a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7 0Z",
  ],
  video: ["M15 9 21 5v14l-6-4", "M3 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3V5Z"],
  file: ["M14 3H5v18h14V8l-5-5Z", "M14 3v5h5", "M8 12h8m-8 4h5"],
  check: ["m5 12 4 4L19 6"],
  shield: ["m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z", "m8 12 3 3 5-6"],
  plus: ["M12 5v14M5 12h14"],
  chevron: ["m9 5 7 7-7 7"],
};
export default function HomeIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: HomeIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
