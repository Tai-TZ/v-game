import { Link } from "react-router";

import { buttonClass } from "~/components/ui/button";
import { CheckIcon, ChevronDownIcon, CrossIcon, StarIcon } from "~/components/ui/icons";

import { domain, nodeIds, type Env } from "./bench";
import { Bar, Grade, hasControls, rich } from "./BenchView";
import {
  BACK_TO_LEVELS,
  diagnosisTarget,
  FLAG_VI,
  flagWords,
  fmt,
  groupDiagnosis,
  LABEL_VI,
  LEVEL_COPY,
  lowerFirst,
  stepStatusText,
  TOY,
  toyName,
} from "./copy";
import { caseTitle } from "./RunPanel";
import { llmCalls, unfinished, type CaseView, type RunView } from "./run";
import { BLOCK_TYPES, type BlockType, type GoldReveal, type Graph } from "./schema";

interface ResultsProps {
  env: Env;
  run: RunView;
  /** The bench changed since this run (§8.6 "Kết quả cũ"). */
  changed: boolean;
  /** The graph this run used (ranks are read against its top_k / top_n). */
  runGraph: Graph | null;
  /** The bench now: a lesson on a detached slot says the move ("Thử gắn …"). */
  graph: Graph;
  backTo: string;
  onEdit: () => void;
  onFocusSlot: (type: BlockType, param?: string) => void;
}

/** Sao 3 evidence per forbidden label, in the words of `stars_vi` ("{n} câu …"). */
const LABEL_EVIDENCE: Readonly<Record<string, string>> = {
  stale_doc: "mang văn bản hết hiệu lực vào thùng",
  cite_unknown: "trích nguồn không có trong thùng",
};
const asBlock = (block: string): BlockType | null =>
  (BLOCK_TYPES as readonly string[]).includes(block) ? (block as BlockType) : null;

