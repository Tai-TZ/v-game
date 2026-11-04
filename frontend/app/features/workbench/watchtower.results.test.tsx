import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { graphFromBench, starterBench } from "./bench";
import { Results } from "./Results";
import type { CaseView, RunView } from "./run";
import { frame, parseSse, readText, replay, testEnv } from "./test-fixtures";

/** The diagnosis of a W1 run points at the layer that can fix it (watchtower.md §3.6). */

afterEach(cleanup);

const env = testEnv("direct-injection");
const frames = parseSse(readText("e2e", "data", "run-w1-starter.sse"));
const finished = frames.findIndex((f) => f.event === "run.finished");

/** The starter run, finished with this diagnosis; the net's block on t04 is streamed first. */
function run(diagnosis: object[], blockedBy?: string): RunView {
  const net = blockedBy
    ? [
        frame(98, "step.finished", {
          case: "wt-w1-t04",
          node: "net",
          block: "pattern_guard",
          status: "ok",
          summary: "Lưới chặn.",
          tokens: { in: 0, out: 0 },
          ms: 0,
          facts: [{ kind: "guard", by: "pattern", decision: "block", matched: blockedBy }],
        }),
      ]
    : [];
  const view = replay([
    ...frames.slice(0, finished),
    ...net,
    frame(99, "run.finished", { report: { gold: {}, diagnosis }, models: {} }),
  ]);
  if (!view) throw new Error("no run");
  return view;
}

function show(
  view: RunView,
  onFocusSlot = vi.fn(),
  hintsBelow = false,
  /** `outside` stands for the rest of the page, drawn before the results. */
  { outside, onLook = () => undefined }: { outside?: ReactNode; onLook?: () => void } = {},
) {
  const bench = starterBench(env);
  if (!bench) throw new Error("the W1 starter is not drawable");
  const graph = graphFromBench(env, bench);
  render(
    <MemoryRouter>
      {outside}
      <Results
        env={env}
        run={view}
        changed={false}
        runGraph={graph}
        graph={graph}
        backTo="/play/watchtower"
        slip={null}
        history={[]}
        onDebrief={() => undefined}
        onDuplicate={() => undefined}
        onEdit={() => undefined}
        onFocusSlot={onFocusSlot}
        onLook={onLook}
        hintsBelow={hintsBelow}
      />
    </MemoryRouter>,
  );
  return onFocusSlot;
}

