import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
} from "react";
import { Link, useParams } from "react-router";
import * as v from "valibot";

import { PageFrame } from "~/components/PageFrame";
import { buttonClass } from "~/components/ui/button";
import { useProjector } from "~/features/projector/projector";
import { recordStars, type Stars } from "~/features/progress/progress";

import { cancelRun, eventsUrl, newKey, postRun, previewRetrieval, type LevelPageData } from "./api";
import { benchFromGraph, graphFromBench, type Bench, type Env } from "./bench";
import { BenchSection, slotTargets } from "./BenchView";
import { Brief } from "./Brief";
import { BACK_TO_LEVELS, FIRST_TOUCH_VI, liveMessage, PROJECTOR_VI } from "./copy";
import { EMPTY_SLIP, isEmptySlip, type Slip } from "./guess";
import { previewableCase, shouldPreview } from "./preview";
import { parseRecorded, recordedUrl, replayRecorded } from "./recorded";
import { parseViz, vizUrl, type VizData } from "./vizData";
import { lastPassing } from "./runHistory";
import { Results } from "./Results";
import { SampleResult } from "./SampleResult";
import {
  cappedRun,
  frameAction,
  isActive,
  runReducer,
  sampleVerdict,
  type BenchRun,
  type RunAction,
  type RunView,
} from "./run";
import { RunPanel, type RequestState, type StopState, type Summary } from "./RunPanel";
import type { Fact } from "./schema";
import {
  EVENT_TYPES,
  GraphSchema,
  type BlockType,
  type Graph,
  type Issue,
  type PublicLevel,
} from "./schema";
import {
  loadHistory,
  recordExtras,
  loadSaved,
  loadSlip,
  recordRun,
  save,
  saveSlip,
  type RunMark,
} from "./storage";
import { HintLadder, useHints } from "./HintLadder";
import { firstTouches, firstTouchTypes, type Pointer } from "./hints";
import { useQuota } from "./useQuota";
import { errorsOf, validateGraph } from "./validate";

const levelsUrl = (zoneId: string | null) => (zoneId ? `/play/${zoneId}` : "/play");

/** `/play/:zoneId/:levelId`: the workbench, or the not-found / error state (§8.7). */
export function LevelPage({ data, onRetry }: { data: LevelPageData; onRetry: () => void }) {
  const back = levelsUrl(data.zoneId);
  switch (data.kind) {
    case "ready":
      return (
        <PageFrame back={back} backLabel={BACK_TO_LEVELS} width="6xl">
          <WorkbenchPage
            key={data.env.level.id}
            env={data.env}
            starter={data.starter}
            back={back}
          />
        </PageFrame>
      );
    case "not-found":
      return (
        <PageFrame back={back} backLabel={BACK_TO_LEVELS}>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Không tìm thấy màn này</h1>
          <p className="mt-3 text-fg-muted">Đường dẫn không khớp màn nào của khu.</p>
          <Link to={back} className={buttonClass("primary", "mt-8")}>
            {BACK_TO_LEVELS}
          </Link>
        </PageFrame>
      );
    case "error":
      return (
        <PageFrame back={back} backLabel={BACK_TO_LEVELS}>
          <div role="alert" className="rounded-md border border-line bg-warning-tint p-5">
            <h1 className="text-base font-semibold text-fg">Chưa tải được màn này.</h1>
            <p className="mt-1 text-sm text-fg-muted">Kiểm tra kết nối rồi thử lại.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={onRetry} className={buttonClass("secondary")}>
                Thử lại
              </button>
              <Link to={back} className={buttonClass("quiet")}>
                {BACK_TO_LEVELS}
              </Link>
            </div>
          </div>
        </PageFrame>
      );
  }
}

/** Static loading frame (no shimmer), shaped like the workbench (art §9.4). */
export function LevelPageSkeleton() {
  const block = "rounded-sm bg-subtle";
  const { zoneId } = useParams();
  return (
    <PageFrame back={levelsUrl(zoneId ?? null)} backLabel={BACK_TO_LEVELS} width="6xl">
      <div aria-hidden="true">
        <div className={`h-[5px] w-12 ${block}`} />
        <div className={`mt-4 h-9 w-64 ${block}`} />
        <div className={`mt-4 h-4 w-full max-w-prose ${block}`} />
        <div className={`mt-2 h-4 w-2/3 max-w-prose ${block}`} />
        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-28 rounded-md bg-subtle" />
            ))}
          </div>
          <div className="h-64 rounded-md bg-subtle" />
        </div>
      </div>
      <p role="status" className="sr-only">
        Đang tải màn
      </p>
    </PageFrame>
  );
}