/** Stars, the three conditions, cô Lan's diagnosis and every case (§8.6). */
export function Results({
  env,
  run,
  changed,
  runGraph,
  graph,
  backTo,
  onEdit,
  onFocusSlot,
}: ResultsProps) {
  const { level } = env;
  const score = run.score;
  if (!score) return null;
  const copy = LEVEL_COPY[level.id];
  const first = run.cases.find((c) => c.id === copy?.s1Required[0]);
  const skipped = unfinished(run).length;
  const calls = llmCalls(run);
  const conditions = [
    {
      ok: score.s1,
      evidence: [
        `${score.normal_passed}/${score.normal_total} câu thường đạt`,
        ...(first && copy
          ? [`câu #1 (${copy.asker}): ${first.graded?.passed ? "Đạt" : "Trượt"}`]
          : []),
      ].join(" · "),
      bar: false,
    },
    { ok: score.s2, evidence: `${fmt(score.tokens)}/${fmt(score.budget)} token`, bar: true },
    {
      ok: score.s3,
      evidence: [
        `${score.traps_passed}/${score.traps_total} câu bẫy đạt`,
        ...(copy?.s3ForbiddenLabels ?? []).map((label) => {
          const count = run.cases.filter((c) => c.graded?.labels.includes(label)).length;
          return `${count} câu ${LABEL_EVIDENCE[label] ?? lowerFirst(LABEL_VI[label] ?? label)}`;
        }),
      ].join(" · "),
      bar: false,
    },
  ];

  return (
    <section aria-labelledby="wb-results" className="mt-12 border-t border-line pt-8">
      {changed && (
        <p className="mb-2 text-sm text-fg-muted">Kết quả của cấu hình trước khi bạn chỉnh.</p>
      )}
      <h2 id="wb-results" tabIndex={-1} className="text-2xl font-bold tracking-tight">
        Kết quả ca tối nay
      </h2>
      <div className="mt-4 flex items-center gap-3">
        <span aria-hidden="true" className="flex gap-1">
          {[1, 2, 3].map((star) => (
            <StarIcon
              key={star}
              className={`size-7 shrink-0 ${star <= score.stars ? "fill-accent stroke-accent" : "fill-none stroke-line-strong"}`}
            />
          ))}
        </span>
        <p className="text-xl font-bold">{score.stars}/3 sao</p>
      </div>

      <ol className="mt-5 max-w-prose space-y-3">
        {conditions.map((condition, index) => (
          <li key={index} className="rounded-md border border-line bg-surface p-3">
            <p className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-semibold">Sao {index + 1}</span>
              <span
                className={`inline-flex items-center gap-1 text-sm font-semibold ${condition.ok ? "text-success" : "text-fg-muted"}`}
              >
                {condition.ok ? <CheckIcon /> : <CrossIcon />}
                {condition.ok ? "Đạt" : "Chưa đạt"}
              </span>
            </p>
            <p className="mt-1 text-sm">{level.stars_vi[index]}</p>
            <p className="mt-1 text-sm text-fg-muted tabular-nums">{condition.evidence}</p>
            {condition.bar && (
              <div className="mt-2">
                <Bar value={score.tokens} max={score.budget} />
              </div>
            )}
            {index > 0 && !score.s1 && (
              <p className="mt-1 text-sm text-fg-muted">Chỉ tính khi có sao 1.</p>
            )}
          </li>
        ))}
      </ol>

      {skipped > 0 && (
        <div className="mt-5 max-w-prose rounded-md border border-line bg-warning-tint p-4 text-sm">
          <p className="font-semibold">Không phải lỗi của bạn</p>
          <p className="mt-1">
            {skipped} câu không chạy xong vì dịch vụ AI quá tải hoặc máy chủ hết lượt gọi hôm nay.
            Số sao lượt này có thể thấp hơn mức cấu hình của bạn xứng đáng. Thử lại sau.
          </p>
        </div>
      )}

      {copy && score.stars >= 1 && (
        <figure className="mt-5 max-w-prose rounded-md border border-line bg-surface p-4">
          <figcaption className="text-sm font-bold">Cô Lan</figcaption>
          <blockquote className="mt-1">{score.s3 ? copy.win3 : copy.win1}</blockquote>
        </figure>
      )}

      <p className="mt-5 max-w-prose text-sm text-fg-muted">
        {calls.real === 0
          ? "Mọi câu trả lời lấy từ kết quả đã lưu: cùng cấu hình thì cùng kết quả."
          : `Lượt này gọi AI thật ${calls.real} lần${calls.replayed > 0 ? `, ${calls.replayed} câu lấy kết quả đã lưu` : ""}.`}
      </p>

      <h3 id="wb-diagnosis-title" className="mt-8 text-lg font-bold">
        Cô Lan chẩn đoán
      </h3>
      {run.phase === "failed" ? (
        // The stars came, then the run failed before its gold reveal (§8.6).
        <p className="mt-2 max-w-prose text-sm">
          Máy chủ đã chấm sao nhưng phần chẩn đoán chưa tới được. Chạy lại cùng cấu hình để xem: các
          câu đã chạy xong dùng kết quả đã lưu.
        </p>
      ) : !run.report ? (
        <p className="mt-2 text-sm text-fg-muted">Đang mở đáp án…</p>
      ) : run.report.diagnosis.length === 0 ? (
        <p className="mt-2 text-sm">Không có câu nào cần chẩn đoán.</p>
      ) : (
        <ul aria-labelledby="wb-diagnosis-title" className="mt-3 max-w-prose space-y-3">
          {groupDiagnosis(run.report.diagnosis).map((group) => {
            const [first, ...rest] = group.cases.flatMap((id) => {
              const c = run.cases.find((item) => item.id === id);
              return c ? [c] : [];
            });
            const target = diagnosisTarget(env, group, run.report?.gold, runGraph);
            const showSlot = target !== null && hasControls(env, target.slot);
            const attached = graph.nodes.some((node) => node.type === target?.slot);
            return (
              <li key={group.flag} className="rounded-md border border-line bg-surface p-3">
                <p>{rich(flagWords(group.message_vi))}</p>
                {showSlot && target.why && <p className="mt-1 text-sm">{target.why}</p>}
                {rest.length > 0 && (
                  <p className="mt-1 text-sm">
                    Cùng lỗi ở{" "}
                    {rest.map((c, index) => (
                      <span key={c.id}>
                        {index > 0 && ", "}
                        <a
                          href={`#cau-${c.n}`}
                          className="font-semibold text-brand underline underline-offset-4"
                        >
                          câu #{c.n}
                        </a>
                      </span>
                    ))}
                    .
                  </p>
                )}
                {(first ?? showSlot) && (
                  <div className="mt-1 flex flex-wrap gap-x-5">
                    {first && (
                      <a
                        href={`#cau-${first.n}`}
                        className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4"
                      >
                        Xem câu #{first.n}
                      </a>
                    )}
                    {showSlot && (
                      <button
                        type="button"
                        onClick={() => onFocusSlot(target.slot, target.param)}
                        className={buttonClass("inline")}
                      >
                        {attached ? "Xem ở" : "Thử gắn"} {TOY[target.slot].name}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mt-8 text-lg font-bold">Từng câu</h3>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {run.cases.map((c) => (
          <CaseCard key={c.id} env={env} c={c} gold={run.report?.gold[c.id]} runGraph={runGraph} />
        ))}
      </div>

      {run.models && Object.keys(run.models).length > 0 && (
        <p className="mt-6 text-sm text-fg-muted">
          Model đã trả lời:{" "}
          {Object.entries(run.models)
            .map(([model, count]) => `${model} (${count} lời gọi)`)
            .join(" · ")}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        <button type="button" onClick={onEdit} className={buttonClass("primary")}>
          Chỉnh rồi chạy lại
        </button>
        <Link to={backTo} className={buttonClass("quiet")}>
          {BACK_TO_LEVELS}
        </Link>
      </div>
    </section>
  );
}

function CaseCard({
  env,
  c,
  gold,
  runGraph,
}: {
  env: Env;
  c: CaseView;
  gold: GoldReveal | undefined;
  runGraph: Graph | null;
}) {
  const titleId = `cau-${c.n}-title`;
  return (
    <article
      id={`cau-${c.n}`}
      aria-labelledby={titleId}
      className="min-w-0 rounded-md border border-line bg-surface p-4"
    >
      <h4 id={titleId} className="font-semibold">
        {caseTitle(c, env.level.id)}
      </h4>
      {c.question && <p className="mt-1 text-sm text-fg-muted">{c.question}</p>}
      <Grade c={c} />
      <p className="mt-2 text-sm text-fg-muted tabular-nums">
        {fmt(c.tokens.in + c.tokens.out)} token
      </p>
      <details className="group mt-1">
        <summary className="flex min-h-11 cursor-pointer items-center gap-1 text-sm font-semibold text-brand">
          Xem vết chạy<span className="sr-only"> câu #{c.n}</span>
          <ChevronDownIcon />
        </summary>
        <ol className="space-y-1 text-sm">
          {Object.entries(c.steps).map(([node, step]) => {
            const block = asBlock(step.block);
            return (
              <li key={node}>
                <span className="font-semibold">{block ? toyName(block) : node}</span> ·{" "}
                {stepStatusText(step.status, step.ms)}
                {step.summary && <span className="text-fg-muted"> · {step.summary}</span>}
              </li>
            );
          })}
        </ol>
        {c.answer && (
          <blockquote className="mt-2 border-l-2 border-line-strong pl-3 text-sm whitespace-pre-line">
            {c.answer}
          </blockquote>
        )}
        {gold && <GoldTrace env={env} c={c} gold={gold} runGraph={runGraph} />}
      </details>
    </article>
  );
}

const RANKED: readonly BlockType[] = ["vector_search", "bm25_search", "fusion", "rerank"];

function GoldTrace({
  env,
  c,
  gold,
  runGraph,
}: {
  env: Env;
  c: CaseView;
  gold: GoldReveal;
  runGraph: Graph | null;
}) {
  // A question with no answer has no gold at all. An empty `gold_chunks` alone also means the
  // chunker cut every answer sentence in half: the pieces still have ranks and the case its
  // `ret.boundary_split` flag (§8.6).
  const split = gold.gold_chunks.length === 0;
  if (
    split &&
    c.role === "trap" &&
    gold.flags.length === 0 &&
    Object.values(gold.ranks).every((rank) => rank === null)
  ) {
    return (
      <p className="mt-2 text-sm">
        Quy chế không có đoạn nào trả lời câu này: trợ lý phải nói 'không có'.
      </p>
    );
  }
  const ids = nodeIds(env.level);
  const params = (node: string) => runGraph?.nodes.find((n) => n.id === node)?.params ?? {};
  const lines = RANKED.flatMap((type) => {
    const node = ids[type];
    if (!(node in gold.ranks)) return [];
    const rank = gold.ranks[node] ?? null;
    const own = params(node);
    const toy = toyName(type, own);
    if (type === "vector_search" || type === "bm25_search") {
      const hook = TOY[type].params?.top_k ?? "Móc kéo";
      const where = rank === null ? "không có trong toàn kho" : `hạng ${rank} trên toàn kho`;
      const d = domain(env, type, "top_k");
      const max = d?.kind === "range" ? `, tối đa ${d.max}` : "";
      return [
        `${toy}: ${where}, ${hook} lấy ${typeof own.top_k === "number" ? own.top_k : "?"}${max}`,
      ];
    }
    const kept = type === "rerank" ? own.top_n : own.top_k;
    const size = typeof kept === "number" ? kept : "?";
    return [
      rank === null
        ? `${toy}: không có trong ${size} đoạn giữ lại`
        : `${toy}: hạng ${rank} trong ${size} đoạn giữ lại`,
    ];
  });
  return (
    <div className="mt-2 space-y-1 text-sm">
      <p>
        {split
          ? "Không đoạn nào của cách chia này chứa trọn câu đáp án."
          : `Đoạn đáp án: ${gold.in_pack ? "đã vào thùng" : "không vào thùng"}.`}
      </p>
      {lines.length > 0 && (
        <>
          <p>{split ? "Hạng của mảnh đứng cao nhất qua từng khối:" : "Hạng qua từng khối:"}</p>
          <ul className="list-inside list-disc">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      )}
      {gold.flags.length > 0 && (
        <ul className="list-inside list-disc text-fg-muted">
          {gold.flags.map((flag) => (
            <li key={flag}>{FLAG_VI[flag] ?? flag}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
