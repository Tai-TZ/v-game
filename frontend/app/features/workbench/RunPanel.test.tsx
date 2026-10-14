import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type Env, graphFromBench, starterBench } from "./bench";
import { SCRUB_VI } from "./copy";
import { EMPTY_SLIP } from "./guess";
import type { RunView } from "./run";
import { RunPanel, type RequestState } from "./RunPanel";
import { replay, testEnv } from "./test-fixtures";

const l1 = testEnv("grounded-citation");
const nothing = () => undefined;

function Panel({
  request,
  env = l1,
  backToPassing = null,
  run = null,
  onRecorded = nothing,
  recordedFailed = false,
}: {
  request: RequestState;
  env?: Env;
  backToPassing?: (() => void) | null;
  run?: RunView | null;
  onRecorded?: () => void;
  recordedFailed?: boolean;
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
        onOpen={nothing}
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