/** Opens the run's event stream; the browser reconnects with Last-Event-ID on its own (§6.2). */
function useRunStream(runId: string | null, attempt: number, dispatch: Dispatch<RunAction>) {
  useEffect(() => {
    if (!runId) return;
    const source = new EventSource(eventsUrl(runId));
    let warned = false;
    for (const type of EVENT_TYPES) {
      source.addEventListener(type, (message: MessageEvent<string>) => {
        const action = frameAction(type, message.data, Number(message.lastEventId));
        if (action?.event.type !== type) {
          if (!warned) console.warn(`Sự kiện ${type} không đúng định dạng.`);
          warned = true;
        }
        if (!action) return;
        dispatch(action);
        const { type: kind } = action.event;
        if (kind === "run.finished" || kind === "run.failed") source.close();
      });
    }
    source.onopen = () => dispatch({ kind: "stream", state: "live" });
    source.onerror = () =>
      dispatch({
        kind: "stream",
        state: source.readyState === EventSource.CLOSED ? "lost" : "reconnecting",
      });
    return () => source.close();
  }, [runId, attempt, dispatch]);
}

/**
 * Leaving mid-run cancels it (§2.2): the server allows one run at a time, so an abandoned run
 * would burn AI calls nobody watches and answer 429 to everyone, the player included. Returns
 * `left`, true once the page is gone, so a POST that answers after that cancels its own run.
 */
function useCancelOnLeave(run: RunView | null) {
  const active = useRef<string | null>(null);
  const left = useRef(false);
  useEffect(() => {
    active.current = run && isActive(run) ? run.runId : null;
  }, [run]);
  useEffect(() => {
    left.current = false;
    const cancel = () => {
      const runId = active.current;
      if (!runId) return;
      active.current = null;
      void cancelRun(runId, { keepalive: true });
    };
    window.addEventListener("pagehide", cancel);
    return () => {
      left.current = true;
      window.removeEventListener("pagehide", cancel);
      cancel();
    };
  }, []);
  return left;
}

/**
 * Focus, then bring the whole target into view: Chromium does not scroll on focus when the
 * target is already partly visible (a heading on the last line at 375 px).
 */
function focusOn(target: HTMLElement | null) {
  target?.focus();
  target?.scrollIntoView({ block: "nearest" });
}

/** Moves focus once the target has rendered (headings use tabIndex -1); first match wins. */
function useFocusLater() {
  const [request, setRequest] = useState<{ selectors: readonly string[]; n: number } | null>(null);
  useEffect(() => {
    if (!request) return;
    for (const selector of request.selectors) {
      const target = document.querySelector<HTMLElement>(selector);
      if (target) {
        focusOn(target);
        return;
      }
    }
  }, [request]);
  return (selectors: string | readonly string[]) =>
    setRequest((last) => ({
      selectors: typeof selectors === "string" ? [selectors] : selectors,
      n: (last?.n ?? 0) + 1,
    }));
}

/**
 * Saves each scored run's stars for the campus (N9, campus-scene v0.3 §13.5), once per run.
 * Best effort: a blocked storage or a bad id must never cost the player the results on screen.
 */
export function useRecordStars(level: PublicLevel, run: RunView | null) {
  // §3.3: a run the server's daily cap cut short "không tính là một lần thử sao … không ghi đè
  // kết quả sao". It is still graded and still on screen; it is just not a result.
  //
  // A scope at all means the run is not the player's attempt: a sample run earns no stars, and
  // a replayed log (N4) carries the real `run.scored` of whoever recorded it.
  const scoredRun = run?.score && run.scope === undefined && !cappedRun(run) ? run.runId : null;
  const stars = run?.score?.stars;
  useEffect(() => {
    if (!scoredRun || stars === undefined) return;
    try {
      recordStars(level.zone, level.id, stars as Stars); // validates; throws on a bad entry
    } catch (error) {
      console.warn("Không lưu được số sao của màn.", error);
    }
  }, [scoredRun, stars, level.zone, level.id]);
}

