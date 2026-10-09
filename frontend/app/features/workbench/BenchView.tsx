import { useId, type ReactNode } from "react";

import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  CrossIcon,
  LockIcon,
  StarIcon,
} from "~/components/ui/icons";

import {
  domain,
  isAllowed,
  isLocked,
  isOptional,
  nodeIds,
  paramNames,
  roundToStep,
  setAttached,
  setCard,
  setParam,
  slotParams,
  systemPrompt,
  type Bench,
  type Domain,
  type Env,
} from "./bench";
import {
  CRITERIA_VI,
  fmt,
  fmtValue,
  LABEL_VI,
  outcomeText,
  stepStatusText,
  TOY,
  toyName,
  vaiVi,
  variantVi,
} from "./copy";
import type { CaseView, RunView, StepView } from "./run";
import type { BlockType, Fact, Graph, Issue, JsonValue } from "./schema";
import { fixFor } from "./validate";

/** `*X*` in server messages becomes <strong>X</strong>; the rest stays plain text. */
export function rich(text: string): ReactNode {
  return text
    .split(/\*([^*]+)\*/)
    .map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part));
}

export const slotId = (env: Env, type: BlockType) => `slot-${nodeIds(env.level)[type]}`;

// Never an unchecked radio: one arrow key there would silently change the value.
const CONTROL = ':is(input:not([type="radio"]), input:checked, select, button):not([disabled])';

/**
 * Focus targets of §9, best first: the knob named by `param` (absent when the slot is detached
 * or the knob is fixed at this level), then the slot's first control (the attach switch of a
 * detached slot).
 */
export function slotTargets(env: Env, type: BlockType, param?: string): string[] {
  const slot = `#${slotId(env, type)}`;
  return [...(param ? [`${slot} [data-param="${param}"] ${CONTROL}`] : []), `${slot} ${CONTROL}`];
}

/** Slots that can be focused from a diagnosis: shown, unlocked and with a control. */
export function hasControls(env: Env, type: BlockType): boolean {
  if (!isAllowed(env.level, type) || isLocked(env.level, type)) return false;
  if (isOptional(type) || type === "llm") return true;
  return paramNames(env.blocks, type).some((name) => domain(env, type, name)?.kind !== "fixed");
}

export interface BenchRunView {
  run: RunView;
  followed: CaseView;
  /** report.gold[followed].gold_chunks, after run.finished. */
  gold: readonly string[] | null;
}

interface BenchProps {
  env: Env;
  bench: Bench;
  /** The graph the bench sends (for the next step of each error). */
  graph: Graph;
  onChange: (next: Bench) => void;
  locked: boolean;
  issues: readonly Issue[];
  highlight: BlockType | null;
  view: BenchRunView | null;
  saved: boolean;
  discarded: boolean;
}

const EMPTY_TEXT: Readonly<Record<string, string>> = {
  vector_search: "Không tìm theo nghĩa.",
  bm25_search: "Không tìm theo từ khóa.",
  fusion: "Không gộp: các danh sách đổ thẳng vào bước sau.",
  rerank: "Không xếp hạng lại.",
};

