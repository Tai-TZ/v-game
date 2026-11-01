import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import { bladeCuts } from "./bladeCuts";
import {
  isAllowed,
  isLocked,
  isOptional,
  nodeIds,
  setAttached,
  slotParams,
  type Bench,
  type Env,
} from "./bench";
import type { BenchRunView } from "./BenchView";
import { BLOCK_STATE_VI, fmt, fmtValue, toyName } from "./copy";
import type { BlockState } from "./run";
import type { BlockType, Fact } from "./schema";

/**
 * Sơ đồ máy: the assistant as one isometric machine on a maquette base (art bible §1.1), the
 * question carried along a belt from the counter bell to the answer board. Each toy wears its
 * own setting -- the blade's cuts, the dome's hooks, the lens's card slots -- so the bench is
 * read as a machine before any of it is read as a form. A missing search is an empty socket and
 * the belt after it is cut: L1's lesson, drawn before a single run.
 *
 * The beat buttons on the left walk the followed case through the machine one toy at a time,
 * each beat a line read off the run's own facts (or off the bench when nothing has run yet).
 * Pressing a toy takes the hand to its slot, where the knobs are; an empty socket attaches it.
 *
 * SVG, not three.js: three.js lives in the /play chunk only, and the workbench's whole budget
 * is smaller than it. Motion only answers a press and stops (§1.2.6): the active toy lifts.
 */

type Column = readonly BlockType[];

const isSearch = (type: BlockType) => type === "vector_search" || type === "bm25_search";

/** Columns in flow order: a column of two is two searches side by side. */
export function columns(env: Env): Column[] {
  const allowed = (type: BlockType) => isAllowed(env.level, type);
  const searches = (["vector_search", "bm25_search"] as const).filter(allowed);
  return [
    ["input"],
    ["corpus"],
    ["chunker"],
    ...(searches.length > 0 ? [searches] : []),
    ...(allowed("fusion") ? [["fusion"] as const] : []),
    ...(allowed("rerank") ? [["rerank"] as const] : []),
    ["context_packer"],
    ["llm"],
    ["output"],
  ];
}

// --- the beats ------------------------------------------------------------------------------

/** One beat per column but the shelf: the shelf only holds the books the blade cuts. */
export const BEAT_VI: Readonly<Record<string, string>> = {
  input: "Khách rung chuông",
  chunker: "Cắt kho",
  search: "Kéo đoạn",
  fusion: "Gộp hai danh sách",
  rerank: "Soi lại hạng",
  context_packer: "Đóng thùng",
  llm: "Bộ Óc trả lời",
  output: "Chấm câu trả lời",
};

/** The bubble over the machine while a beat plays: what the toy is doing, in a few words. */
export const NARRATE_VI: Readonly<Record<string, string>> = {
  input: "Khách rung chuông…",
  chunker: "Lưỡi dao đang cắt…",
  search: "Đang kéo đoạn…",
  fusion: "Đang gộp hai danh sách…",
  rerank: "Kính lúp đang soi…",
  context_packer: "Đang đóng thùng…",
  llm: "Bộ Óc đang đọc thùng…",
  output: "Đang chấm…",
};

const beatOf = (col: Column): string => (col.every(isSearch) ? "search" : (col[0] ?? "input"));

function factOf<K extends Fact["kind"]>(
  view: BenchRunView,
  node: string,
  kind: K,
): Extract<Fact, { kind: K }> | undefined {
  return view.followed.steps[node]?.facts?.find(
    (f): f is Extract<Fact, { kind: K }> => f.kind === kind,
  );
}

/**
 * What a beat shows, in one line: the followed case's own facts once a run is on the bench,
 * the bench's setting before. A hidden or trap case never shows its question, answer or where
 * its answer passage sits (roadmap B0): only counts, as the slots already do.
 */
