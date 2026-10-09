import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useActiveTheme } from "~/features/theme/context";
import { REDUCED_MOTION, useMediaQuery } from "~/lib/useMediaQuery";

import { useHub } from "../store";
import { blueprintPieces, blueprintViewBox, entryFocus, type Piece } from "./blueprint";
import { APPEAR_MS, FADE_MS, progress, sceneLoad, STAGE, STEPS, useSceneLoad } from "./sceneLoad";

/** One label per stage (sceneLoad STAGE): the step being waited for. */
export const LABELS = [
  "Đang mở sa bàn",
  "Đang tải bộ dựng 3D",
  "Đang bật bàn vẽ 3D",
  "Đang dựng nhà và trồng cây",
  "Đang lên màu",
  "Xong rồi, mời bạn vào",
] as const;

const SLOW =
  'Hôm nay sa bàn hơi nặng. Trong lúc chờ, mọi việc vẫn làm được qua nút "Các khu" ở góc trên.';

/**
 * Cô Lan's tips (art §8.6): a correct AI fact, at most 120 characters, tied to a zone or lesson.
 * Only fictional characters speak.
 */
export const TIPS = [
  "Model không tự biết quy chế của trường mình. Phải đưa đúng trang vào ngữ cảnh thì nó mới trích được.",
  'Câu trả lời tốt đôi khi là "tài liệu không nói". Mình quý trợ lý biết dừng hơn trợ lý bịa cho đủ câu.',
  'Chunk quá vụn thì mất mạch, quá to thì loãng và tốn token. Màn "Lược dao chunk" là để tìm chỗ cắt vừa tay.',
  "Embedding biến một câu thành một dãy số. Hai câu gần nghĩa có dãy số gần nhau, kể cả khi không chung chữ nào.",
  'Hỏi đúng "Điều 47" thì tìm theo từ khoá chắc tay hơn tìm theo nghĩa. Tìm kiếm lai giữ được cả hai.',
  "Truy xuất vớt về cả rổ đoạn văn. Xếp hạng lại mới đưa đoạn đáng đọc nhất lên đầu.",
  "Model đọc theo token chứ không theo chữ. Cùng một ý, câu tiếng Việt thường tốn nhiều token hơn câu tiếng Anh.",
  "Với nhiều model, ý nằm giữa một ngữ cảnh rất dài dễ bị bỏ sót hơn ý ở đầu hay ở cuối.",
  "Hạ nhiệt độ không làm model hết bịa. Nó chỉ làm câu trả lời bớt ngẫu nhiên.",
  'Tài liệu có thể giấu câu "bỏ qua mọi chỉ dẫn". Ở Tháp canh, bạn sẽ dạy agent coi tài liệu là dữ liệu, không phải lệnh.',
  "Câu dễ không cần model lớn nhất. Gửi sang model nhỏ thường nhanh hơn và rẻ hơn.",
  "Hội thoại càng dài, mỗi lượt càng gửi lại nhiều lịch sử. Tóm tắt phần cũ giúp ngữ cảnh gọn mà vẫn giữ ý chính.",
] as const;

/** Cô Lan's line in the pre-rendered shell, which cannot know which tip is next. */
export const GREETING = "Chào bạn, mình đang bày sa bàn ra đây.";

const SLOW_MS = 10_000;
const ANNOUNCE_MS = 1000;
const TIP_MS = 8000;
const TICK_MS = 100;

const TIP_KEY = "vg-tip";
/** The tip the next loader starts with, remembered per viewer so each visit shows unseen ones. */
let nextTip: number | undefined;
function firstTip(): number {
  if (nextTip === undefined) {
    try {
      const stored = Number(localStorage.getItem(TIP_KEY));
      nextTip = Number.isInteger(stored) && stored > 0 ? stored % TIPS.length : 0;
    } catch {
      nextTip = 0; // storage blocked: rotate within this page session only
    }
  }
  return nextTip;
}

const ROOT = "pointer-events-none absolute inset-0 z-15 overflow-hidden";