export function BenchSection(props: BenchProps) {
  const { env, locked, view, saved, discarded } = props;
  const { level, blocks } = env;
  const allowed = (type: BlockType) => isAllowed(level, type);
  const flow = (type: BlockType) => Object.values(blocks[type].outputs)[0]?.type_vi ?? "";
  const notOpened = (["vector_search", "bm25_search", "fusion", "rerank"] as const)
    .filter((type) => !allowed(type))
    .map((type) => TOY[type].name);
  const slot = (type: BlockType) => <Slot key={type} type={type} {...props} />;

  return (
    <section aria-labelledby="wb-bench-title">
      <h2 id="wb-bench-title" tabIndex={-1} className="text-2xl font-bold tracking-tight">
        Bàn thợ
      </h2>
      <p className="mt-1 text-fg-muted">
        Gắn, tháo và chỉnh từng món. Mỗi lần mở ca, trợ lý chạy thật trên mọi câu của tối nay.
      </p>
      <div className="mt-2 space-y-1 text-sm text-fg-muted">
        {notOpened.length > 0 && <p>Chưa mở ở màn này: {notOpened.join(", ")}.</p>}
        {discarded && (
          <p>Cấu hình đã lưu không còn hợp với màn này nên bàn thợ dùng cấu hình khởi đầu.</p>
        )}
        {saved && <p>Đã lưu cấu hình trên máy này.</p>}
        {locked && <p className="font-semibold text-fg">Bàn thợ khóa trong lúc chạy.</p>}
      </div>
      {view && (
        <p className="mt-4 flex flex-wrap gap-x-3 rounded-sm bg-brand-tint px-3 py-2 text-sm">
          <span className="font-semibold">
            Đang theo dõi: câu #{view.followed.n} · {vaiVi(view.followed.vai)}
          </span>
          {/* Below lg the case table sits under the whole bench. */}
          <a href="#wb-cases-title" className="text-brand underline underline-offset-4">
            Đổi câu ở bảng câu
          </a>
        </p>
      )}

      <fieldset disabled={locked} className="mt-5 min-w-0">
        <legend className="sr-only">Các món trên bàn thợ</legend>
        {slot("input")}
        <Connector label={flow("input")} />
        <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
          {slot("corpus")}
          {slot("chunker")}
        </div>
        <Connector label={flow("chunker")} />
        {(allowed("vector_search") || allowed("bm25_search")) && (
          <>
            <div
              className={`grid gap-3 ${allowed("vector_search") && allowed("bm25_search") ? "sm:grid-cols-2" : ""}`}
            >
              {allowed("vector_search") && slot("vector_search")}
              {allowed("bm25_search") && slot("bm25_search")}
            </div>
            <Connector label={flow("vector_search")} />
          </>
        )}
        {allowed("fusion") && (
          <>
            {slot("fusion")}
            <Connector label={flow("fusion")} />
          </>
        )}
        {allowed("rerank") && (
          <>
            {slot("rerank")}
            <Connector label={flow("rerank")} />
          </>
        )}
        {slot("context_packer")}
        <Connector label={flow("context_packer")} />
        {slot("llm")}
        <Connector label={flow("llm")} />
        {slot("output")}
      </fieldset>
    </section>
  );
}

function Connector({ label }: { label: string }) {
  return (
    <div aria-hidden="true" className="flex h-8 items-center gap-3 pl-6">
      <span className="h-full w-0.5 bg-line" />
      <span className="text-xs text-fg-muted">{label}</span>
    </div>
  );
}

const WARN = new Set(["timeout", "cancelled", "budget"]);
const DANGER = new Set(["llm_error", "index_error"]);

function frameClass(step: StepView | undefined, highlighted: boolean, failed: boolean): string {
  // The lamp of a diagnosis ("Xem ở …") wins over the run state until the next edit.
  if (highlighted) return "border-brand ring-2 ring-brand bg-surface";
  // The answer board of a failed case: every step can be "Xong" while the answer is wrong.
  if (failed) return "border-danger ring-1 ring-danger bg-surface";
  if (step?.state === "running") return "border-brand ring-1 ring-brand bg-surface";
  if (!step) return "border-line bg-surface";
  if (step.status === "ok") return "border-success ring-1 ring-success bg-surface";
  if (step.status && WARN.has(step.status)) return "border-warning bg-warning-tint";
  if (step.status && DANGER.has(step.status)) return "border-danger bg-danger-tint";
  return "border-warning bg-surface";
}

