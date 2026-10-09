import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { type Env, graphFromBench, starterBench } from "./bench";
import { RunPanel, type RequestState } from "./RunPanel";
import { testEnv } from "./test-fixtures";

const l1 = testEnv("grounded-citation");
const nothing = () => undefined;

function Panel({ request, env = l1 }: { request: RequestState; env?: Env }) {
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
        onOpen={nothing}
        onRetry={nothing}
        onRestore={nothing}
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