/**
 * "Sa bàn đang dựng" (art §8.4): from the first paint of /play until the first WebGL frame, a
 * pale diorama of the campus builds itself on the sky colour, exactly where the 3D scene will
 * appear, with a card naming the real loading step and a tip from cô Lan. `shell` is the
 * pre-rendered version (HydrateFallback): fixed step 1, no diorama, no store.
 */
export function SceneLoader({ shell = false }: { shell?: boolean }) {
  if (shell) {
    return (
      <div data-scene-loader="" className={`${ROOT} animate-appear bg-scene`}>
        <Card stage={STAGE.open} tip={GREETING} live={false} slow={false} lifted={false} />
        <p role="status" className="sr-only" />
      </div>
    );
  }
  return <LiveLoaderGate />;
}

/** Unmounts the live loader once it has left, so none of its timers or listeners outlive it. */
function LiveLoaderGate() {
  // A failed scene stays failed for the page session: later entries skip the loader.
  const [gone, setGone] = useState(() => sceneLoad.getState().failed);
  return gone ? null : <LiveLoader onGone={() => setGone(true)} />;
}

function LiveLoader({ onGone }: { onGone: () => void }) {
  const stage = useSceneLoad((s) => s.stage);
  const since = useSceneLoad((s) => s.since);
  const begun = useSceneLoad((s) => s.begun);
  const failed = useSceneLoad((s) => s.failed);
  const reduced = useMediaQuery(REDUCED_MOTION);
  const lifted = useHub((s) => !s.dialog && s.nearby !== null);
  const { landmark } = useActiveTheme().campus;

  // Read once per entry, like ?debug=frames: keep the diorama at 50% over the live scene.
  const [debug] = useState(
    () => new URLSearchParams(window.location.search).get("debug") === "loader",
  );
  const [focus] = useState(() => entryFocus(window.location.search));
  // A loader remounted after hydration continues the shell's appear timing (art §8.4).
  const [delay] = useState(() =>
    Math.max(0, APPEAR_MS - (performance.now() - sceneLoad.getState().begun)),
  );

  const done = stage >= STAGE.done || failed;
  const leaving = done && !debug;
  /** Done after the appear delay: the loader was seen, so it fades; otherwise it never shows. */
  const seen = since - begun >= APPEAR_MS;

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onGone, seen ? FADE_MS + 20 : 0);
    return () => window.clearTimeout(timer);
  }, [leaving, seen, onGone]);

  // Diorama progress, as the highest piece threshold reached (re-renders only on a change).
  const pieces = useMemo(() => blueprintPieces(landmark, focus), [landmark, focus]);
  const thresholds = useMemo(
    () => [...new Set(pieces.map((p) => p.at))].sort((a, b) => a - b),
    [pieces],
  );
  const [ticked, setTicked] = useState(0);
  // A signal draws everything owed to it in the same render, in its final state: the main
  // thread may freeze right after (the scene builds its geometry, then its first frame), and
  // SVG animations would stay on their first keyframe meanwhile (buildings flat, trees dots).
  // Only pieces the ticker reveals within a stage animate.
  const floor = thresholds.findLast((at) => at <= progress(stage, 0, false)) ?? 0;
  const complete = done || reduced;
  useEffect(() => {
    if (complete) return;
    const id = window.setInterval(() => {
      const p = progress(stage, performance.now() - since, false);
      setTicked(thresholds.findLast((at) => at <= p) ?? 0);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [complete, stage, since, thresholds]);

  // One polite live region: a step is announced once it has lasted a second, the slow notice
  // once at 10 s; fast steps are never announced.
  const [said, setSaid] = useState("");
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (done) return;
    const timer = window.setTimeout(
      () => setSaid(LABELS[stage] ?? ""),
      Math.max(0, ANNOUNCE_MS - (performance.now() - since)),
    );
    return () => window.clearTimeout(timer);
  }, [done, stage, since]);
  useEffect(() => {
    if (done) return;
    const timer = window.setTimeout(
      () => {
        setSlow(true);
        setSaid(SLOW);
      },
      Math.max(0, SLOW_MS - (performance.now() - begun)),
    );
    return () => window.clearTimeout(timer);
  }, [done, begun]);

  const [tip, setTip] = useState(firstTip);
  useEffect(() => {
    nextTip = (tip + 1) % TIPS.length;
    try {
      localStorage.setItem(TIP_KEY, String(nextTip));
    } catch {
      // A per-viewer convenience only.
    }
  }, [tip]);
  useEffect(() => {
    const id = window.setInterval(() => setTip((t) => (t + 1) % TIPS.length), TIP_MS);
    return () => window.clearInterval(id);
  }, []);

  // The canvas fills the same box (absolute inset-0 of <main>), so the viewBox matches it.
  const root = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setBox((b) => (b?.width === width && b.height === height ? b : { width, height }));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (leaving && !seen) return null;
  // ?debug=loader keeps the diorama alone at 50% over the live scene, to check the alignment.
  const state = leaving
    ? "bg-scene animate-leave"
    : done
      ? "opacity-50"
      : `bg-scene ${delay > 0 ? "animate-appear" : ""}`;

  return (
    <div
      ref={root}
      data-scene-loader=""
      className={`${ROOT} ${state}`}
      // Client-only (CSSOM, allowed by style-src 'self'); never in pre-rendered HTML.
      style={delay > 0 && !leaving ? { animationDelay: `${delay}ms` } : undefined}
    >
      {box && (
        <svg
          aria-hidden="true"
          className="bp absolute inset-0 size-full animate-[vg-fade_300ms_ease-out_both]"
          viewBox={blueprintViewBox(box.width, box.height, focus)}
          preserveAspectRatio="xMidYMid meet"
        >
          {pieces.map((piece, i) => (
            <PieceShapes
              // A fixed list: pieces never reorder for a given landmark and focus.
              key={i}
              piece={piece}
              state={
                piece.kind === "base" || complete || piece.at <= floor
                  ? "is-set"
                  : piece.at <= ticked
                    ? "is-built"
                    : ""
              }
            />
          ))}
        </svg>
      )}
      {!(done && debug) && (
        <Card stage={stage} tip={TIPS[tip] ?? ""} live slow={slow} lifted={lifted} />
      )}
      <p role="status" className="sr-only">
        {said}
      </p>
    </div>
  );
}