/**
 * Keeps a summary of each scored run of this level (N3), once per run.
 *
 * Scored runs only. A sample run earns no stars and grades three cases instead of ten, so
 * mixing the two would put rows of different widths in one regression strip and make "the last
 * passing configuration" mean two things.
 *
 * Only the verdicts go in -- never a fact or a gold reveal. Those reach the client per case
 * role, and a copy in localStorage would outlive the gate the server and the results screen
 * both apply.
 *
 * `ranBody` is the graph that was POSTED, not the bench as it stands. Only the run id decides
 * when to write, so a caller that hands over a changing body still gets one entry per run
 * instead of one per knob turn.
 */
export function useRecordHistory(
  levelId: string,
  run: RunView | null,
  ranBody: string | null,
  onWritten?: (runs: RunMark[]) => void,
) {
  // Same rule as the stars, and for the strip there is a second reason: a truncated run has
  // fewer rows than the others, so it would not be comparable with them.
  const scoredRun = run?.score && run.scope === undefined && !cappedRun(run) ? run.runId : null;
  // The run id of the entry already written. Stating the invariant this way keeps the dep list
  // complete -- a fresh `cases` object or an edited body re-runs the effect, and the guard, not
  // a hand-trimmed dep list, is what stops a second entry for one run.
  const written = useRef<string | null>(null);
  useEffect(() => {
    if (scoredRun === null || scoredRun === written.current) return;
    // The score check narrows the type -- a non-null `scoredRun` already means there is one.
    // A missing body is the real condition: nobody knows which graph ran.
    if (!run?.score || ranBody === null) return;
    written.current = scoredRun;
    recordRun(levelId, {
      body: ranBody,
      at: Date.now(),
      stars: run.score.stars as Stars,
      tokens: run.score.tokens,
      budget: run.score.budget,
      // Graded cases only. An ungraded one has no verdict, and `?? false` would write it
      // into the strip as the player's failure -- a result the run never reached.
      cases: run.cases.flatMap((c) =>
        c.graded ? [{ n: c.n, role: c.role, passed: c.graded.passed }] : [],
      ),
    });
    // The store is write-only otherwise: the strip needs the list it just joined.
    onWritten?.(loadHistory(levelId));
    // `onWritten` is in the deps, which is honest: a fresh closure re-runs the effect, and the
    // guard above -- not a trimmed dep list -- is what keeps it to one entry per run.
  }, [scoredRun, run, ranBody, levelId, onWritten]);
}

/**
 * N2: Mở ca is one two-step run. The cheap sample run goes first; clearing its gate starts the
 * star run, once, on `ranBody` -- the graph that actually cleared it, not the bench as it
 * stands. A knob turned while the samples were running must not ride into the star run, and the
 * server only prices the second step at 7 calls when the two graphs are identical (§3.1).
 *
 * `samplesOnly`: the day's pool covered the samples and not the shift (roadmap-v0.4 §5.1), so the
 * button said "Thử 3 câu mẫu" and the samples are all the player asked for.
 */
export function useStarRunAfterSample(
  run: RunView | null,
  ranBody: string | null,
  start: (body: string) => void,
  samplesOnly = false,
) {
  const chained = useRef<string | null>(null);
  useEffect(() => {
    if (run === null || ranBody === null || samplesOnly) return;
    if (sampleVerdict(run) !== "passed" || chained.current === run.runId) return;
    chained.current = run.runId;
    start(ranBody);
  }, [run, ranBody, start, samplesOnly]);
}

/**
 * N2: the sample run that most recently finished, kept past the star run it opened.
 *
 * Its summary promises "run chấm sao đang chạy tiếp"; dropping it the moment that run starts
 * would make the sentence something nobody can read. A fresh Mở ca (run back to null) forgets
 * it, so one shift never shows the previous shift's samples.
 */
export function useLastSample(run: RunView | null): RunView | null {
  // Three stages, and the middle one is what a plain "remember the last sample" misses: a
  // second Mở ca resets the run rather than clearing it, so while its samples are running the
  // previous shift's "Cả 3 câu mẫu đạt" would still be sitting on screen.
  const stage = run === null ? "gone" : sampleVerdict(run) !== null ? "done" : run.scope;
  const [sample, setSample] = useState<RunView | null>(null);
  const [at, setAt] = useState<string | null>(null);
  // Adjusted during render, not in an effect: this is state derived from a change in the run,
  // not a system being synchronised, and an effect would commit the stale value for a frame
  // first. React re-runs the component before painting, so nobody sees the in-between.
  const key = `${run?.runId ?? ""}:${stage ?? "sao"}`;
  if (at !== key) {
    setAt(key);
    if (stage === "done") setSample(run);
    else if (stage !== undefined) setSample(null); // "gone", or a sample run still going
  }
  return sample;
}