export function beatLine(beat: string, env: Env, bench: Bench, view: BenchRunView | null): string {
  const ids = nodeIds(env.level);
  const on = (type: BlockType) =>
    isAllowed(env.level, type) && (!isOptional(type) || bench.attached[type]);
  const params = (type: BlockType) => slotParams(env, bench, type);
  const visible = view?.followed.role === "visible";

  switch (beat) {
    case "input":
      if (!view) return "Chuông chờ câu hỏi của khách.";
      return visible && view.followed.question
        ? `Câu #${view.followed.n}: «${view.followed.question}»`
        : `Câu #${view.followed.n} (câu này không hiện câu hỏi).`;
    case "chunker": {
      const p = params("chunker");
      return `Lược dao ${fmtValue("strategy", p.strategy ?? null).toLowerCase()}, ${fmtValue("chunk_size", p.chunk_size ?? null)} mỗi đoạn, chồng lấp ${fmtValue("overlap_pct", p.overlap_pct ?? null)}.`;
    }
    case "search": {
      const searches = (["vector_search", "bm25_search"] as const).filter(on);
      if (searches.length === 0)
        return "Không có khe tìm nào: thùng chỉ có câu hỏi, Bộ Óc phải tự đoán.";
      return searches
        .map((type) => {
          const name = toyName(type);
          const got = view ? factOf(view, ids[type], "retrieved") : undefined;
          if (!got) return `${name} kéo tối đa ${fmt(Number(params(type).top_k ?? 0))} đoạn.`;
          const gold = view?.gold;
          const rank = visible && gold?.visible ? gold.ranks[ids[type]] : undefined;
          const where =
            rank === undefined
              ? ""
              : rank === null
                ? ", không thấy đoạn đáp án"
                : `, đoạn đáp án đứng hạng ${fmt(rank)}`;
          return `${name} kéo về ${fmt(got.items.length)} đoạn${where}.`;
        })
        .join(" ");
    }
    case "fusion":
      if (!on("fusion")) return "Không gộp: hai danh sách đổ thẳng vào bước sau.";
      return `${toyName("fusion", params("fusion"))} gộp hai danh sách thành một.`;
    case "rerank":
      if (!on("rerank")) return "Không soi lại: thứ hạng giữ nguyên.";
      return `Kính lúp đọc kỹ và giữ ${fmt(Number(params("rerank").top_n ?? 0))} đoạn tốt nhất.`;
    case "context_packer": {
      const pack = view ? factOf(view, ids.context_packer, "pack") : undefined;
      const stamp =
        params("context_packer").cite_ids === true ? ", có đóng tem mã đoạn" : ", không đóng tem";
      if (!pack)
        return `Thùng chứa tối đa ${fmt(Number(params("context_packer").token_budget ?? 0))} token${stamp}.`;
      const dropped = pack.dropped.length > 0 ? `, bỏ ${fmt(pack.dropped.length)} đoạn vì đầy` : "";
      return `Thùng nhận ${fmt(pack.included.length)} đoạn, ${fmt(pack.tokens.total)}/${fmt(pack.tokens.budget)} token${dropped}${stamp}.`;
    }
    case "llm": {
      const cards = bench.cards.filter((c) => c !== null).length;
      const said = view ? factOf(view, ids.llm, "llm") : undefined;
      if (!said) return `Bộ Óc đọc thùng qua Lăng kính có ${fmt(cards)}/3 thẻ dặn dò.`;
      const cited =
        said.cited_ids.length > 0
          ? `trích ${fmt(said.cited_ids.length)} mã đoạn`
          : "không trích mã đoạn nào";
      return visible && view.followed.answer
        ? `Bộ Óc ${cited}: «${clip(view.followed.answer, 140)}»`
        : `Bộ Óc ${cited}.`;
    }
    case "output": {
      const graded = view?.followed.graded;
      if (!graded) return "Bảng trả lời chờ được chấm.";
      if (!graded.counted) return "Câu này không tính sao.";
      return graded.passed
        ? "Đạt: câu trả lời qua mọi tiêu chí."
        : "Trượt: câu trả lời chưa qua tiêu chí của câu này.";
    }
    default:
      return "";
  }
}