const PieceShapes = memo(function PieceShapes({ piece, state }: { piece: Piece; state: string }) {
  return (
    <g className={`bp-pc k-${piece.kind} ${state}`}>
      {piece.shapes.map(({ tag: Tag, cls, attrs }, i) => (
        <Tag key={i} className={cls} {...attrs} />
      ))}
    </g>
  );
});

function Card(props: {
  stage: number;
  tip: string;
  /** Live tips slide in (art §7); the pre-rendered greeting is static. */
  live: boolean;
  slow: boolean;
  lifted: boolean;
}) {
  const { stage, tip, live, slow, lifted } = props;
  // Never over the HUD (top corners) nor the interact hint (bottom, shown on ?at= arrivals).
  const bottom = lifted
    ? "bottom-24"
    : "bottom-[max(1rem,env(safe-area-inset-bottom))] lg:bottom-6";
  return (
    <section
      aria-labelledby="scene-loader-label"
      className={`absolute inset-x-4 rounded-md border border-line-strong bg-surface p-4 sm:inset-x-auto sm:left-1/2 sm:w-md sm:-translate-x-1/2 ${bottom}`}
    >
      <div className="flex items-center gap-3">
        <StepMark stage={stage} />
        <div>
          <p id="scene-loader-label" className="text-sm leading-snug font-semibold text-fg">
            {LABELS[stage]}
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">{`Bước ${Math.min(stage + 1, STEPS)}/${STEPS}`}</p>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-3 border-t border-line pt-3">
        <LanAvatar />
        <div>
          <p className="text-xs font-semibold text-fg-muted">Cô Lan</p>
          <p key={tip} className={`mt-0.5 text-sm text-fg ${live ? "animate-enter" : ""}`}>
            {tip}
          </p>
          {slow && <p className="mt-2 text-sm text-fg-muted">{SLOW}</p>}
        </div>
      </div>
    </section>
  );
}

