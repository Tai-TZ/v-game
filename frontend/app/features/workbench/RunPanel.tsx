import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router";

import { buttonClass } from "~/components/ui/button";
import { AlertIcon, ChevronDownIcon } from "~/components/ui/icons";

import type { PostError } from "./api";
import type { Env } from "./bench";
import { rich } from "./BenchView";
import {
  BACK_TO_LEVELS,
  failureTitle,
  fmt,
  LEVEL_COPY,
  outcomeText,
  ROLE_VI,
  sameGraphNote,
  toyName,
  vaiVi,
} from "./copy";
import { isActive, runningNodes, type CaseView, type RunView } from "./run";
import type { BlockType, Graph, Issue } from "./schema";
import { fixFor } from "./validate";

export type RequestState =
  | { state: "idle" }
  | { state: "sending"; key: string; body: string }
  | { state: "failed"; error: PostError; key: string; body: string };

/** Issues summary: the client's count, or a 422's title. */
export type Summary = { kind: "client" } | { kind: "server"; title: string };

/** The player's "Dừng lượt chạy" for the run on show: sent, or the cancel POST failed. */
export type StopState = "pending" | "failed" | null;

/** Failures only an administrator can fix: running the same graph again cannot help. */
const SERVER_SIDE = new Set(["llm_not_configured", "index_missing", "index_stale"]);

interface RunPanelProps {
  env: Env;
  graph: Graph;
  body: string;
  lastBody: string | null;
  issues: readonly Issue[];
  summary: Summary | null;
  request: RequestState;
  notes: readonly Issue[];
  run: RunView | null;
  stop: StopState;
  followedId: string | null;
  backTo: string;
  onOpen: () => void;
  onRetry: () => void;
  onRestore: () => void;
  onFocusSlot: (type: BlockType, param?: string) => void;
  onStop: () => void;
  onReconnect: () => void;
  onRerun: () => void;
  /** A lost run: cancel it and go back to the bench without a new run. */
  onAbandon: () => void;
  onEdit: () => void;
  onFollow: (caseId: string) => void;
}

export function RunPanel(props: RunPanelProps) {
  const { run } = props;
  return (
    <div className="space-y-6">
      {isActive(run) && run ? <Running {...props} run={run} /> : <Editing {...props} />}
      {run && run.cases.length > 0 && (
        <CaseTable
          run={run}
          env={props.env}
          followedId={props.followedId}
          onFollow={props.onFollow}
        />
      )}
    </div>
  );
}

/**
 * An inline confirm (§8.4, §8.5): opening it focuses its question, so a screen reader reads it;
 * closing it (a button, or Escape anywhere in it) gives focus back to the button that opened it.
 */
function useConfirm() {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const question = useRef<HTMLParagraphElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) question.current?.focus();
    else if (wasOpen.current) opener.current?.focus();
    wasOpen.current = open;
  }, [open]);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") setOpen(false);
  };
  return { open, setOpen, opener, question, onKeyDown };
}

