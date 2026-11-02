import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionExport } from "./SessionExport";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("SessionExport", () => {
  it("downloads a CSV named by the code, and shows the code to copy", () => {
    const made: Blob[] = [];
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (blob: Blob) => {
        made.push(blob);
        return "blob:x";
      },
      revokeObjectURL: () => undefined,
    });
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this.download);
    });
    render(<SessionExport />);
    expect(screen.queryByText(/Mã của bạn/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tải dữ liệu buổi học" }));
    const code = window.localStorage.getItem("vg.session.v1");
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(clicked).toEqual([`v-game-${code}.csv`]);
    expect(made[0]?.type).toBe("text/csv;charset=utf-8");
    expect(screen.getByText(code ?? "")).toBeDefined();
  });
});