function Slot({
  type,
  env,
  bench,
  graph,
  onChange,
  issues,
  highlight,
  view,
}: BenchProps & { type: BlockType }) {
  const { level, blocks } = env;
  const id = nodeIds(level)[type];
  const titleId = `${slotId(env, type)}-title`;
  const locked = isLocked(level, type);
  const params = slotParams(env, bench, type);
  const toy = toyName(type, params);
  const optional = isOptional(type);
  const step = view ? view.followed.steps[id] : undefined;
  const own = issues.filter((issue) => issue.node === id);
  const graded = type === "output" ? view?.followed.graded : undefined;

  if (optional && !bench.attached[type]) {
    const retrievalEmpty =
      (type === "vector_search" || type === "bm25_search") &&
      !(isAllowed(level, "vector_search") && bench.attached.vector_search) &&
      !(isAllowed(level, "bm25_search") && bench.attached.bm25_search);
    const fact =
      retrievalEmpty && type === "vector_search"
        ? "Không có khe truy xuất nào: thùng chỉ có câu hỏi."
        : EMPTY_TEXT[type];
    return (
      <section
        id={slotId(env, type)}
        aria-labelledby={titleId}
        className={`rounded-md border-2 border-dashed p-4 ${highlight === type ? "border-brand" : "border-line-strong"}`}
      >
        <SlotHead titleId={titleId} toy={toy} type={type} env={env} />
        <AttachSwitch
          toy={toy}
          on={false}
          onToggle={() => onChange(setAttached(bench, type, true))}
        />
        <p className="mt-1 text-sm text-fg-muted">{fact}</p>
        <SlotIssues env={env} graph={graph} issues={own} />
      </section>
    );
  }

  return (
    <section
      id={slotId(env, type)}
      aria-labelledby={titleId}
      className={`rounded-md border p-4 transition-colors duration-150 ${frameClass(step, highlight === type, graded?.counted === true && !graded.passed)}`}
    >
      <SlotHead titleId={titleId} toy={toy} type={type} env={env}>
        {locked && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted">
            <LockIcon className="size-3.5 shrink-0" />
            Khóa ở màn này
          </span>
        )}
      </SlotHead>
      {optional && (
        <AttachSwitch toy={toy} on onToggle={() => onChange(setAttached(bench, type, false))} />
      )}

      {graded && view && <Grade c={view.followed} />}

      {type === "corpus" && (
        <p className="mt-2 text-sm">
          Kho:{" "}
          {level.corpus.map((doc, index) => (
            <span key={doc}>
              {index > 0 && ", "}
              <code className="font-mono text-xs">{doc}</code>
            </span>
          ))}
        </p>
      )}

      <div className="mt-3 space-y-4 empty:hidden">
        {paramNames(blocks, type)
          .filter(
            (name) => !(type === "fusion" && name === (params.method === "alpha" ? "k" : "alpha")),
          )
          .map((name) => {
            const d = locked
              ? ({ kind: "fixed", value: params[name] ?? null } as const)
              : domain(env, type, name);
            if (!d) return null;
            return (
              <Control
                key={name}
                env={env}
                type={type}
                param={name}
                domain={d}
                value={params[name] ?? null}
                onValue={(value) => onChange(setParam(env, bench, type, name, value))}
              />
            );
          })}
        {type === "llm" && !locked && <Prism env={env} bench={bench} onChange={onChange} />}
      </div>

      {type === "chunker" && view && <Ingestion run={view.run} node={id} />}
      <SlotIssues env={env} graph={graph} issues={own} />
      {step && <StepState step={step} toy={toy} gold={view?.gold ?? null} />}
    </section>
  );
}

function SlotHead({
  titleId,
  toy,
  type,
  env,
  children,
}: {
  titleId: string;
  toy: string;
  type: BlockType;
  env: Env;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <div className="min-w-0">
        <h3 id={titleId} className="text-base font-bold">
          {toy}
        </h3>
        <p className="text-xs text-fg-muted">
          {env.blocks[type].name_vi} · <code className="font-mono">{type}</code>
        </p>
      </div>
      {children}
    </div>
  );
}

function AttachSwitch({ toy, on, onToggle }: { toy: string; on: boolean; onToggle: () => void }) {
  return (
    <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={onToggle}
        className="size-5 shrink-0 accent-brand"
      />
      Gắn {toy}
    </label>
  );
}