function Editing({
  env,
  graph,
  body,
  lastBody,
  issues,
  summary,
  request,
  notes,
  run,
  stop,
  backTo,
  onOpen,
  onRetry,
  onRestore,
  onFocusSlot,
  onRerun,
  onEdit,
}: RunPanelProps) {
  const {
    open: restoring,
    setOpen: setRestoring,
    opener,
    question,
    onKeyDown: onRestoreKey,
  } = useConfirm();
  const { level } = env;
  const errors = issues.filter((issue) => issue.severity === "error");
  const typeOf = (node: string | null) => graph.nodes.find((n) => n.id === node);
  const sending = request.state === "sending";
  const failure = run?.phase === "failed" ? run.failure : undefined;
  // The player's own stop is not an error: a neutral box, in the player's words.
  const stopped = failure?.code === "cancelled" && stop !== null;

  return (
    <section aria-labelledby="wb-open-title" className="space-y-4">
      {failure && (
        <div
          id="wb-run-failed"
          role={stopped ? "status" : "alert"}
          tabIndex={-1}
          className={`rounded-md border border-line p-4 ${stopped ? "bg-subtle" : "bg-danger-tint"}`}
        >
          <p className="font-semibold">{failureTitle(failure.code)}</p>
          <p className="mt-1 text-sm">
            {stopped
              ? "Bạn đã dừng lượt chạy. Các câu đã chấm vẫn ở bảng câu."
              : failure.message_vi}{" "}
            Cấu hình của bạn vẫn còn nguyên.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!SERVER_SIDE.has(failure.code) && (
              <button type="button" onClick={onRerun} className={buttonClass("secondary")}>
                Chạy lại
              </button>
            )}
            <button type="button" onClick={onEdit} className={buttonClass("quiet")}>
              Chỉnh cấu hình
            </button>
          </div>
        </div>
      )}

      <h2 id="wb-open-title" className="text-2xl font-bold tracking-tight">
        Mở ca
      </h2>
      <p className="text-sm">Ngân sách sao 2: {fmt(level.token_budget)} token cho cả lượt.</p>
      <p className="text-sm text-fg-muted">
        Mỗi lần mở ca, trợ lý gọi AI thật một lần cho mỗi câu (ít nhất{" "}
        {level.case_counts.normal + level.case_counts.trap} lời gọi). Cấu hình đã chạy rồi thì dùng
        kết quả đã lưu, không gọi lại.
      </p>
      {/* Only after a finished run: after a failed one, running the same graph again is the fix. */}
      {body === lastBody && run?.phase === "finished" && (
        <p className="text-sm text-fg-muted">{sameGraphNote(run)}</p>
      )}

      {summary && errors.length > 0 && (
        <div
          id="wb-issues"
          role="alert"
          tabIndex={-1}
          className="rounded-md border border-line bg-danger-tint p-4"
        >
          <p className="font-semibold">
            {summary.kind === "server"
              ? summary.title
              : `Còn ${errors.length} lỗi cần sửa trước khi mở ca.`}
          </p>
          <ul className="mt-2 space-y-1">
            {errors.map((issue, index) => {
              const node = typeOf(issue.node);
              const text = rich(issue.message_vi);
              const fix = fixFor(env, graph, issue);
              return (
                // By position, like the slot's rows: the same line can come twice.
                <li key={index} className="text-sm">
                  {node ? (
                    <button
                      type="button"
                      onClick={() => onFocusSlot(fix?.slot ?? node.type, fix?.param)}
                      className="min-h-11 text-left underline underline-offset-4"
                    >
                      {toyName(node.type, node.params)}: {text} {fix?.hint}
                    </button>
                  ) : (
                    text
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {request.state === "failed" && (
        <div
          id="wb-request-error"
          role="alert"
          tabIndex={-1}
          className="rounded-md border border-line bg-warning-tint p-4"
        >
          <p className="font-semibold">{request.error.title}</p>
          {request.error.lines.map((line) => (
            <p key={line} className="mt-1 text-sm">
              {line}
            </p>
          ))}
          {(request.error.retry || request.error.backLink) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {request.error.retry && (
                <button type="button" onClick={onRetry} className={buttonClass("secondary")}>
                  Thử lại
                </button>
              )}
              {request.error.backLink && (
                <Link to={backTo} className={buttonClass("quiet")}>
                  {BACK_TO_LEVELS}
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onOpen}
        disabled={sending}
        aria-busy={sending}
        className={buttonClass("primary", "w-full")}
      >
        {sending ? "Đang gửi cấu hình…" : "Mở ca"}
      </button>

      {notes.length > 0 && (
        <ul className="space-y-1 text-sm text-fg-muted">
          {notes.map((note, index) => (
            <li key={index}>{rich(note.message_vi)}</li>
          ))}
        </ul>
      )}

      <details className="group">
        <summary className="flex min-h-11 cursor-pointer items-center gap-1 text-sm font-semibold text-brand">
          Xem cấu hình JSON
          <ChevronDownIcon />
        </summary>
        <pre
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must take focus for keyboard users
          tabIndex={0}
          className="max-h-96 overflow-auto rounded-sm bg-subtle p-3 font-mono text-xs"
        >
          {JSON.stringify(graph, null, 2)}
        </pre>
      </details>

      {restoring ? (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape from any of its controls closes the confirm
        <div onKeyDown={onRestoreKey} className="rounded-md border border-line p-4">
          <p ref={question} tabIndex={-1} className="text-sm">
            Cấu hình hiện tại sẽ được thay bằng cấu hình khởi đầu của màn.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setRestoring(false);
                onRestore();
              }}
              className={buttonClass("primary")}
            >
              Khôi phục
            </button>
            <button
              type="button"
              onClick={() => setRestoring(false)}
              className={buttonClass("secondary")}
            >
              Giữ cấu hình
            </button>
          </div>
        </div>
      ) : (
        <button
          ref={opener}
          type="button"
          onClick={() => setRestoring(true)}
          disabled={sending}
          className={buttonClass("inline")}
        >
          Khôi phục cấu hình khởi đầu
        </button>
      )}
    </section>
  );
}

function Running({
  run,
  stop,
  onStop,
  onReconnect,
  onRerun,
  onAbandon,
}: RunPanelProps & { run: RunView }) {
  const {
    open: stopping,
    setOpen: setStopping,
    opener,
    question,
    onKeyDown: onStopKey,
  } = useConfirm();
  const graded = run.cases.filter((c) => c.state === "graded").length;
  return (
    <section aria-labelledby="wb-running" className="space-y-4">
      <h2 id="wb-running" tabIndex={-1} className="scroll-mt-4 text-2xl font-bold tracking-tight">
        Đang chạy ca
      </h2>
      <p className="text-sm font-semibold tabular-nums">
        {graded}/{run.cases.length} câu đã chấm
      </p>
      <p role="status" className="text-sm empty:hidden">
        {run.stream === "connecting" && (
          <span className="block text-fg-muted">Đang nối tới lượt chạy…</span>
        )}
        {run.stream === "reconnecting" && (
          <span className="block font-semibold text-warning">Mất kết nối, đang nối lại…</span>
        )}
        {stop === "pending" && <span className="block text-fg-muted">Đang dừng lượt chạy…</span>}
        {stop === "failed" && (
          <span className="block font-semibold text-danger">
            Chưa dừng được lượt chạy. Bấm Dừng ca lần nữa.
          </span>
        )}
      </p>
      {run.stream === "lost" && (
        <div
          id="wb-lost"
          role="alert"
          tabIndex={-1}
          className="rounded-md border border-line bg-warning-tint p-4"
        >
          <p className="font-semibold">Không theo dõi được lượt chạy nữa.</p>
          <p className="mt-1 text-sm">
            Mất kết nối tới máy chủ. Thử nối lại để xem tiếp lượt này. Chạy lại sẽ hủy lượt này và
            mở ca mới, tốn lời gọi AI như một lần mở ca.
          </p>
          {/* The free action first: Chạy lại spends a new run's AI calls. Three never fit one
              row of the aside, so the quiet way out gets its own, on the text edge. */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onReconnect} className={buttonClass("primary")}>
              Thử nối lại
            </button>
            <button type="button" onClick={onRerun} className={buttonClass("secondary")}>
              Chạy lại
            </button>
          </div>
          <button type="button" onClick={onAbandon} className={buttonClass("inline", "mt-1")}>
            Chỉnh cấu hình
          </button>
        </div>
      )}
      {stopping ? (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape from any of its controls closes the confirm
        <div onKeyDown={onStopKey} className="rounded-md border border-line p-4">
          <p ref={question} tabIndex={-1} className="text-sm">
            Dừng lượt chạy này? Các câu đã gọi AI vẫn bị tính.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setStopping(false);
                onStop();
              }}
              className={buttonClass("secondary")}
            >
              Dừng lượt chạy
            </button>
            <button
              type="button"
              onClick={() => setStopping(false)}
              className={buttonClass("quiet")}
            >
              Chạy tiếp
            </button>
          </div>
        </div>
      ) : (
        run.stream !== "lost" && (
          <button
            ref={opener}
            type="button"
            onClick={() => setStopping(true)}
            className={buttonClass("secondary", "w-full")}
          >
            Dừng ca
          </button>
        )
      )}
    </section>
  );
}

/** "#3 · Câu mẫu · Hỏi một dữ kiện", plus "· Câu của Minh" on case #1 (§8.5). */
export function caseTitle(c: CaseView, levelId: string): string {
  const asker = c.n === 1 ? LEVEL_COPY[levelId]?.asker : undefined;
  return `#${c.n} · ${ROLE_VI[c.role] ?? c.role} · ${vaiVi(c.vai)}${asker ? ` · Câu của ${asker}` : ""}`;
}

function caseState(c: CaseView, env: Env): string {
  if (c.state === "graded") return outcomeText(c);
  const running = runningNodes(c);
  if (running.length === 0) return "Chờ";
  const toys = running.map((node) => {
    const block = c.steps[node]?.block;
    return block && block in env.blocks ? toyName(block as BlockType) : node;
  });
  return `Đang chạy: ${toys.join(", ")}`;
}

function CaseTable({
  run,
  env,
  followedId,
  onFollow,
}: {
  run: RunView;
  env: Env;
  followedId: string | null;
  onFollow: (caseId: string) => void;
}) {
  return (
    <section aria-labelledby="wb-cases-title">
      <h3 id="wb-cases-title" tabIndex={-1} className="scroll-mt-4 text-base font-bold">
        Bảng câu
      </h3>
      <ul className="mt-2 space-y-1">
        {run.cases.map((c) => {
          const tone = !c.graded
            ? "bg-surface"
            : !c.graded.counted
              ? "bg-subtle"
              : c.graded.passed
                ? "bg-success-tint"
                : "bg-danger-tint";
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={c.id === followedId}
                onClick={() => onFollow(c.id)}
                className={`flex min-h-12 w-full flex-col items-start gap-0.5 rounded-sm border px-3 py-2 text-left text-sm ${tone} ${c.id === followedId ? "border-brand ring-1 ring-brand" : "border-line"}`}
              >
                <span className="font-semibold">{caseTitle(c, env.level.id)}</span>
                {c.question && <span className="line-clamp-2 text-fg-muted">{c.question}</span>}
                <span className="inline-flex items-center gap-1">
                  {c.graded && !c.graded.passed && <AlertIcon className="size-3.5 shrink-0" />}
                  {caseState(c, env)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
