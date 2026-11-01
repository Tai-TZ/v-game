import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type Env, graphFromBench, starterBench } from "./bench";
import { PROJECTOR_VI, RECORDED_VI, SCRUB_VI } from "./copy";
import { EMPTY_SLIP } from "./guess";
import type { RunView } from "./run";
import { RunPanel, type RequestState } from "./RunPanel";
import { parseSse, readText, replay, testEnv } from "./test-fixtures";
import type { QuotaView } from "./useQuota";

const l1 = testEnv("grounded-citation");
const nothing = () => undefined;
const FULL: QuotaView = {
  left: 13,
  refill: "07:00",
  cost: 10,
  mode: "shift",
  note: null,
  pool: "learner",
  awake: true,
};

function Panel({
  request,
  env = l1,
  backToPassing = null,
  run = null,
  onRecorded = nothing,
  onOpen = nothing,
  recordedFailed = false,
  quota = FULL,
  projector = false,
  masked = false,
}: {
  request: RequestState;
  env?: Env;
  backToPassing?: (() => void) | null;
  run?: RunView | null;
  onRecorded?: () => void;
  onOpen?: () => void;
  recordedFailed?: boolean;
  quota?: QuotaView;
  projector?: boolean;
  masked?: boolean;
}) {
  const start = starterBench(env);
  if (!start) throw new Error(`${env.level.id} starter is not drawable`);
  const graph = graphFromBench(env, start);
  return (
    <MemoryRouter>
      <RunPanel
        env={env}
        graph={graph}
        body={JSON.stringify(graph)}
        lastBody={null}
        issues={[]}
        summary={null}
        request={request}
        notes={[]}
        run={run}
        stop={null}
        followedId={null}
        backTo="/play/library"
        slip={EMPTY_SLIP}
        onSlip={nothing}
        onOpen={onOpen}
        onRetry={nothing}
        onRestore={nothing}
        backToPassing={backToPassing}
        onFocusSlot={nothing}
        onStop={nothing}
        onReconnect={nothing}
        onRerun={nothing}
        onAbandon={nothing}
        onEdit={nothing}
        onFollow={nothing}
        onRecorded={onRecorded}
        recordedFailed={recordedFailed}
        quota={quota}
        samplesOnly={false}
        projector={projector}
        masked={masked}
      />
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe("RunPanel", () => {
  it("keeps the restore confirm shut while the graph is being sent", () => {
    const { rerender } = render(<Panel request={{ state: "idle" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục cấu hình khởi đầu" }));
    rerender(<Panel request={{ state: "sending", key: "k", body: "{}" }} />);
    // Restoring now would reset the request to idle and let a second POST out beside the first.
    expect(screen.getByRole("button", { name: "Khôi phục" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Giữ cấu hình" })).toHaveProperty("disabled", true);
  });

  it.each([
    ["grounded-citation", 10],
    ["article-number-lookup", 13], // 10 normal + 2 trap + 1 info: the info case calls the AI too
  ] as const)("counts every AI call of %s before the run", (id, calls) => {
    render(<Panel request={{ state: "idle" }} env={testEnv(id)} />);
    expect(screen.getByText(`(${calls} lời gọi)`, { exact: false })).toBeTruthy();
  });
});

describe("going back to the last version that worked", () => {
  it("asks first, then hands over, because it discards the bench on screen", () => {
    const back = vi.fn();
    render(<Panel request={{ state: "idle" }} backToPassing={back} />);
    fireEvent.click(screen.getByRole("button", { name: "Quay về bản đạt gần nhất" }));
    expect(back).not.toHaveBeenCalled();
    // The confirm names what is about to be replaced, and focus lands on it (§8.4).
    expect(screen.getByText(/thay bằng cấu hình của lượt đạt gần nhất/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Quay về" }));
    expect(back).toHaveBeenCalledOnce();
  });

  it("keeps the bench when the player backs out", () => {
    const back = vi.fn();
    render(<Panel request={{ state: "idle" }} backToPassing={back} />);
    fireEvent.click(screen.getByRole("button", { name: "Quay về bản đạt gần nhất" }));
    fireEvent.click(screen.getByRole("button", { name: "Giữ cấu hình" }));
    expect(back).not.toHaveBeenCalled();
  });

  it("offers nothing when no run of this level has earned a star", () => {
    render(<Panel request={{ state: "idle" }} backToPassing={null} />);
    expect(screen.queryByRole("button", { name: /Quay về bản đạt/ })).toBeNull();
    // The starter restore is a different offer and stays.
    expect(screen.getByRole("button", { name: "Khôi phục cấu hình khởi đầu" })).toBeDefined();
  });

  it("will not go back mid-POST, which would let a second request out", () => {
    render(
      <Panel
        request={{ state: "sending", key: "k", body: "{}" }}
        backToPassing={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Quay về bản đạt gần nhất" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});

describe("the two steps of one Mở ca are named on screen (N2)", () => {
  const running = (scope?: "mau") =>
    replay([
      {
        id: 1,
        event: "run.started",
        data: JSON.stringify({
          scope,
          ingestion: [],
          cases: [{ id: "v01", role: "visible", vai: "su-kien", question: "a" }],
        }),
      },
    ]);

  it("says a sample run is the cheap step and earns no stars", () => {
    render(<Panel request={{ state: "idle" }} run={running("mau")} />);
    expect(screen.getByText(/Thử 3 câu mẫu/)).toBeDefined();
    expect(screen.getByText(/không tính sao/)).toBeDefined();
  });

  it("says nothing of the sort on the star run, which is the one that counts", () => {
    render(<Panel request={{ state: "idle" }} run={running()} />);
    expect(screen.queryByText(/Thử 3 câu mẫu/)).toBeNull();
  });
});

describe("the recorded run is free and on offer (N4)", () => {
  it("offers to play the level's recorded run before anything has been run", () => {
    const show = vi.fn();
    render(<Panel request={{ state: "idle" }} onRecorded={show} />);
    fireEvent.click(screen.getByRole("button", { name: "Xem lượt đã ghi" }));
    expect(show).toHaveBeenCalledOnce();
  });

  // It is the thing that covers a sleeping Render, so it must read as free next to Mở ca.
  it("says the recorded run costs no AI call", () => {
    render(<Panel request={{ state: "idle" }} />);
    expect(screen.getByText(/0 lời gọi AI/)).toBeDefined();
  });

  it("says so plainly when the recording is not there, instead of a dead button", () => {
    render(<Panel request={{ state: "idle" }} recordedFailed />);
    expect(screen.getByText(/Chưa xem được lượt đã ghi/)).toBeDefined();
  });

  it("keeps the recording out of the way once a run of the player's own is on screen", () => {
    const run = replay([
      {
        id: 1,
        event: "run.started",
        data: JSON.stringify({
          ingestion: [],
          cases: [{ id: "v01", role: "visible", vai: "su-kien", question: "a" }],
        }),
      },
    ]);
    render(<Panel request={{ state: "idle" }} run={run} />);
    expect(screen.queryByRole("button", { name: "Xem lượt đã ghi" })).toBeNull();
  });
});

describe("the scrub bar waits for the run to be over (N4)", () => {
  const ten = Array.from({ length: 10 }, (_, i) => ({
    id: `c${i + 1}`,
    role: "visible",
    vai: "su-kien",
    question: "a",
  }));
  const started = {
    id: 1,
    event: "run.started" as const,
    data: JSON.stringify({ ingestion: [], cases: ten }),
  };
  const done = {
    id: 2,
    event: "run.finished" as const,
    data: JSON.stringify({ report: { gold: {}, diagnosis: [] }, models: {} }),
  };

  // Two specs read the case table's first button as the first case's row. A control put
  // inside that region above the list silently becomes that button instead -- which is
  // exactly what happened, and only CI caught it.
  it("stays outside the case table's own region", () => {
    render(<Panel request={{ state: "idle" }} run={replay([started, done])} />);
    const region = screen.getByRole("region", { name: "Bảng câu" });
    expect(region.querySelector("input[type='range']")).toBeNull();
    expect(region.querySelector("button")?.textContent).not.toContain("câu");
  });

  it("is there to walk a finished run", () => {
    render(<Panel request={{ state: "idle" }} run={replay([started, done])} />);
    expect(screen.getByRole("slider", { name: SCRUB_VI.label })).toBeDefined();
  });

  // A live run moves the followed case itself; a control fighting it would snatch the view.
  it("stays out of a run still going", () => {
    render(<Panel request={{ state: "idle" }} run={replay([started])} />);
    expect(screen.queryByRole("slider", { name: SCRUB_VI.label })).toBeNull();
  });
});

describe("the day's pool beside Mở ca (roadmap-v0.4 §5.1)", () => {
  const idle: RequestState = { state: "idle" };

  it("says what is left, when it refills, and what this shift costs", () => {
    render(<Panel request={idle} />);
    expect(screen.getByText("Còn 13 lời gọi hôm nay (ước tính) · hồi đầy lúc 07:00")).toBeTruthy();
    expect(screen.getByText("Lượt này tốn tối đa 10 lời gọi.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mở ca" })).toBeTruthy();
  });

  it("offers the 3 samples alone when the pool covers only them", () => {
    const onOpen = vi.fn();
    render(<Panel request={idle} onOpen={onOpen} quota={{ ...FULL, left: 5, mode: "sample" }} />);
    expect(screen.getByText("Quỹ hôm nay chỉ đủ cho 3 câu mẫu.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mở ca" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thử 3 câu mẫu" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("turns the button into the free recorded run once the pool is spent", () => {
    const onOpen = vi.fn();
    const onRecorded = vi.fn();
    render(
      <Panel
        request={idle}
        onOpen={onOpen}
        onRecorded={onRecorded}
        quota={{ ...FULL, left: 1, mode: "recorded" }}
      />,
    );
    // One button: the spare "watch a run" button below would only repeat it.
    fireEvent.click(screen.getByRole("button", { name: "Xem lượt đã ghi" }));
    expect(onRecorded).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("shows no number it could not read, and still lets the shift open", () => {
    render(<Panel request={idle} quota={{ ...FULL, left: null, refill: null }} />);
    expect(
      screen.getByText("Chưa đọc được quỹ hôm nay từ máy chủ; mở ca vẫn chạy được."),
    ).toBeTruthy();
    expect(screen.queryByText(/lời gọi hôm nay \(ước tính\)/)).toBeNull();
    expect(screen.getByRole("button", { name: "Mở ca" })).toBeTruthy();
  });

  it("reads a refund's outcome out as a status", () => {
    render(<Panel request={idle} quota={{ ...FULL, note: "Hoàn 3 lời gọi: bạn đoán chắc." }} />);
    expect(screen.getByRole("status").textContent).toBe("Hoàn 3 lời gọi: bạn đoán chắc.");
  });
});

describe("projector mode (lesson plan R4-R6)", () => {
  const idle: RequestState = { state: "idle" };
  const finishedRun = () => {
    // The captured L1 reference run: some cases pass and some fail, so a leak would show.
    const run = replay(parseSse(readText("e2e", "data", "run-l1-reference.sse")));
    if (!run) throw new Error("no run");
    return run;
  };

  it("asks the room by show of hands, on a sample question, with big A, B, C", () => {
    render(<Panel request={idle} projector />);
    const card = screen.getByRole("region", { name: PROJECTOR_VI.guessHeading });
    const question = l1.level.visible_cases[0]?.question ?? "";
    expect(question).not.toBe("");
    expect(card.textContent).toContain(question);
    for (const [letter, text] of PROJECTOR_VI.options) {
      expect(card.textContent).toContain(letter);
      expect(card.textContent).toContain(text);
    }
  });

  it("shows no hand-raise card off the projector", () => {
    render(<Panel request={idle} />);
    expect(screen.queryByRole("region", { name: PROJECTOR_VI.guessHeading })).toBeNull();
  });

  it("covers every graded case as 'Đã chấm' until the reveal", () => {
    const run = finishedRun();
    render(<Panel request={idle} projector masked run={run} />);
    const rows = within(screen.getByRole("region", { name: "Bảng câu" })).getAllByRole("button");
    expect(rows.length).toBe(run.cases.length);
    for (const row of rows) {
      expect(row.textContent).toContain(PROJECTOR_VI.graded);
      expect(row.textContent).not.toMatch(/Đạt|Trượt/);
    }
  });

  it("uncovers the same rows once the run is revealed", () => {
    render(<Panel request={idle} projector run={finishedRun()} />);
    expect(screen.queryByText(PROJECTOR_VI.graded)).toBeNull();
  });

  it("says the server is waking and offers the recorded run while it sleeps", () => {
    const onRecorded = vi.fn();
    render(
      <Panel
        request={idle}
        projector
        run={finishedRun()}
        onRecorded={onRecorded}
        quota={{ ...FULL, pool: "projector", awake: false }}
      />,
    );
    expect(screen.getByText(PROJECTOR_VI.waking)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: RECORDED_VI.open }));
    expect(onRecorded).toHaveBeenCalledOnce();
  });

  it("names the projector's own pool", () => {
    render(<Panel request={idle} projector quota={{ ...FULL, left: 40, pool: "projector" }} />);
    expect(screen.getByText(/^Máy chiếu còn 40 lời gọi hôm nay \(ước tính\)/)).toBeTruthy();
  });
});
