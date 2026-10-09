import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { starterBench } from "./bench";
import { testEnv } from "./test-fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

const l1 = testEnv("grounded-citation");
const DISCARDED = "Cấu hình đã lưu không còn hợp với màn này";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("WorkbenchPage", () => {
  it("drops the discarded-config notice once the bench saves again", () => {
    const starter = starterBench(l1);
    if (!starter) throw new Error("L1 starter is not drawable");
    window.localStorage.setItem("vg.bench.v1.grounded-citation", "{broken");
    render(
      <MemoryRouter>
        <WorkbenchPage env={l1} starter={starter} back="/play/library" />
      </MemoryRouter>,
    );
    expect(screen.getByText(DISCARDED, { exact: false })).toBeDefined();
    fireEvent.click(screen.getByRole("switch", { name: /Vòm Sao/ }));
    expect(screen.getByText("Đã lưu cấu hình trên máy này.")).toBeDefined();
    expect(screen.queryByText(DISCARDED, { exact: false })).toBeNull();
  });
});
