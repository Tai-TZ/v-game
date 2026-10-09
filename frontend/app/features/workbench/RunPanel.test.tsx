import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { graphFromBench, starterBench } from "./bench";
import { RunPanel, type RequestState } from "./RunPanel";
import { testEnv } from "./test-fixtures";

const l1 = testEnv("grounded-citation");
const start = starterBench(l1);
if (!start) throw new Error("L1 starter is not drawable");
const graph = graphFromBench(l1, start);
const nothing = () => undefined;

function Panel({ request }: { request: RequestState }) {
  return (
    <MemoryRouter>
      <RunPanel
        env={l1}
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
});
