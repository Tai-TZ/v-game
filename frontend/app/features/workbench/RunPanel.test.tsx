import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type Env, graphFromBench, starterBench } from "./bench";
import { EMPTY_SLIP } from "./guess";
import { RunPanel, type RequestState } from "./RunPanel";
import { testEnv } from "./test-fixtures";

const l1 = testEnv("grounded-citation");
const nothing = () => undefined;

function Panel({
  request,
  env = l1,
  backToPassing = null,
}: {
  request: RequestState;
  env?: Env;
  backToPassing?: (() => void) | null;
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
        run={null}
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