/** Outcome badge, criteria chips and labels of a graded case (§7, §8.6). */
export function Grade({ c }: { c: CaseView }) {
  const graded = c.graded;
  const tone = !graded?.counted
    ? "bg-subtle"
    : graded.passed
      ? "bg-success-tint"
      : "bg-danger-tint";
  return (
    <>
      <p className={`mt-2 inline-block rounded-sm px-2 py-0.5 text-sm font-semibold ${tone}`}>
        {outcomeText(c)}
      </p>
      {graded && (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="Tiêu chí">
          {Object.entries(graded.criteria).map(([name, ok]) => (
            <li
              key={name}
              className="inline-flex items-center gap-1 rounded-sm border border-line px-2 py-0.5 text-xs"
            >
              {ok ? (
                <CheckIcon className="size-3.5 shrink-0 text-success" />
              ) : (
                <CrossIcon className="size-3.5 shrink-0 text-danger" />
              )}
              <span className="sr-only">{ok ? "Đạt" : "Trượt"}: </span>
              {CRITERIA_VI[name] ?? name}
            </li>
          ))}
          {graded.labels.map((label) => (
            <li key={label} className="rounded-sm bg-subtle px-2 py-0.5 text-xs">
              {LABEL_VI[label] ?? label}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function SlotIssues({ env, graph, issues }: { env: Env; graph: Graph; issues: readonly Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1">
      {/* Keyed by position: the validator repeats a line once per list (two G06 "5 > 3"), and
          duplicate keys leave ghost rows behind. The rows hold no state. */}
      {issues.map((issue, index) => (
        <li
          key={index}
          className={`flex gap-2 text-sm ${issue.severity === "error" ? "text-danger" : "text-fg-muted"}`}
        >
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            {issue.severity === "error" ? <span className="sr-only">Lỗi: </span> : null}
            {rich(issue.message_vi)} {fixFor(env, graph, issue)?.hint}
          </span>
        </li>
      ))}
    </ul>
  );
}

// --- Controls -------------------------------------------------------------------------------

/** "Móc kéo · Số đoạn lấy về · top_k": the knob's own toy (never the slot's again), title, code. */
function ParamLabel({ env, type, param }: { env: Env; type: BlockType; param: string }) {
  const title = env.blocks[type].params.properties[param]?.title ?? param;
  const toy = TOY[type].params?.[param];
  return (
    <>
      {toy && toy !== TOY[type].name && toy !== title ? `${toy} · ${title}` : title} ·{" "}
      <code className="font-mono text-xs">{param}</code>
    </>
  );
}

function Control({
  env,
  type,
  param,
  domain: d,
  value,
  onValue,
}: {
  env: Env;
  type: BlockType;
  param: string;
  domain: Domain;
  value: JsonValue;
  onValue: (value: JsonValue) => void;
}) {
  const id = useId();
  const label = <ParamLabel env={env} type={type} param={param} />;
  switch (d.kind) {
    case "fixed":
      return (
        <p data-param={param} className="flex items-start gap-2 text-sm">
          <LockIcon className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          <span>
            {label}: <strong>{fmtValue(param, d.value)}</strong> · cố định ở màn này
          </span>
        </p>
      );
    case "toggle":
      return (
        <label
          data-param={param}
          className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
        >
          <input
            type="checkbox"
            role="switch"
            checked={value === true}
            onChange={(event) => onValue(event.target.checked)}
            className="size-5 shrink-0 accent-brand"
          />
          <span>{label}</span>
        </label>
      );
    case "choice":
      return (
        <fieldset data-param={param}>
          <legend className="text-sm font-medium">{label}</legend>
          <div className="mt-2 flex flex-wrap gap-1">
            {d.options.map((option) => (
              <label key={JSON.stringify(option)} className="cursor-pointer">
                <input
                  type="radio"
                  name={id}
                  checked={option === value}
                  onChange={() => onValue(option)}
                  className="peer sr-only"
                />
                <span className="flex h-11 items-center rounded-sm border border-fg-muted bg-surface px-3 text-sm peer-checked:border-brand peer-checked:bg-brand peer-checked:text-on-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:cursor-not-allowed peer-disabled:opacity-60">
                  {fmtValue(param, option)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    case "range": {
      const current = typeof value === "number" ? value : d.min;
      return (
        <div data-param={param}>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={id} className="text-sm font-medium">
              {label}
            </label>
            {/* Not an <output>: that is a live region, and aria-valuetext already speaks it. */}
            <span aria-hidden="true" className="text-sm font-semibold tabular-nums">
              {fmtValue(param, current)}
            </span>
          </div>
          <input
            id={id}
            type="range"
            min={d.min}
            max={d.max}
            step={d.step}
            value={current}
            aria-valuetext={fmtValue(param, current)}
            onChange={(event) => {
              const next = roundToStep(Number(event.target.value), d.step);
              onValue(d.integer ? Math.round(next) : next);
            }}
            // mt-1: the focus outline (2 px + 2 px offset) must not cover the label's diacritics.
            className="mt-1 h-11 w-full cursor-pointer accent-brand disabled:cursor-not-allowed"
          />
          <p className="text-xs text-fg-muted tabular-nums">
            {fmt(d.min)}–{fmt(d.max)}
          </p>
        </div>
      );
    }
  }
}

function Prism({
  env,
  bench,
  onChange,
}: {
  env: Env;
  bench: Bench;
  onChange: (next: Bench) => void;
}) {
  const id = useId();
  const cards = Object.entries(env.level.prompt_cards);
  const length = systemPrompt(env.level, bench.cards).length;
  return (
    <fieldset data-param="system_prompt">
      <legend className="text-sm font-medium">
        Lăng kính · Dặn dò · <code className="font-mono text-xs">system_prompt</code>
      </legend>
      <div className="mt-2 space-y-3">
        {([0, 1, 2] as const).map((slot) => {
          const chosen = bench.cards[slot];
          return (
            <div key={slot}>
              <label htmlFor={`${id}-${slot}`} className="text-sm">
                Khe thẻ {slot + 1}
              </label>
              <select
                id={`${id}-${slot}`}
                value={chosen ?? ""}
                onChange={(event) => onChange(setCard(bench, slot, event.target.value || null))}
                className="mt-1 h-11 w-full rounded-sm border border-fg-muted bg-surface px-2 text-sm text-fg disabled:opacity-60"
              >
                <option value="">Trống</option>
                {cards.map(([key, text]) => (
                  <option
                    key={key}
                    value={key}
                    disabled={chosen !== key && bench.cards.includes(key)}
                  >
                    {key} · {text}
                  </option>
                ))}
              </select>
              {chosen && (
                <p className="mt-1 text-sm text-fg-muted">{env.level.prompt_cards[chosen]}</p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-fg-muted">
        Dặn dò: {fmt(length)} ký tự, đi riêng ngoài thùng.
      </p>
    </fieldset>
  );
}

// --- Run state of a slot (§7) ---------------------------------------------------------------

function Ingestion({ run, node }: { run: RunView; node: string }) {
  const info = run.ingestion.find((item) => item.node === node);
  if (!info) return null;
  return (
    <p className="mt-3 text-sm">
      Chỉ mục <code className="font-mono text-xs">{info.variant}</code> ({variantVi(info.variant)}):{" "}
      {fmt(info.chunks)} đoạn, trung bình {fmt(info.avg_tokens)} token mỗi đoạn.
    </p>
  );
}

function StepState({
  step,
  toy,
  gold,
}: {
  step: StepView;
  toy: string;
  gold: readonly string[] | null;
}) {
  return (
    <div className="mt-3 border-t border-line pt-3 text-sm">
      <p className="font-semibold">{stepStatusText(step.status, step.ms)}</p>
      {step.state === "running" && (
        <div className="mt-2 h-1 overflow-hidden rounded-sm bg-subtle">
          <div className="h-full w-1/3 animate-poster-bar bg-brand motion-reduce:animate-none" />
        </div>
      )}
      {step.summary && <p className="mt-1 text-fg-muted">{step.summary}</p>}
      {step.facts && step.facts.length > 0 && (
        <details className="group mt-2">
          <summary className="flex min-h-11 cursor-pointer items-center gap-1 font-semibold text-brand">
            Xem số liệu<span className="sr-only"> của {toy}</span>
            <ChevronDownIcon />
          </summary>
          <div className="space-y-3">
            {step.facts.map((fact, index) => (
              <FactView key={index} fact={fact} step={step} gold={gold} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function FactView({
  fact,
  step,
  gold,
}: {
  fact: Fact;
  step: StepView;
  gold: readonly string[] | null;
}) {
  if (fact.kind === "retrieved") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-fg-muted">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">
                Hạng
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Điều/khoản
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Điểm
              </th>
              <th scope="col" className="py-1 font-medium">
                Văn bản
              </th>
            </tr>
          </thead>
          <tbody>
            {fact.items.map((item) => {
              const isGold = gold?.includes(item.chunk_id) ?? false;
              return (
                <tr key={item.chunk_id} className="border-t border-line">
                  <td className="py-1 pr-3 tabular-nums">{item.rank}</td>
                  <td className="py-1 pr-3">
                    Điều {item.dieu}
                    {item.khoan.length > 0 && `, khoản ${item.khoan.join(", ")}`}
                    {isGold && (
                      <span className="ml-1 inline-flex items-center gap-1 font-semibold">
                        <StarIcon className="size-3.5 shrink-0 fill-accent stroke-accent" />
                        Đoạn đáp án
                      </span>
                    )}
                  </td>
                  <td className="py-1 pr-3 tabular-nums">{fmt(item.score)}</td>
                  <td className="py-1">
                    {item.doc_id}
                    {!item.hieu_luc && " · hết hiệu lực"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  if (fact.kind === "pack") {
    const { total, budget, docs, query } = fact.tokens;
    return (
      <div className="space-y-1">
        <p>
          {fmt(total)}/{fmt(budget)} token
        </p>
        <Bar value={total} max={budget} />
        <p className="text-fg-muted">
          Tài liệu {fmt(docs)} · Câu hỏi {fmt(query)}
        </p>
        <p>
          Vào thùng: {fact.included.length} đoạn. Bị cắt: {fact.dropped.length} đoạn.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {step.tokens && (
        <p>
          {fmt(step.tokens.in)} vào · {fmt(step.tokens.out)} ra token
        </p>
      )}
      <p>
        Model <code className="font-mono text-xs">{fact.model}</code>
        {fact.replayed && (
          <span className="ml-2 rounded-sm border border-line px-1.5 py-0.5 text-xs">
            Kết quả đã lưu
          </span>
        )}
      </p>
      <p className="text-fg-muted">Dặn dò {fmt(fact.system_tokens)} token, ngoài thùng</p>
      {fact.cited_ids.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Mã đã trích">
          {fact.cited_ids.map((cite) => (
            <li
              key={cite}
              className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-xs break-all"
            >
              {cite}
            </li>
          ))}
        </ul>
      )}
      {fact.answer && (
        <blockquote className="border-l-2 border-line-strong pl-3 whitespace-pre-line">
          {fact.answer}
        </blockquote>
      )}
    </div>
  );
}

/** Horizontal bar as SVG attributes (no style attribute, CSP). Red when over `max`. */
export function Bar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <svg aria-hidden="true" viewBox="0 0 100 4" preserveAspectRatio="none" className="h-1.5 w-full">
      <rect width="100" height="4" className="fill-subtle" />
      <rect width={width} height="4" className={value > max ? "fill-danger" : "fill-brand"} />
    </svg>
  );
}