/**
 * N22: the level's static visualisation data (N21), loaded unprompted.
 *
 * It is the free deterministic preview, so by the time the player drags the blade the strip has
 * to be able to redraw without asking anyone. Null leaves the level playable without it.
 */
export function useStaticViz(level: PublicLevel): VizData | null {
  const [data, setData] = useState<VizData | null>(null);
  useEffect(() => {
    // An AbortController rather than an "is it still mounted" flag: leaving the level should
    // drop the request, not just its answer.
    const stop = new AbortController();
    void (async () => {
      try {
        const response = await fetch(vizUrl(level.id), {
          headers: { Accept: "application/json" },
          signal: stop.signal,
        });
        setData(parseViz(level.id, level.version, await response.json()));
      } catch {
        /* gone, offline, or not JSON: the level plays without the strip */
      }
    })();
    return () => {
      stop.abort();
    };
  }, [level.id, level.version]);
  return data;
}

/**
 * N4: the level's recorded run, fetched the first time the player asks for it.
 *
 * It comes off a static file rather than the API on purpose: it is what covers the minute a
 * sleeping Render takes to wake (X9), so it must not need the API to be awake. A log that is
 * missing, stale or some other level's leaves `run` null -- the level is still playable, it
 * just opens without the replay.
 */
export function useRecordedRun(level: PublicLevel) {
  const [run, setRun] = useState<RunView | null>(null);
  const [failed, setFailed] = useState(false);
  const asked = useRef(false);
  const show = useCallback(async () => {
    if (asked.current) return;
    asked.current = true;
    let raw: unknown;
    try {
      // No status check: `parseRecorded` is the one gate, and an error page is not a log --
      // it either fails to parse as JSON here or fails the contract there.
      raw = await (
        await fetch(recordedUrl(level.id), { headers: { Accept: "application/json" } })
      ).json();
    } catch {
      setFailed(true);
      return;
    }
    const log = parseRecorded(level.id, level.version, raw);
    const replayed = log && replayRecorded(log);
    if (!replayed) setFailed(true);
    setRun(replayed ?? null);
  }, [level.id, level.version]);
  return { run, failed, show };
}

/** The graph of the run on show; ours, so it parses, but checked like any other JSON. */
function parseGraph(body: string | null): Graph | null {
  if (body === null) return null;
  const parsed = v.safeParse(GraphSchema, JSON.parse(body));
  return parsed.success ? parsed.output : null;
}

/** A range drag fires per step; one picture per settled knob is the point. */
const PREVIEW_DEBOUNCE_MS = 250;

/**
 * The retrieval preview behind the dome (vom-sao-v0.1 §4 phase 2). Debounced, because a range
 * input fires on every step of a drag and the point is one picture per settled knob, not sixty.
 * A failed preview is simply no preview: the bench never waits on it and never reports it.
 */