/** One line of the answer: markdown marks and line breaks dropped, cut at `max`. */
const clip = (text: string, max: number) => {
  const flat = text
    .replace(/[*_#`>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

// --- isometric drawing ----------------------------------------------------------------------

/** Projection unit in px; a toy's footprint is 1.6 units square. */
const S = 30;
const C = Math.cos(Math.PI / 6);
const FOOT = 1.6;
/** Model distance between two toys along the belt, per axis. */
const STEP = 1.9;
/** How far each of a pair of searches stands off the belt, per axis. */
const PAIR = 0.85;
/** Half the belt's width, across it. */
const BELT = 0.25;
/** One unit along the belt or across it, per axis (1/√2). */
const U = Math.SQRT1_2;

type P = readonly [number, number];
const iso = (x: number, y: number, z: number): P => [(x - y) * C * S, (x + y) * 0.5 * S - z * S];
const pts = (list: readonly P[]) =>
  list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
const quad = (x: number, y: number, w: number, d: number, z: number) =>
  pts([iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)]);

const HEIGHT: Readonly<Record<BlockType, number>> = {
  input: 1.0,
  corpus: 0.7,
  chunker: 0.8,
  vector_search: 1.1,
  bm25_search: 1.5,
  fusion: 0.9,
  rerank: 0.9,
  context_packer: 1.4,
  llm: 1.2,
  output: 0.7,
};

/** Three faces of a box: the top in its own token, the two sides darker by a fixed rule. */
function Box({
  x,
  y,
  z = 0,
  w,
  d,
  h,
  top = "fill-surface",
  stroke = "stroke-fg",
  glass = false,
}: {
  x: number;
  y: number;
  z?: number;
  w: number;
  d: number;
  h: number;
  top?: string;
  stroke?: string;
  /** See-through: the faces turn to glass so what the toy holds shows inside it. */
  glass?: boolean;
}) {
  const t = z + h;
  const pane = glass ? "[fill-opacity:0.28]" : "";
  return (
    <g strokeWidth="1.6" strokeLinejoin="round" {...(glass ? { "data-glass": "" } : {})}>
      <polygon
        className={`fill-line ${pane} ${stroke}`}
        points={pts([
          iso(x + w, y, z),
          iso(x + w, y + d, z),
          iso(x + w, y + d, t),
          iso(x + w, y, t),
        ])}
      />
      <polygon
        className={`fill-subtle ${pane} ${stroke}`}
        points={pts([
          iso(x, y + d, z),
          iso(x + w, y + d, z),
          iso(x + w, y + d, t),
          iso(x, y + d, t),
        ])}
      />
      <polygon className={`${top} ${pane} ${stroke}`} points={quad(x, y, w, d, t)} />
    </g>
  );
}

const TONE: Readonly<Record<BlockState, string>> = {
  idle: "stroke-fg",
  stale: "stroke-warning",
  queued: "stroke-fg",
  running: "stroke-brand",
  passed: "stroke-success",
  error: "stroke-danger",
};

/** Zoom steps, in percent of the frame's width: 100 is the whole machine in view. */
const ZOOMS = [100, 150, 200] as const;

const PILL =
  "min-h-11 rounded-full border-2 border-fg px-4 text-sm font-semibold aria-pressed:bg-fg aria-pressed:text-surface disabled:cursor-not-allowed disabled:opacity-60";

export function MachineMap({
  env,
  bench,
  onChange,
  onOpen,
  onPick,
  disabled,
  states,
  highlight,
  answer,
  view = null,
}: {
  env: Env;
  bench: Bench;
  onChange: (next: Bench) => void;
  /** Takes the hand to the toy's slot, where its knobs are. */
  onOpen?: (type: BlockType) => void;
  /** Opens a toy's slot without moving the hand: a toy just added from its socket. */
  onPick?: (type: BlockType) => void;
  disabled: boolean;
  states: Partial<Record<BlockType, BlockState>>;
  highlight: BlockType | null;
  /** The followed case's verdict, drawn on the answer board. */
  answer: "pass" | "fail" | null;
  /** The run on the bench, whose followed case the beats walk through. */
  view?: BenchRunView | null;
}): ReactElement {
  const readoutId = useId();
  const [beat, setBeat] = useState<string | null>(null);
  const [labels, setLabels] = useState(true);
  const [seeThrough, setSeeThrough] = useState(false);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(100);

  const attached = (type: BlockType) => !isOptional(type) || bench.attached[type];
  const cols = columns(env);
  const pair = cols.some((col) => col.length > 1);
  const beats = cols.filter((col) => col[0] !== "corpus").map(beatOf);
  const packed = view
    ? (factOf(view, nodeIds(env.level).context_packer, "pack")?.included.length ?? 0)
    : 0;

  // The belt runs left to right across the screen: along (1, -1) in the model, so every toy
  // stands at the same depth and none hides another. A pair of searches splits across it.
  const origin = (index: number, at: number, of: number): P => {
    const off = of > 1 ? (at === 0 ? -PAIR : PAIR) : 0;
    return [index * STEP + off, -index * STEP + off];
  };
  const centre = (index: number): P => [index * STEP + FOOT / 2, -index * STEP + FOOT / 2];
  const along = (p: P, t: number, side: number, z: number): P =>
    iso(p[0] + t * U + side * U, p[1] - t * U + side * U, z);
  const first = centre(0);
  const last = centre(cols.length - 1);
  const half = pair ? 2.1 : 1.3;
  const ends = [
    along(first, -1.4, half, -0.3),
    along(first, -1.4, -half, 2.2),
    along(last, 1.4, half, -0.3),
    along(last, 1.4, -half, 2.2),
  ];
  const minX = Math.min(...ends.map((p) => p[0])) - 16;
  const maxX = Math.max(...ends.map((p) => p[0])) + 28;
  // Room above the toys for the callouts, two rows of them.
  const minY = Math.min(...ends.map((p) => p[1])) - 58;
  // And below, for the hanging callout of a pair's front toy.
  const maxY = Math.max(...ends.map((p) => p[1])) + (pair ? 44 : 22);
  const box = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

  const beatIndex = beat === null ? -1 : cols.findIndex((col) => beatOf(col) === beat);
  const active = new Set<BlockType>(beatIndex === -1 ? [] : (cols[beatIndex] ?? []));
  // The question slip rides the belt and stops just before the toy of the beat.
  const slipAt =
    beatIndex === -1
      ? null
      : along(centre(beatIndex), beatIndex === 0 ? -1.0 : -STEP / U / 2, 0, 0);
  // The bubble sits in the band above the machine, over the beat's toy, kept off the edges.
  const bubbleAt =
    beatIndex === -1
      ? null
      : (() => {
          const [bx] = along(centre(beatIndex), 0, 0, 0);
          return { left: Math.min(88, Math.max(12, ((bx - box.x) / box.w) * 100)) };
        })();
  const ink = `ink${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // On a narrow screen the machine scrolls: bring the beat's toy to the middle of the frame.
  const frame = useRef<HTMLDivElement>(null);
  const bubbleLeft = bubbleAt?.left ?? null;
  useEffect(() => {
    const el = frame.current;
    if (!el || bubbleLeft === null || el.scrollWidth <= el.clientWidth) return;
    // A jump, not a glide: the slip already shows the move, and a jump needs no reduced-motion
    // branch.
    el.scrollLeft = (bubbleLeft / 100) * el.scrollWidth - el.clientWidth / 2;
  }, [bubbleLeft, zoom]);

  return (
    <figure data-machine-figure="">
      <figcaption className="mb-3 font-mono text-sm font-bold">
        Hình · Cỗ máy trợ lý — {env.level.title}
      </figcaption>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <ol aria-label="Cho câu hỏi chạy qua máy" className="flex flex-wrap gap-2">
          {beats.map((b, index) => (
            <li key={b}>
              <button
                type="button"
                aria-pressed={beat === b}
                aria-describedby={beat === b ? readoutId : undefined}
                data-beat={b}
                onClick={() => setBeat(beat === b ? null : b)}
                className={PILL}
              >
                <span className="sr-only">Bước {index + 1}: </span>
                {BEAT_VI[b]}
              </button>
            </li>
          ))}
        </ol>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={seeThrough}
            onClick={() => setSeeThrough(!seeThrough)}
            className={PILL}
          >
            Nhìn xuyên
          </button>
          <button
            type="button"
            aria-pressed={labels}
            onClick={() => setLabels(!labels)}
            className={PILL}
          >
            Nhãn
          </button>
        </div>
      </div>

      {/* Scrolls on a phone rather than shrink the toys past reading: focusable, as it scrolls. */}
      <div
        ref={frame}
        tabIndex={0}
        role="region"
        aria-label="Cỗ máy trợ lý"
        className="mt-3 overflow-x-auto focus-visible:outline-2 focus-visible:outline-brand"
      >
        {/* pt-10: a band above the machine for the beat's bubble, clear of the callouts. */}
        <div
          data-zoom={zoom}
          style={{ width: `${zoom}%` }}
          className="relative min-w-[38rem] pt-10"
        >
          <svg
            role="group"
            aria-label="Sơ đồ trợ lý: câu hỏi đi từ trái sang phải"
            data-see-through={seeThrough ? "on" : "off"}
            viewBox={`${box.x.toFixed(0)} ${box.y.toFixed(0)} ${box.w.toFixed(0)} ${box.h.toFixed(0)}`}
            className="h-auto w-full"
          >
            {/* Hand-inked: the outlines waver a little, the same way every time. */}
            <defs>
              <filter id={ink} x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" />
                <feDisplacementMap
                  in="SourceGraphic"
                  scale="1.4"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </defs>

            <g aria-hidden="true" strokeWidth="1.6" strokeLinejoin="round">
              {/* A flat shadow, offset, under the slab (no blur: art bible §1.3). */}
              <polygon
                className="fill-brand-tint"
                transform="translate(14 10)"
                points={pts([
                  along(first, -1.4, half, -0.3),
                  along(last, 1.4, half, -0.3),
                  along(last, 1.4, -half, -0.3),
                  along(first, -1.4, -half, -0.3),
                ])}
              />
              {/* The maquette base: a flat slab with square edges. */}
              <polygon
                className="fill-line stroke-line-strong"
                points={pts([
                  along(first, -1.4, half, 0),
                  along(last, 1.4, half, 0),
                  along(last, 1.4, half, -0.3),
                  along(first, -1.4, half, -0.3),
                ])}
              />
              <polygon
                className="fill-subtle stroke-line-strong"
                points={pts([
                  along(first, -1.4, half, 0),
                  along(last, 1.4, half, 0),
                  along(last, 1.4, -half, 0),
                  along(first, -1.4, -half, 0),
                ])}
              />
            </g>

            <g filter={`url(#${ink})`}>
              {cols.map((col, index) => {
                const key = col.join("+");
                const broken = col.every(isSearch) && !col.some(attached);
                const from = centre(index);
                return (
                  <g key={key} data-column={key}>
                    {/* The belt to the next toy, cut after an empty search socket. */}
                    {index < cols.length - 1 && (
                      <polygon
                        aria-hidden="true"
                        data-pipe-after={key}
                        data-pipe={broken ? "broken" : "flow"}
                        className={
                          broken
                            ? "fill-none stroke-danger [stroke-dasharray:4_3]"
                            : "fill-line-strong stroke-fg"
                        }
                        strokeWidth="1.4"
                        points={pts([
                          along(from, 0, BELT, 0),
                          along(from, STEP / U, BELT, 0),
                          along(from, STEP / U, -BELT, 0),
                          along(from, 0, -BELT, 0),
                        ])}
                      />
                    )}
                    {col.map((type, at) => {
                      const [x, y] = origin(index, at, col.length);
                      return (
                        <Toy
                          key={type}
                          env={env}
                          bench={bench}
                          type={type}
                          x={x}
                          y={y}
                          row={(index + at) % 2}
                          front={col.length > 1 && at === 1}
                          on={attached(type)}
                          disabled={disabled}
                          state={states[type] ?? "idle"}
                          lit={highlight === type || active.has(type)}
                          answer={type === "output" ? answer : null}
                          labels={labels}
                          seeThrough={seeThrough}
                          packed={packed}
                          onAttach={() => {
                            if (!isOptional(type)) return;
                            onChange(setAttached(bench, type, true));
                            onPick?.(type);
                          }}
                          onOpen={() => onOpen?.(type)}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>

            {/* The question as a slip of paper: it slides along the belt to the beat's toy and
                stops there. One move per press; nothing moves on its own (§1.2.6). */}
            {slipAt && beat !== null && (
              <g
                aria-hidden="true"
                data-slip=""
                data-at={beat}
                style={{
                  transform: `translate(${slipAt[0].toFixed(1)}px, ${slipAt[1].toFixed(1)}px)`,
                }}
                className="transition-transform duration-500 ease-out motion-reduce:transition-none"
              >
                <polygon
                  className="fill-surface stroke-fg"
                  strokeWidth="1.4"
                  points={pts([
                    iso(-0.3, -0.3, 0.05),
                    iso(0.3, -0.3, 0.05),
                    iso(0.3, 0.3, 0.05),
                    iso(-0.3, 0.3, 0.05),
                  ])}
                />
                <path d="M-6 -1h9M-4 2h7" className="stroke-fg-muted" strokeWidth="1" />
              </g>
            )}
          </svg>

          {bubbleAt && beat !== null && (
            <p
              aria-hidden="true"
              data-beat-bubble=""
              style={{ left: `${bubbleAt.left.toFixed(1)}%` }}
              className="absolute top-1 -translate-x-1/2 rounded-md border-2 border-fg bg-warning-tint px-3 py-1 font-mono text-xs font-bold whitespace-nowrap"
            >
              {NARRATE_VI[beat]}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 text-sm">
        <button
          type="button"
          aria-label="Thu nhỏ"
          disabled={zoom === ZOOMS[0]}
          onClick={() => setZoom(ZOOMS[Math.max(ZOOMS.indexOf(zoom) - 1, 0)] ?? 100)}
          className="size-11 rounded-full border-2 border-fg font-bold disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <span className="w-14 text-center font-mono font-bold tabular-nums">{zoom}%</span>
        <button
          type="button"
          aria-label="Phóng to"
          disabled={zoom === ZOOMS[ZOOMS.length - 1]}
          onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.indexOf(zoom) + 1, ZOOMS.length - 1)] ?? 100)}
          className="size-11 rounded-full border-2 border-fg font-bold disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>

      {/* Not a live region: the page keeps one (§8, Q5). The pressed beat points here by
          aria-describedby, so the line is read with the button that brought it. */}
      <p id={readoutId} data-beat-readout="" className="mt-2 min-h-6 text-sm">
        {beat === null ? (
          <span className="text-fg-muted">
            {view
              ? "Bấm từng bước để xem câu đang theo dõi đi qua máy."
              : "Bấm từng bước để xem máy sẽ làm gì với câu hỏi."}
          </span>
        ) : (
          beatLine(beat, env, bench, view)
        )}
      </p>
    </figure>
  );
}

function Toy({
  env,
  bench,
  type,
  x,
  y,
  row,
  front,
  on,
  disabled,
  state,
  lit,
  answer,
  labels,
  seeThrough,
  packed,
  onAttach,
  onOpen,
}: {
  env: Env;
  bench: Bench;
  type: BlockType;
  x: number;
  y: number;
  /** Which of the two callout rows: neighbours alternate so their labels never collide. */
  row: number;
  /** The front toy of a pair: its callout hangs below, clear of the one behind it. */
  front: boolean;
  on: boolean;
  disabled: boolean;
  state: BlockState;
  lit: boolean;
  answer: "pass" | "fail" | null;
  labels: boolean;
  seeThrough: boolean;
  packed: number;
  onAttach: () => void;
  onOpen: () => void;
}) {
  const params = slotParams(env, bench, type);
  const toy = toyName(type, params);
  const locked = isLocked(env.level, type);
  const act = on ? onOpen : onAttach;
  const footprint = quad(x, y, FOOT, FOOT, 0);
  const common = {
    role: "button",
    tabIndex: disabled ? -1 : 0,
    "aria-disabled": disabled,
    "data-tile-type": type,
    onClick: () => {
      if (!disabled) act();
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      act();
    },
    className: `group/toy outline-none ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`,
  } as const;

  const h = HEIGHT[type];
  // Callouts, Colorfigures-style: a capitalised tag over the toy on a leader line. Seen
  // through, the tag gives the block's real type (library §2: the metaphor fades).
  const label = labels && (
    <Callout
      type={type}
      text={seeThrough ? type : (on ? toy : `Gắn ${toy}`).toLocaleUpperCase("vi")}
      from={
        front ? iso(x + FOOT, y + FOOT, 0) : iso(x + FOOT / 2, y + FOOT / 2, on ? h + 0.9 : 0.2)
      }
      rise={34 + row * 22}
      below={front}
    />
  );
  const focusRing = (
    <polygon
      aria-hidden="true"
      points={footprint}
      className="fill-none stroke-brand opacity-0 group-focus-visible/toy:opacity-100"
      strokeWidth="3"
    />
  );

  if (!on) {
    const [cx, cy] = iso(x + FOOT / 2, y + FOOT / 2, 0);
    return (
      <g {...common} data-tile="empty" aria-label={`Gắn ${toy}`}>
        <polygon
          points={footprint}
          className="fill-surface stroke-danger [stroke-dasharray:4_3]"
          strokeWidth="1.5"
        />
        <path
          d={`M${cx - 6} ${cy}h12M${cx} ${cy - 6}v12`}
          className="stroke-danger"
          strokeWidth="2"
        />
        {focusRing}
        {label}
      </g>
    );
  }

  return (
    <g
      {...common}
      data-tile="on"
      data-tile-state={state}
      {...(locked ? { "data-locked": "" } : {})}
      aria-label={`${toy}: ${BLOCK_STATE_VI[state]}${locked ? ", khóa ở màn này" : ""}`}
    >
      {focusRing}
      {/* The active toy lifts once and settles; nothing moves on its own. */}
      <g
        className={`transition-transform duration-200 motion-reduce:transition-none ${lit ? "-translate-y-1.5" : ""}`}
      >
        <Box
          x={x}
          y={y}
          w={FOOT}
          d={FOOT}
          h={h}
          top={lit ? "fill-brand-tint" : "fill-surface"}
          stroke={TONE[state]}
          glass={seeThrough}
        />
        {seeThrough && <Inside env={env} bench={bench} type={type} x={x} y={y} h={h} />}
        <Dress
          env={env}
          bench={bench}
          type={type}
          x={x}
          y={y}
          h={h}
          answer={answer}
          packed={packed}
        />
        {locked && <Lock at={iso(x, y + FOOT, h)} />}
      </g>
      {label}
    </g>
  );
}

function Callout({
  below = false,
  type,
  text,
  from: [fx, fy],
  rise,
}: {
  type: BlockType;
  text: string;
  from: P;
  rise: number;
  /** Hang the tag under the toy: the front one of a pair, whose tag would cover the back one. */
  below?: boolean;
}) {
  const w = text.length * 6.4 + 14;
  const top = below ? fy + 18 : fy - rise;
  return (
    <g aria-hidden="true" data-callout={type}>
      <line
        x1={fx}
        y1={fy}
        x2={fx}
        y2={below ? top : top + 16}
        className="stroke-fg"
        strokeWidth="1"
      />
      <rect
        x={fx - w / 2}
        y={top}
        width={w}
        height="16"
        rx="4"
        className="fill-surface stroke-fg"
        strokeWidth="1.2"
      />
      <text
        x={fx}
        y={top + 11.5}
        textAnchor="middle"
        className="fill-fg font-mono text-[10px] font-bold"
      >
        {text}
      </text>
    </g>
  );
}

/**
 * Seen through, the toy shows what it holds: the pieces the blade cut, the stars the dome
 * pulled, the cards in the drawer, the cards in the lens. Drawn from the bench's own setting,
 * the same numbers its slot says in words.
 */
function Inside({
  env,
  bench,
  type,
  x,
  y,
  h,
}: {
  env: Env;
  bench: Bench;
  type: BlockType;
  x: number;
  y: number;
  h: number;
}): ReactNode {
  const params = slotParams(env, bench, type);
  const topK = Math.min(typeof params.top_k === "number" ? params.top_k : 0, 10);
  const g = (children: ReactNode) => (
    <g
      aria-hidden="true"
      data-internal={type}
      strokeWidth="1"
      strokeLinejoin="round"
      className="stroke-fg"
    >
      {children}
    </g>
  );
  const sheet = (x0: number, y0: number, w: number, d: number, z: number, cls = "fill-surface") => (
    <polygon className={cls} points={quad(x0, y0, w, d, z)} />
  );

  switch (type) {
    case "input":
      // The question waiting on its slip.
      return g(
        <>
          {sheet(x + 0.4, y + 0.4, 0.8, 0.8, 0.15)}
          {sheet(x + 0.5, y + 0.55, 0.6, 0.06, 0.16, "fill-fg-muted")}
          {sheet(x + 0.5, y + 0.8, 0.45, 0.06, 0.16, "fill-fg-muted")}
        </>,
      );
    case "corpus":
      // The volumes' pages, stacked.
      return g([0.1, 0.2, 0.3].map((z) => <g key={z}>{sheet(x + 0.3, y + 0.3, 1.0, 1.0, z)}</g>));
    case "chunker": {
      // The sheet as the blade leaves it: one piece between every two cuts.
      const size = typeof params.chunk_size === "number" ? params.chunk_size : 1024;
      const edges = [0, ...bladeCuts(size), 100];
      return g(
        edges.slice(0, -1).map((from, i) => {
          const to = edges[i + 1] ?? 100;
          const x0 = x + 0.2 + (1.2 * from) / 100 + 0.02;
          const w = Math.max((1.2 * (to - from)) / 100 - 0.04, 0.02);
          return (
            <polygon
              key={from}
              data-piece=""
              className="fill-surface"
              points={quad(x0, y + 0.35, w, 0.9, 0.1 + (i % 2) * 0.05)}
            />
          );
        }),
      );
    }
    case "vector_search": {
      // The stars of the index; the ones the dome pulls are lit.
      const stars = Array.from({ length: 12 }, (_, i) => {
        const [sx, sy] = iso(x + 0.25 + (i % 4) * 0.37, y + 0.3 + Math.floor(i / 4) * 0.45, 0.35);
        const pulled = i < topK;
        return (
          <circle
            key={i}
            data-star={pulled ? "pulled" : "left"}
            cx={sx}
            cy={sy}
            r={pulled ? 2.6 : 1.8}
            className={pulled ? "fill-brand" : "fill-surface"}
          />
        );
      });
      return g(stars);
    }
    case "bm25_search":
      // The index cards standing in the drawer; the ones it pulls stand taller.
      return g(
        Array.from({ length: 8 }, (_, i) => {
          const [cx, cy] = iso(x + 0.25 + i * 0.16, y + 0.8, 0.1);
          const tall = i < topK;
          return (
            <rect
              key={i}
              data-card-index={tall ? "pulled" : "left"}
              x={cx - 2}
              y={cy - (tall ? 16 : 10)}
              width="4"
              height={tall ? 16 : 10}
              className={tall ? "fill-brand-tint" : "fill-surface"}
            />
          );
        }),
      );
    case "fusion": {
      const [ax, ay] = iso(x + 0.3, y + 0.3, 0.3);
      const [bx, by] = iso(x + 0.3, y + 1.3, 0.3);
      const [cx, cy] = iso(x + 1.3, y + 0.8, 0.3);
      return g(
        <path
          d={`M${ax} ${ay}L${cx} ${cy}L${bx} ${by}`}
          className="fill-none stroke-brand"
          strokeWidth="2"
        />,
      );
    }
    case "rerank":
      return g(
        [0, 1, 2].map((i) => (
          <g key={i}>
            {sheet(
              x + 0.3,
              y + 0.3 + i * 0.35,
              1.0 - i * 0.25,
              0.22,
              0.2,
              i === 0 ? "fill-brand-tint" : "fill-surface",
            )}
          </g>
        )),
      );
    case "context_packer":
      // The bin's floor, ruled: what fits in its token budget.
      return g(
        [0.35, 0.7, 1.05].map((d) => {
          const [ax, ay] = iso(x + 0.2, y + d, 0.1);
          const [bx, by] = iso(x + 1.4, y + d, 0.1);
          return <line key={d} x1={ax} y1={ay} x2={bx} y2={by} className="stroke-fg-muted" />;
        }),
      );
    case "llm":
      // The cards behind the lens, as the slots hold them.
      return g(
        bench.cards.map((card, i) => {
          const [cx, cy] = iso(x + 0.35 + i * 0.45, y + 0.8, 0.15);
          return (
            <rect
              key={i}
              data-inner-card={card === null ? "off" : "on"}
              x={cx - 4}
              y={cy - 14}
              width="8"
              height="14"
              rx="1"
              className={card === null ? "fill-surface [stroke-dasharray:2_2]" : "fill-brand-tint"}
            />
          );
        }),
      );
    case "output":
      return g(
        [0.4, 0.7, 1.0].map((d) => (
          <g key={d}>
            {sheet(x + 0.3, y + d, d === 1.0 ? 0.6 : 1.0, 0.08, h * 0.5, "fill-fg-muted")}
          </g>
        )),
      );
  }
}

function Lock({ at: [x, y] }: { at: P }) {
  return (
    <g aria-hidden="true" className="fill-surface stroke-fg-muted" strokeWidth="1.2">
      <rect x={x + 3} y={y - 4} width="8" height="7" rx="1" />
      <path d={`M${x + 5} ${y - 4}v-2a2 2 0 0 1 4 0v2`} className="fill-none" />
    </g>
  );
}

/** What stands on a toy's box: its setting as a picture. Every value here is said in its slot. */
function Dress({
  env,
  bench,
  type,
  x,
  y,
  h,
  answer,
  packed,
}: {
  env: Env;
  bench: Bench;
  type: BlockType;
  x: number;
  y: number;
  h: number;
  answer: "pass" | "fail" | null;
  packed: number;
}): ReactNode {
  const params = slotParams(env, bench, type);
  const [tx, ty] = iso(x + FOOT / 2, y + FOOT / 2, h);
  const g = (children: ReactNode) => (
    <g aria-hidden="true" strokeWidth="1.2" strokeLinejoin="round" className="stroke-fg">
      {children}
    </g>
  );
  const topK = Math.min(typeof params.top_k === "number" ? params.top_k : 0, 10);

  switch (type) {
    case "input":
      // The counter bell.
      return g(
        <>
          <path d={`M${tx - 11} ${ty}a11 11 0 0 1 22 0z`} className="fill-warning-tint" />
          <circle cx={tx} cy={ty - 13} r="2.5" className="fill-fg" />
        </>,
      );
    case "corpus":
      // One standing volume per document; a superseded one (L2's 2019) shorter, in warning.
      return g(
        env.level.corpus.map((doc, i) => (
          <Box
            key={doc}
            x={x + 0.25 + i * 0.6}
            y={y + 0.5}
            z={h}
            w={0.4}
            d={0.7}
            h={doc.includes("2019") ? 0.6 : 0.9}
            top={doc.includes("2019") ? "fill-warning-tint" : "fill-brand-tint"}
          />
        )),
      );
    case "chunker": {
      // A sheet on the cutting board, a red line for every cut the blade makes.
      const size = typeof params.chunk_size === "number" ? params.chunk_size : 1024;
      return g(
        <>
          <polygon className="fill-surface" points={quad(x + 0.15, y + 0.3, 1.3, 1.0, h)} />
          {bladeCuts(size).map((at) => {
            const cx = x + 0.15 + (1.3 * at) / 100;
            const [ax, ay] = iso(cx, y + 0.2, h);
            const [bx, by] = iso(cx, y + 1.4, h);
            return (
              <line
                key={at}
                data-gauge-cut=""
                x1={ax}
                y1={ay}
                x2={bx}
                y2={by}
                className="stroke-danger"
                strokeWidth="1.6"
              />
            );
          })}
          <Box x={x + 1.5} y={y + 0.2} z={h} w={0.08} d={1.2} h={0.55} top="fill-line-strong" />
        </>,
      );
    }
    case "vector_search":
      // The star dome; a hook hangs off its front edge for every passage it pulls.
      return g(
        <>
          <path d={`M${tx - 22} ${ty}a22 16 0 0 1 44 0z`} className="fill-brand-tint" />
          <circle cx={tx - 6} cy={ty - 8} r="1.3" className="fill-fg" />
          <circle cx={tx + 7} cy={ty - 11} r="1.3" className="fill-fg" />
          {Array.from({ length: topK }, (_, i) => {
            const [hx, hy] = iso(x + 0.15 + (1.3 * (i + 0.5)) / topK, y + FOOT, h);
            return (
              <path
                key={i}
                data-gauge-hook=""
                d={`M${hx} ${hy}v8a2 2 0 0 0 4 0`}
                className="fill-none"
              />
            );
          })}
        </>,
      );
    case "bm25_search": {
      // The card drawer: two drawer fronts and a tab for every passage it pulls.
      const front = (z: number) => {
        const [ax, ay] = iso(x + 0.2, y + FOOT, z);
        const [bx, by] = iso(x + 1.4, y + FOOT, z);
        return <line x1={ax} y1={ay} x2={bx} y2={by} />;
      };
      return g(
        <>
          {front(h * 0.35)}
          {front(h * 0.7)}
          {Array.from({ length: topK }, (_, i) => {
            const [hx, hy] = iso(x + 0.15 + (1.3 * (i + 0.5)) / topK, y + 0.8, h);
            return (
              <rect
                key={i}
                data-gauge-hook=""
                x={hx - 1.5}
                y={hy - 7}
                width="3"
                height="7"
                className="fill-surface"
              />
            );
          })}
        </>,
      );
    }
    case "fusion":
      return g(
        <path d={`M${tx - 16} ${ty - 22}h32l-11 13v9h-10v-9z`} className="fill-brand-tint" />,
      );
    case "rerank":
      return g(
        <>
          <line x1={tx + 4} y1={ty - 6} x2={tx + 12} y2={ty + 2} strokeWidth="3" />
          <circle cx={tx - 3} cy={ty - 13} r="9" className="fill-surface" />
        </>,
      );
    case "context_packer":
      // The open bin: one sheet inside per passage packed, the stamp on its lid when it stamps.
      return g(
        <>
          <polygon className="fill-line" points={quad(x + 0.15, y + 0.15, 1.3, 1.3, h)} />
          {Array.from({ length: Math.min(packed, 8) }, (_, i) => (
            <polygon
              key={i}
              data-gauge-sheet=""
              className="fill-surface"
              points={quad(x + 0.3, y + 0.3, 1.0, 1.0, h - 0.5 + i * 0.06)}
            />
          ))}
          {params.cite_ids === true && (
            <g data-gauge-stamp="">
              <Box x={x + 1.1} y={y - 0.1} z={h} w={0.35} d={0.35} h={0.3} top="fill-brand" />
            </g>
          )}
        </>,
      );
    case "llm":
      // The lens, and its three card slots standing beside it, filled for each card chosen.
      return g(
        <>
          <path d={`M${tx - 18} ${ty + 2}l10 -24l10 24z`} className="fill-brand-tint" />
          {bench.cards.map((card, i) => (
            <rect
              key={i}
              data-gauge-card={card === null ? "off" : "on"}
              x={tx + 2 + i * 7}
              y={ty - 18}
              width="5"
              height="14"
              rx="1"
              className={
                card === null ? "fill-surface stroke-fg-muted [stroke-dasharray:2_2]" : "fill-brand"
              }
            />
          ))}
        </>,
      );
    case "output": {
      // The answer board, upright, with the followed case's verdict on it.
      const [mx, my] = iso(x + 0.8, y + 0.8, h + 0.5);
      const board = pts([
        iso(x + 0.2, y + 0.8, h),
        iso(x + 1.4, y + 0.8, h),
        iso(x + 1.4, y + 0.8, h + 1.0),
        iso(x + 0.2, y + 0.8, h + 1.0),
      ]);
      const fill =
        answer === "pass"
          ? "fill-success-tint"
          : answer === "fail"
            ? "fill-danger-tint"
            : "fill-surface";
      return g(
        <>
          <polygon points={board} className={fill} />
          {answer === "pass" && (
            <path
              data-verdict="pass"
              d={`M${mx - 7} ${my}l5 5l9 -10`}
              className="fill-none stroke-success"
              strokeWidth="2.5"
            />
          )}
          {answer === "fail" && (
            <path
              data-verdict="fail"
              d={`M${mx - 6} ${my - 6}l12 12M${mx + 6} ${my - 6}l-12 12`}
              className="stroke-danger"
              strokeWidth="2.5"
            />
          )}
          {answer === null && (
            <>
              <line x1={mx - 10} y1={my - 3} x2={mx + 6} y2={my + 1} />
              <line x1={mx - 10} y1={my + 3} x2={mx + 2} y2={my + 6} />
            </>
          )}
        </>,
      );
    }
  }
}
