import { Link } from "react-router";

// The "khối lắp ghép" mark (public/favicon.svg): five isometric blocks form a V; the amber
// block at the point is the one just snapped in. Theme tokens instead of fixed colours, so the
// mark follows every theme pack; on an ink background the tile blends in and the blocks remain.
const CUBES_RIGHT =
  "M4 3 6 4 6 6 4 7 2 6 2 4ZM12 3 14 4 14 6 12 7 10 6 10 4ZM6 6 8 7 8 9 6 10 4 9 4 7ZM10 6 12 7 12 9 10 10 8 9 8 7Z";
const CUBES_LEFT = "M2 4 4 5 4 7 2 6ZM10 4 12 5 12 7 10 6ZM4 7 6 8 6 10 4 9ZM8 7 10 8 10 10 8 9Z";
const CUBES_TOP = "M4 3 6 4 4 5 2 4ZM12 3 14 4 12 5 10 4ZM6 6 8 7 6 8 4 7ZM10 6 12 7 10 8 8 7Z";
const TIP = "M8 9 10 10 10 12 8 13 6 12 6 10Z";
const TIP_LEFT = "M6 10 8 11 8 13 6 12Z";
const TIP_TOP = "M8 9 10 10 8 11 6 10Z";

export function Wordmark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2 text-lg font-bold tracking-tight ${tone === "light" ? "text-on-ink" : "text-ink"}`}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-7">
        <rect width="16" height="16" rx="3.52" className="fill-ink" />
        <path d={CUBES_RIGHT} className="fill-on-ink-muted" fillOpacity={0.7} />
        <path d={CUBES_LEFT} className="fill-on-ink-muted" />
        <path d={CUBES_TOP} className="fill-on-ink" />
        <path d={TIP} className="fill-accent" />
        <path d={TIP_LEFT} className="fill-on-ink" fillOpacity={0.2} />
        <path d={TIP_TOP} className="fill-on-ink" fillOpacity={0.38} />
      </svg>
      V-Game
    </Link>
  );
}
