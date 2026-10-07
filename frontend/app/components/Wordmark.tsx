import { Link } from "react-router";

export function Wordmark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2 text-lg font-bold tracking-tight ${tone === "light" ? "text-on-ink" : "text-ink"}`}
    >
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-7">
        <rect
          width="32"
          height="32"
          rx="6"
          className={tone === "light" ? "fill-on-ink" : "fill-ink"}
        />
        <path
          d="M8 9h4l4 11 4-11h4l-6.5 15h-3Z"
          className={tone === "light" ? "fill-ink" : "fill-on-ink"}
        />
      </svg>
      V-Game
    </Link>
  );
}