export function usePreview(
  levelId: string,
  caseId: string | null,
  body: string,
  wanted: boolean,
): Readonly<Record<string, Extract<Fact, { kind: "retrieved" }>>> | null {
  // Stored with the bench and case it describes, so a result can never outlive them. Held as
  // free-floating state, it went on being drawn after the knob moved: the dome kept the old
  // pull and printed its cosines beside a slot already reading the new value -- a quarter of a
  // second on a warm API, and the 33 s of a cold Render free instance.
  const [got, setGot] = useState<{
    key: string;
    nodes: Readonly<Record<string, Extract<Fact, { kind: "retrieved" }>>>;
  } | null>(null);
  const key = `${caseId ?? ""} ${body}`;
  useEffect(() => {
    if (!wanted || !caseId) return;
    let live = true;
    const drop = new AbortController();
    const timer = setTimeout(() => {
      void previewRetrieval(levelId, caseId, body, drop.signal).then((result) => {
        // Only a success is stored, and only under its own key. A failure needs no clearing --
        // the key already withholds another bench's picture -- and clearing would throw away a
        // result the player gets back the moment they undo the knob.
        if (live && result.ok) setGot({ key, nodes: result.nodes });
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
      drop.abort(); // a request already sent is work the instance can stop doing
    };
  }, [levelId, caseId, body, wanted, key]);
  // Derived, not cleared in the effect: setting state synchronously there cascades renders,
  // and a preview nobody wants -- or one for a bench that has moved on -- is not returned.
  return wanted && got?.key === key ? got.nodes : null;
}

/**
 * Lesson plan R4: the covered outcome and the one control that uncovers it. It takes focus when
 * the run ends, so the teacher's Space or Enter opens it without reaching for the mouse.
 */
function RevealGate({ onReveal }: { onReveal: () => void }) {
  return (
    <section aria-labelledby="wb-reveal-title" className="mt-12 border-t border-line pt-8">
      <h2 id="wb-reveal-title" className="sr-only">
        {PROJECTOR_VI.reveal}
      </h2>
      <p className="max-w-prose text-fg-muted">{PROJECTOR_VI.revealNote}</p>
      <button
        id="wb-reveal"
        type="button"
        onClick={onReveal}
        className={buttonClass("primary", "mt-4")}
      >
        {PROJECTOR_VI.reveal}
      </button>
    </section>
  );
}

export function WorkbenchPage({ env, starter, back }: { env: Env; starter: Bench; back: string }) {
  const { level } = env;
  const [initial] = useState(() => loadSaved(env));
  const [bench, setBench] = useState<Bench>(initial.bench ?? starter);
  const [saved, setSaved] = useState(initial.bench !== null);
  const graph = useMemo(() => graphFromBench(env, bench), [env, bench]);
  const body = useMemo(() => JSON.stringify(graph), [graph]);
  const clientIssues = useMemo(() => validateGraph(env, graph), [env, graph]);
  const [serverIssues, setServerIssues] = useState<Issue[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [request, setRequest] = useState<RequestState>({ state: "idle" });
  const [notes, setNotes] = useState<Issue[]>([]);
  const [ours, dispatch] = useReducer(runReducer, null);
  const [lastBody, setLastBody] = useState<string | null>(null);
  const [followed, setFollowed] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<BlockType | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [stopping, setStopping] = useState<{ runId: string; state: "pending" | "failed" } | null>(
    null,
  );
  const [slip, setSlip] = useState(() => loadSlip(level.id));
  /** The slip that went with a run, graded once that run finishes. */
  const [ranSlip, setRanSlip] = useState<{ runId: string; slip: Slip } | null>(null);
  const focusLater = useFocusLater();

  // Everything that talks to the server keys off `live`, the run the reducer is driving. The
  // recorded run has no run id on any server: streaming, cancelling or reconnecting it would
  // call `/api/runs/da-ghi/...`.
  useRunStream(ours?.runId ?? null, attempt, dispatch);
  const left = useCancelOnLeave(ours);
  const recorded = useRecordedRun(level);
  const viz = useStaticViz(level);
  // Everything the player looks at reads `run`: the recorded log stands in until they run
  // something of their own, and `scope` keeps the two apart wherever that matters.
  const run = ours ?? recorded.run;
  // Projector mode (lesson plan R4): every run's outcome stays covered until the teacher opens
  // it, so the room guesses first. Keyed by run, so the next run is covered again.
  const projector = useProjector().on;
  const [revealed, setRevealed] = useState<string | null>(null);
  const masked = projector && run !== null && run.runId !== revealed;
  // N16: the ladder follows the player's own last run; N17: the first-touch lines of the page.
  const hints = useHints(level.id, ours);
  const [tips, setTips] = useState<Partial<Record<BlockType, string>>>({});
  const sample = useLastSample(ours);
  useRecordStars(level, run);
  const [history, setHistory] = useState<RunMark[]>(() => loadHistory(level.id));
  const passing = lastPassing(history);
  useRecordHistory(level.id, run, lastBody, setHistory);
  // Set by Mở ca from the pool (§5.1): when it only covers the samples, they run alone. State,
  // not a ref, because the hook below reads it during render.
  const [samplesOnly, setSamplesOnly] = useState(false);
  // A fresh arrow each render re-runs the effect; the hook's own guard, not a trimmed dep
  // list, is what keeps it to one star run per sample run (same rule as useRecordHistory).
  useStarRunAfterSample(
    ours,
    lastBody,
    (starBody) => {
      void send(starBody, newKey());
    },
    samplesOnly,
  );
  const slipOf = useCallback(
    (runId: string) => (ranSlip?.runId === runId ? ranSlip.slip : null),
    [ranSlip],
  );
  const quota = useQuota({
    levelId: level.id,
    cases: level.case_counts.normal + level.case_counts.trap + level.case_counts.info,
    ours,
    samplesCached: sample !== null && lastBody === body,
    slipOf,
    projector,
  });

  const issues = serverIssues ?? clientIssues;
  const active = isActive(run);
  const locked = active || request.state === "sending";
  const changed = lastBody !== null && body !== lastBody;
  const runGraph = useMemo(() => parseGraph(lastBody), [lastBody]);
  const benchRun: BenchRun = !run ? "none" : changed ? "stale" : isActive(run) ? "active" : "done";

  // The dome previews the sample case the player follows, or the level's first sample before a
  // run exists to follow one. A followed hidden or trap case falls back: see previewableCase.
  const previewCase = previewableCase(followed, run?.cases ?? [], level);
  const previewNodes = usePreview(level.id, previewCase, body, shouldPreview(benchRun));

  const firstVisible = run?.cases.find((c) => c.role === "visible") ?? run?.cases[0];
  const followedCase = run?.cases.find((c) => c.id === followed) ?? firstVisible ?? null;
  const reveal = run?.report?.gold[followedCase?.id ?? ""];
  const benchView =
    run && followedCase && !changed && !masked
      ? {
          run,
          followed: followedCase,
          // The whole reveal, not just the chunk ids: the dome needs ranks[node]. The server
          // now sends gold for samples only (runs.py), so `visible` is the second lock: a
          // stale deploy or a replayed log must not turn the dome into a hidden-case readout.
          gold: reveal
            ? {
                chunks: reveal.gold_chunks,
                ranks: reveal.ranks,
                flags: reveal.flags,
                visible: followedCase.role === "visible",
              }
            : null,
        }
      : null;

  // Focus follows the run (§9): the stars, a failure, a lost stream. Each target replaces the
  // panel that held focus, which would otherwise drop it to <body>.
  const scoredRun = run?.score ? run.runId : null;
  useEffect(() => {
    if (scoredRun) focusOn(document.getElementById("wb-results"));
  }, [scoredRun]);
  // A sample run earns no stars, so it never reaches the line above -- and the run panel that
  // held focus unmounts the moment it ends. Its own summary takes the focus instead (N2), but
  // only when the shift stops there: a sample that cleared the gate hands straight over to the
  // star run, whose own start moves focus again, and two moves in a frame is just churn.
  const stopped = sample !== null && sampleVerdict(sample) !== "passed" ? sample.runId : null;
  useEffect(() => {
    if (stopped) focusOn(document.getElementById("wb-sample"));
  }, [stopped]);
  const failedRun = run?.phase === "failed" ? run.runId : null;
  useEffect(() => {
    if (failedRun) focusOn(document.getElementById("wb-run-failed"));
  }, [failedRun]);
  const lost = run?.stream === "lost";
  useEffect(() => {
    if (lost) focusOn(document.getElementById("wb-lost"));
  }, [lost]);
  // Below lg the bench sits above the aside, and the run's steps fill it. With the bench still
  // on screen the scroll anchor is in it, so the focused "Đang chạy ca" slides off the bottom
  // about a second after it took focus. Once the run starts, put the heading at the top: the
  // bench is then above the screen and scroll anchoring holds the aside still. From lg the
  // aside is its own sticky column.
  const startedRun = run && run.cases.length > 0 ? run.runId : null;
  useEffect(() => {
    const heading = document.getElementById("wb-running");
    if (!startedRun || !heading || document.activeElement !== heading) return;
    if (!window.matchMedia("(min-width: 64rem)").matches)
      heading.scrollIntoView({ block: "start" });
  }, [startedRun]);
  const stop: StopState = stopping && stopping.runId === run?.runId ? stopping.state : null;

  function edit(next: Bench) {
    const fresh = firstTouches(firstTouchTypes(graph, graphFromBench(env, next)));
    if (fresh.length > 0) {
      setTips((shown) => ({
        ...shown,
        ...Object.fromEntries(
          fresh.flatMap((t) => (FIRST_TOUCH_VI[t] ? [[t, FIRST_TOUCH_VI[t]]] : [])),
        ),
      }));
    }
    hints.markLook(); // turning a toy is a free look (L1 §11)
    setBench(next);
    setSaved(save(level.id, level.version, graphFromBench(env, next)));
    setServerIssues(null);
    setSummary(null);
    setRequest({ state: "idle" });
    setNotes([]);
    setHighlight(null);
  }

  /**
   * Puts a remembered configuration back on the bench (N3). A body the bench can no longer draw
   * -- an older level version, a value outside today's domain -- leaves the bench alone and
   * says one line, the same discipline as a discarded saved config (W8).
   */
  function benchFrom(mark: RunMark) {
    const graph = parseGraph(mark.body);
    const remembered = graph === null ? null : benchFromGraph(env, graph);
    if (remembered === null) {
      setNotes([
        {
          code: "W_HISTORY_STALE",
          severity: "info",
          node: null,
          port: null,
          message_vi: "Cấu hình của lượt đó không còn vẽ được trên bàn thợ của màn này.",
        },
      ]);
      return;
    }
    edit(remembered);
  }

  function editSlip(next: Slip) {
    setSlip(next);
    saveSlip(level.id, next);
  }

  /** `before`: the cancel of a lost run, so the server's single run slot is free first. */
  async function send(sendBody: string, key: string, before?: Promise<unknown>, scope?: "mau") {
    // A function, not `left.current`: TS would narrow it to false across the awaits.
    const gone = () => left.current;
    setRequest({ state: "sending", key, body: sendBody });
    await before;
    if (gone()) return;
    const result = await postRun(level.id, sendBody, key, scope);
    if (gone()) {
      // The player left while the request was out: nobody will watch this run (§2.2).
      if (result.ok) void cancelRun(result.runId, { keepalive: true });
      return;
    }
    if (!result.ok) {
      if (result.error.issues) {
        setServerIssues(result.error.issues);
        setSummary({ kind: "server", title: result.error.title });
        setRequest({ state: "idle" });
        focusLater("#wb-issues");
      } else {
        setRequest({ state: "failed", error: result.error, key, body: sendBody });
        focusLater("#wb-request-error");
      }
      return;
    }
    setNotes(result.issues.filter((issue) => issue.severity === "info"));
    // The slip goes with this run; the next run starts from a blank one.
    setRanSlip(isEmptySlip(slip) ? null : { runId: result.runId, slip });
    editSlip(EMPTY_SLIP);
    setLastBody(sendBody);
    setFollowed(null);
    setAttempt(0);
    dispatch({ kind: "reset", runId: result.runId });
    setRequest({ state: "idle" });
    focusLater("#wb-running");
  }

  function openShift(before?: Promise<unknown>) {
    if (errorsOf(issues).length > 0) {
      if (!serverIssues) setSummary({ kind: "client" });
      focusLater("#wb-issues");
      return;
    }
    // The sample step first (N2). `useStarRunAfterSample` starts the star run behind it, unless
    // the day's pool only covers the samples (§5.1).
    setSamplesOnly(quota.mode === "sample");
    void send(body, newKey(), before, "mau");
  }

  /** The pool is spent: the recorded run stands in for the player's own on the panel. */
  function showRecorded() {
    if (ours !== null && !isActive(ours)) dispatch({ kind: "clear" });
    void recorded.show();
  }

  /** Following a case puts it under the lamp: a free look toward the next hint (L1 §11). */
  function follow(caseId: string) {
    setFollowed(caseId);
    hints.markLook();
  }

  /** A hint's "Xem …": the case onto the bench, or the toy's slot into view. */
  function point(pointer: Pointer) {
    if (pointer.kind === "case") {
      const target = run?.cases.find((c) => c.n === pointer.n);
      if (target) follow(target.id);
      focusLater("#wb-bench-title");
    } else {
      hints.markLook();
      focusSlot(pointer.slot, pointer.param);
    }
  }

  function focusSlot(type: BlockType, param?: string) {
    setHighlight(type);
    focusLater(slotTargets(env, type, param));
  }

  const live = masked ? "" : liveMessage(run, followedCase?.id ?? null);
  const awaitingReveal = masked && run.phase === "finished" ? run.runId : null;
  useEffect(() => {
    if (awaitingReveal) focusOn(document.getElementById("wb-reveal"));
  }, [awaitingReveal]);
  useEffect(() => {
    if (revealed)
      focusOn(document.getElementById("wb-results") ?? document.getElementById("wb-sample"));
  }, [revealed]);

  return (
    <>
      <Brief level={level} />
      {/* An explicit track below lg too: an implicit `auto` one grows to the JSON's longest line. */}
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6 chieu:lg:grid-cols-[minmax(0,1fr)]">
        <BenchSection
          env={env}
          bench={bench}
          graph={graph}
          onChange={edit}
          locked={locked}
          issues={issues}
          highlight={highlight}
          view={benchView}
          benchRun={benchRun}
          preview={previewNodes}
          viz={viz}
          vizCase={previewCase}
          saved={saved}
          tips={tips}
          // Gone once an edit is saved: the two notices would contradict each other.
          discarded={initial.discarded && !saved}
        />
        <aside
          aria-label="Mở ca và lượt chạy"
          // p-1 inside the scroll box keeps focus outlines (2 px + 2 px offset) unclipped; -m-1
          // keeps the content on the column edges.
          className="self-start lg:sticky lg:top-6 lg:-m-1 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:p-1 chieu:lg:static chieu:lg:m-0 chieu:lg:max-h-none chieu:lg:overflow-visible chieu:lg:p-0"
        >
          <RunPanel
            env={env}
            graph={graph}
            body={body}
            lastBody={lastBody}
            issues={issues}
            summary={summary}
            request={request}
            notes={notes}
            run={run}
            stop={stop}
            followedId={followedCase?.id ?? null}
            backTo={back}
            slip={slip}
            onSlip={editSlip}
            onOpen={openShift}
            onRecorded={showRecorded}
            recordedFailed={recorded.failed}
            quota={quota}
            samplesOnly={samplesOnly}
            projector={projector}
            masked={masked}
            onRetry={() => {
              if (request.state === "failed") void send(request.body, request.key);
            }}
            onRestore={() => edit(starter)}
            backToPassing={passing === null ? null : () => benchFrom(passing)}
            onFocusSlot={focusSlot}
            onStop={() => {
              if (!run) return;
              const { runId } = run;
              setStopping({ runId, state: "pending" });
              void cancelRun(runId).then((ok) => {
                // Focus is still on "Dừng ca" (the confirm gave it back): press it again.
                if (!ok) setStopping({ runId, state: "failed" });
              });
            }}
            onReconnect={() => {
              dispatch({ kind: "stream", state: "connecting" });
              setAttempt((n) => n + 1);
              focusLater("#wb-running");
            }}
            onRerun={() => {
              if (run && isActive(run)) {
                // A lost stream: drop the run we cannot follow (the editing panel, and any error
                // of the new POST, show again), and free the server's single slot before posting.
                dispatch({ kind: "clear" });
                openShift(cancelRun(run.runId));
              } else {
                openShift();
              }
            }}
            onAbandon={() => {
              if (run) void cancelRun(run.runId);
              dispatch({ kind: "clear" });
              focusLater("#wb-bench-title");
            }}
            onEdit={() => focusLater("#wb-bench-title")}
            onFollow={follow}
          />
        </aside>
      </div>
      {awaitingReveal && <RevealGate onReveal={() => setRevealed(awaitingReveal)} />}
      {sample && !masked && <SampleResult run={sample} samplesOnly={samplesOnly} />}
      {run?.score && !masked && (
        <Results
          key={run.runId}
          env={env}
          run={run}
          changed={changed}
          runGraph={runGraph}
          graph={graph}
          backTo={back}
          slip={ranSlip?.runId === run.runId ? ranSlip.slip : null}
          history={history}
          onDebrief={(extras) => {
            recordExtras(level.id, extras);
            setHistory(loadHistory(level.id));
          }}
          onDuplicate={benchFrom}
          onEdit={() => focusLater("#wb-bench-title")}
          onFocusSlot={focusSlot}
          onLook={hints.markLook}
        />
      )}
      {hints.target && !masked && (
        <HintLadder
          levelId={level.id}
          target={hints.target}
          book={hints.book}
          onOpen={hints.openNext}
          onPointer={point}
        />
      )}
      <p aria-live="polite" className="sr-only">
        {live}
      </p>
    </>
  );
}