/** Top vertices of the logo's five blocks (favicon.svg, Wordmark.tsx), in build order. */
const BLOCKS = [
  [4, 3],
  [12, 3],
  [6, 6],
  [10, 6],
  [8, 9],
] as const;
const hex = (x: number, y: number) =>
  `M${x} ${y} ${x + 2} ${y + 1} ${x + 2} ${y + 3} ${x} ${y + 4} ${x - 2} ${y + 3} ${x - 2} ${y + 1}Z`;
const leftFace = (x: number, y: number) =>
  `M${x - 2} ${y + 1} ${x} ${y + 2} ${x} ${y + 4} ${x - 2} ${y + 3}Z`;
const topFace = (x: number, y: number) =>
  `M${x} ${y} ${x + 2} ${y + 1} ${x} ${y + 2} ${x - 2} ${y + 1}Z`;
const DASH = { strokeWidth: 0.35, strokeDasharray: "0.7 0.5" } as const;

/**
 * The logo tile, one block per real signal: solid blocks are done, dashed ones to come. The
 * block being waited for is its own HTML box, so its hover runs on the compositor and keeps
 * moving while the main thread builds the scene.
 */
function StepMark({ stage }: { stage: number }) {
  const waited = BLOCKS[stage];
  return (
    <span className="relative size-10 shrink-0">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-10">
        <rect width="16" height="16" rx="3.52" className="fill-ink" />
        {BLOCKS.map(([x, y], i) => {
          if (stage < i + 1) {
            return i === stage ? null : (
              <path
                key={`ghost-${i}`}
                d={hex(x, y)}
                className="fill-none stroke-on-ink-muted"
                strokeOpacity={0.6}
                {...DASH}
              />
            );
          }
          const tip = i === BLOCKS.length - 1;
          return (
            <g key={`block-${i}`} className="vb-snap">
              <path
                d={hex(x, y)}
                className={tip ? "fill-accent" : "fill-on-ink-muted"}
                fillOpacity={tip ? 1 : 0.7}
              />
              <path
                d={leftFace(x, y)}
                className={tip ? "fill-on-ink" : "fill-on-ink-muted"}
                fillOpacity={tip ? 0.2 : 1}
              />
              <path d={topFace(x, y)} className="fill-on-ink" fillOpacity={tip ? 0.38 : 1} />
            </g>
          );
        })}
      </svg>
      {waited && (
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="absolute inset-0 size-full animate-hover"
        >
          <path
            d={hex(waited[0], waited[1])}
            className="fill-none stroke-on-ink"
            strokeOpacity={0.85}
            {...DASH}
          />
        </svg>
      )}
    </span>
  );
}

/** Cô Lan: glasses, hair bun, cardigan and a book (art §5.8), in theme tokens. */
function LanAvatar() {
  return (
    <span className="size-8 shrink-0 overflow-hidden rounded-full">
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8">
        <rect width="32" height="32" className="fill-brand-tint" />
        <path d="M4 33c1-7 5-11 12-11s11 4 12 11z" className="fill-accent" />
        <rect x="12.5" y="24" width="7" height="9" rx="1" className="fill-brand" />
        <circle
          cx="16"
          cy="14.5"
          r="5.6"
          className="fill-surface stroke-line-strong"
          strokeWidth={0.6}
        />
        <path
          d="M10.4 14.2a5.6 5.6 0 0 1 11.2 0c-1.6-2.2-3.4-3.1-5.6-3.1s-4 .9-5.6 3.1z"
          className="fill-ink"
        />
        <circle cx="16" cy="7.6" r="2.3" className="fill-ink" />
        <g className="fill-none stroke-ink" strokeWidth={0.55}>
          <rect x="12.3" y="14.6" width="3" height="2" rx="0.6" />
          <rect x="16.7" y="14.6" width="3" height="2" rx="0.6" />
          <path d="M15.3 15.4h1.4" />
        </g>
      </svg>
    </span>
  );
}
