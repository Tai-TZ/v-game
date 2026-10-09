import { useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from "react";
import { Link, useParams } from "react-router";
import * as v from "valibot";

import { PageFrame } from "~/components/PageFrame";
import { buttonClass } from "~/components/ui/button";
import { recordStars, type Stars } from "~/features/progress/progress";

import { cancelRun, eventsUrl, newKey, postRun, type LevelPageData } from "./api";
import { graphFromBench, type Bench, type Env } from "./bench";
import { BenchSection, slotTargets } from "./BenchView";
import { Brief } from "./Brief";
import { BACK_TO_LEVELS, liveMessage } from "./copy";
import { Results } from "./Results";
import { frameAction, isActive, runReducer, type RunAction, type RunView } from "./run";
import { RunPanel, type RequestState, type StopState, type Summary } from "./RunPanel";
import {
  EVENT_TYPES,
  GraphSchema,
  type BlockType,
  type Graph,
  type Issue,
  type PublicLevel,
} from "./schema";
import { loadSaved, save } from "./storage";
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
  const scoredRun = run?.score ? run.runId : null;
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

/** The graph of the run on show; ours, so it parses, but checked like any other JSON. */
function parseGraph(body: string | null): Graph | null {
  if (body === null) return null;
  const parsed = v.safeParse(GraphSchema, JSON.parse(body));
  return parsed.success ? parsed.output : null;
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
  const [run, dispatch] = useReducer(runReducer, null);
  const [lastBody, setLastBody] = useState<string | null>(null);
  const [followed, setFollowed] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<BlockType | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [stopping, setStopping] = useState<{ runId: string; state: "pending" | "failed" } | null>(
    null,
  );
  const focusLater = useFocusLater();

  useRunStream(run?.runId ?? null, attempt, dispatch);
  useRecordStars(level, run);
  const left = useCancelOnLeave(run);

  const issues = serverIssues ?? clientIssues;
  const active = isActive(run);
  const locked = active || request.state === "sending";
  const changed = lastBody !== null && body !== lastBody;
  const runGraph = useMemo(() => parseGraph(lastBody), [lastBody]);

  const firstVisible = run?.cases.find((c) => c.role === "visible") ?? run?.cases[0];
  const followedCase = run?.cases.find((c) => c.id === followed) ?? firstVisible ?? null;
  const benchView =
    run && followedCase && !changed
      ? {
          run,
          followed: followedCase,
          gold: run.report?.gold[followedCase.id]?.gold_chunks ?? null,
        }
      : null;

  // Focus follows the run (§9): the stars, a failure, a lost stream. Each target replaces the
  // panel that held focus, which would otherwise drop it to <body>.
  const scoredRun = run?.score ? run.runId : null;
  useEffect(() => {
    if (scoredRun) focusOn(document.getElementById("wb-results"));
  }, [scoredRun]);
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
    setBench(next);
    setSaved(save(level.id, level.version, graphFromBench(env, next)));
    setServerIssues(null);
    setSummary(null);
    setRequest({ state: "idle" });
    setNotes([]);
    setHighlight(null);
  }

  /** `before`: the cancel of a lost run, so the server's single run slot is free first. */
  async function send(sendBody: string, key: string, before?: Promise<unknown>) {
    // A function, not `left.current`: TS would narrow it to false across the awaits.
    const gone = () => left.current;
    setRequest({ state: "sending", key, body: sendBody });
    await before;
    if (gone()) return;
    const result = await postRun(level.id, sendBody, key);
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
    void send(body, newKey(), before);
  }

  function focusSlot(type: BlockType, param?: string) {
    setHighlight(type);
    focusLater(slotTargets(env, type, param));
  }

  const live = liveMessage(run, followedCase?.id ?? null);

  return (
    <>
      <Brief level={level} />
      {/* An explicit track below lg too: an implicit `auto` one grows to the JSON's longest line. */}
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <BenchSection
          env={env}
          bench={bench}
          graph={graph}
          onChange={edit}
          locked={locked}
          issues={issues}
          highlight={highlight}
          view={benchView}
          saved={saved}
          // Gone once an edit is saved: the two notices would contradict each other.
          discarded={initial.discarded && !saved}
        />
        <aside
          aria-label="Mở ca và lượt chạy"
          // p-1 inside the scroll box keeps focus outlines (2 px + 2 px offset) unclipped; -m-1
          // keeps the content on the column edges.
          className="self-start lg:sticky lg:top-6 lg:-m-1 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:p-1"
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
            onOpen={openShift}
            onRetry={() => {
              if (request.state === "failed") void send(request.body, request.key);
            }}
            onRestore={() => edit(starter)}
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
            onFollow={setFollowed}
          />
        </aside>
      </div>
      {run?.score && (
        <Results
          env={env}
          run={run}
          changed={changed}
          runGraph={runGraph}
          graph={graph}
          backTo={back}
          onEdit={() => focusLater("#wb-bench-title")}
          onFocusSlot={focusSlot}
        />
      )}
      <p aria-live="polite" className="sr-only">
        {live}
      </p>
    </>
  );
}