describe("the W1 diagnosis", () => {
  it("opens the very phrase that stopped a real customer", () => {
    const focus = show(
      run(
        [{ case: "wt-w1-t04", flag: "guard.blocked_benign", message_vi: "Câu #12 bị chặn." }],
        "bỏ qua",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xem cụm «bỏ qua»" }));
    expect(focus).toHaveBeenCalledWith("pattern_guard", "phrases", "bỏ qua");
  });

  it("opens the net's tray without a phrase when the net did not stop the customer", () => {
    const focus = show(
      run([{ case: "wt-w1-t04", flag: "guard.blocked_benign", message_vi: "Câu #12 bị chặn." }]),
    );
    fireEvent.click(screen.getByRole("button", { name: /Lưới cụm từ/ }));
    expect(focus).toHaveBeenCalledWith("pattern_guard", "phrases", null);
  });

  it("offers to attach the bell to a refund nobody approved", () => {
    const focus = show(
      run([{ case: "wt-w1-t01", flag: "ledger.refund_wrong", message_vi: "Câu #9 hoàn sai." }]),
    );
    fireEvent.click(screen.getByRole("button", { name: /Chuông duyệt/ }));
    expect(focus).toHaveBeenCalledWith("human_approval", "policy", null);
  });
});

describe("the W1 results read in Vietnamese", () => {
  const RAW = [
    "no_wrong_refund",
    "served",
    "ledger.refund_wrong",
    "hitl.bypassed",
    "guard.passed_encoded",
    "guard.blocked_benign",
    "hitl.over_asked",
    "hoan-trong-hop-le",
    "lanh-tinh-co-tu-cam",
    "tra-don",
  ];

  it("names no engine id or case slug anywhere a player reads", () => {
    show(run([]));
    const text = document.body.textContent;
    for (const id of RAW) expect(text, id).not.toContain(id);
  });

  it("names the star-1 case by its own number, not as case #1", () => {
    show(run([]));
    const text = document.body.textContent;
    // The first case star 1 requires on W1 is the five-million refund, case #9.
    expect(text).toContain("câu #9: Trượt");
    expect(text).not.toContain("câu #1 (chị Thảo)");
  });
});

describe("what to do next sits right under the diagnosis (plan v0.7 3.2)", () => {
  it("puts 'Chỉnh rồi chạy lại' before the case list, not after the history", () => {
    show(run([{ case: "wt-w1-t01", flag: "hitl.bypassed", message_vi: "Câu #9 chạy thẳng." }]));
    const actions = document.querySelector("[data-after-run-actions]");
    const cases = screen.getByRole("heading", { name: "Từng câu" });
    expect(actions).not.toBeNull();
    expect(actions?.compareDocumentPosition(cases)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getAllByRole("button", { name: "Chỉnh rồi chạy lại" })).toHaveLength(1);
  });

  it("offers a way down to the hints only when the ladder is there", () => {
    show(run([]), vi.fn(), true);
    expect(screen.getByRole("link", { name: "Xem gợi ý" }).getAttribute("href")).toBe("#wb-hints");
    cleanup();
    show(run([]));
    expect(screen.queryByRole("link", { name: "Xem gợi ý" })).toBeNull();
  });
});

describe("the scale bill on a W1 result", () => {
  it("is offered under the stars, from the run's own tokens", () => {
    show(run([]));
    expect(document.querySelector("[data-scale-bill]")).not.toBeNull();
  });
});

describe("the trace book before the W1 diagnosis (plan v0.7 2.3)", () => {
  const diagnosis = [
    { case: "wt-w1-t01", flag: "hitl.bypassed", message_vi: "Hoàn tiền không ai duyệt." },
    { case: "wt-w1-t02", flag: "hitl.bypassed", message_vi: "Hoàn tiền không ai duyệt." },
    { case: "wt-w1-t03", flag: "hitl.bypassed", message_vi: "Hoàn tiền không ai duyệt." },
  ];
  const diagnosisShown = () => document.querySelector("[data-diagnosis-source]") !== null;

  it("holds the diagnosis back until the book is solved", () => {
    show(run(diagnosis));
    expect(document.querySelectorAll("[data-trace-row]")).toHaveLength(3);
    expect(diagnosisShown()).toBe(false);
    for (const select of screen.getAllByRole("combobox")) {
      fireEvent.change(select, { target: { value: "human_approval" } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra sổ" }));
    expect(diagnosisShown()).toBe(true);
  });

  it("keeps it back after a wrong check, and gives it up on a skip", () => {
    show(run(diagnosis));
    for (const select of screen.getAllByRole("combobox")) {
      fireEvent.change(select, { target: { value: "pattern_guard" } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra sổ" }));
    expect(diagnosisShown()).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua, xem chẩn đoán" }));
    expect(diagnosisShown()).toBe(true);
    expect(document.querySelector("[data-trace-row]")).toBeNull();
  });
});

describe("every case a tile that opens (plan v0.7 3.2)", () => {
  /** The tile's article, the button in its heading, and the body that button controls. */
  const tile = (n: number) => {
    const article = document.getElementById(`cau-${n}`);
    const button = article?.querySelector("h4 button");
    const body = document.getElementById(button?.getAttribute("aria-controls") ?? "");
    if (!article || !(button instanceof HTMLButtonElement) || !body) {
      throw new Error(`case #${n} has no tile`);
    }
    return { article, button, body };
  };
  const opened = () => [...document.querySelectorAll("article[data-case-open]")].map((a) => a.id);
  const criteria = (n: number) => within(tile(n).article).queryByRole("list", { name: "Tiêu chí" });

  // A link's click leaves its hash in the address, and a tile reads the address when it mounts.
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("starts every case closed, its verdict drawn with an icon and in words", () => {
    show(run([]));
    const articles = [...document.querySelectorAll("article[id^='cau-']")];
    expect(articles).toHaveLength(12);
    expect(opened()).toEqual([]);
    for (let n = 1; n <= 12; n++) {
      expect(tile(n).button.getAttribute("aria-expanded"), `#${n}`).toBe("false");
      expect(tile(n).body.hidden, `#${n}`).toBe(true);
    }
    // The starter lets the three refund traps through (#9-#11) and serves everyone else.
    const failed = [9, 10, 11];
    expect(
      articles.map((article) => {
        const verdict = article.querySelector("[data-case-verdict]");
        return `${article.id} ${verdict?.getAttribute("data-case-verdict")} ${verdict?.textContent}`;
      }),
    ).toEqual(
      articles.map((_, i) =>
        failed.includes(i + 1) ? `cau-${i + 1} fail Trượt` : `cau-${i + 1} pass Đạt`,
      ),
    );
    // Not the colour alone: the two verdicts draw two different marks.
    const mark = (n: number) => tile(n).article.querySelector("[data-case-verdict] svg")?.innerHTML;
    expect(mark(1)).toBeTruthy();
    expect(mark(9)).toBeTruthy();
    expect(mark(1)).not.toBe(mark(9));
  });

  it("opens on a press, criteria in view, closes on the next, and lets several stay open", () => {
    show(run([]));
    const nine = tile(9);
    expect(criteria(9)).toBeNull();
    fireEvent.click(nine.button);
    expect(nine.button.getAttribute("aria-expanded")).toBe("true");
    expect(nine.body.hidden).toBe(false);
    expect(opened()).toEqual(["cau-9"]);
    expect(criteria(9)).not.toBeNull();
    // The verdict is said once: the heading carries it, the body keeps only the criteria.
    expect(within(nine.article).getAllByText("Trượt", { exact: true })).toHaveLength(1);

    fireEvent.click(tile(10).button);
    expect(opened()).toEqual(["cau-9", "cau-10"]);
    fireEvent.click(nine.button);
    expect(nine.button.getAttribute("aria-expanded")).toBe("false");
    expect(nine.body.hidden).toBe(true);
    expect(criteria(9)).toBeNull();
    expect(opened()).toEqual(["cau-10"]);
  });

  it("opens the case a link anywhere on the page points at, the same link twice too", () => {
    show(run([]), vi.fn(), false, { outside: <a href="#cau-9">Xem câu #9</a> });
    const link = screen.getByRole("link", { name: "Xem câu #9" });
    // Stopped on its way up, as a React onClick's stopPropagation would: only a listener in the
    // capture phase still hears it.
    link.addEventListener("click", (event) => event.stopPropagation());
    fireEvent.click(link);
    expect(opened()).toEqual(["cau-9"]);
    expect(criteria(9)).not.toBeNull();
    // A link only ever opens: followed again while its case is open ("Xem câu #9" in the book,
    // then in the diagnosis), it must not fold the case the browser is scrolling to.
    fireEvent.click(link);
    expect(opened()).toEqual(["cau-9"]);
    expect(criteria(9)).not.toBeNull();
    fireEvent.click(tile(9).button);
    expect(opened()).toEqual([]);
    // The address already says #cau-9, so no hashchange comes: the click alone opens it.
    fireEvent.click(link);
    expect(opened()).toEqual(["cau-9"]);
  });

  it("opens the trace book's own case links", () => {
    const diagnosis = ["wt-w1-t01", "wt-w1-t02", "wt-w1-t03"].map((id) => ({
      case: id,
      flag: "hitl.bypassed",
      message_vi: "Hoàn tiền không ai duyệt.",
    }));
    show(run(diagnosis));
    const book = screen.getByRole("group", { name: "Sổ truy vết" });
    fireEvent.click(within(book).getByRole("link", { name: "Xem câu #10" }));
    expect(opened()).toEqual(["cau-10"]);
  });

  it("opens the case the address names, at mount and on a later hash change", () => {
    window.history.replaceState(null, "", "#cau-9");
    show(run([]));
    expect(opened()).toEqual(["cau-9"]);
    act(() => {
      window.history.replaceState(null, "", "#cau-12");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(opened()).toEqual(["cau-9", "cau-12"]);
    // Back to an address whose case is open already leaves it open.
    act(() => {
      window.history.replaceState(null, "", "#cau-9");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(opened()).toEqual(["cau-9", "cau-12"]);
  });

  it("says a case that does not count, or has no grade, in the full card's own words", () => {
    const base = run([]);
    show({
      ...base,
      cases: base.cases.map((c): CaseView => {
        // #1 counts for nothing (an info case); #2 never got its case.graded.
        if (c.n === 1 && c.graded) return { ...c, graded: { ...c.graded, counted: false } };
        if (c.n !== 2) return c;
        const { id, n, role, vai, steps, tokens } = c;
        return { id, n, role, vai, steps, tokens, state: "waiting" };
      }),
    });
    const verdict = (n: number) => tile(n).article.querySelector("[data-case-verdict]");
    expect(verdict(1)?.getAttribute("data-case-verdict")).toBe("uncounted");
    expect(verdict(1)?.textContent).toBe("Không tính sao · Đạt");
    expect(verdict(2)?.getAttribute("data-case-verdict")).toBe("waiting");
    expect(verdict(2)?.textContent).toBe("Chờ");
    // No grade is a mark of its own, neither the pass (#3) nor the fail (#9) one.
    const mark = (n: number) => verdict(n)?.querySelector("svg")?.innerHTML;
    expect(mark(2)).toBeTruthy();
    expect([mark(3), mark(9)]).not.toContain(mark(2));
  });

  it("counts a failed case's trace as a look, not the press that opens its tile (L1 §11)", () => {
    const looks: number[] = [];
    show(run([]), vi.fn(), false, { onLook: () => looks.push(1) });
    fireEvent.click(tile(9).button);
    expect(looks).toHaveLength(0);
    const trace = tile(9).body.querySelector("details");
    if (!trace) throw new Error("case #9 has no trace");
    trace.open = true;
    fireEvent(trace, new Event("toggle"));
    expect(looks).toHaveLength(1);
  });
});
