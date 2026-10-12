import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Viz } from "./Viz";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** jsdom has no matchMedia; `narrow` decides what every query answers. */
function viewport(narrow: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: narrow && query.includes("max-width"),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

const draw = () =>
  render(
    <Viz
      caption="Thùng còn chỗ: 420 trên 3.000 token."
      stamp="run"
      table={
        <table>
          <tbody>
            <tr>
              <th scope="row">Tổng</th>
              <td>420</td>
            </tr>
          </tbody>
        </table>
      }
    >
      <p data-picture>hình</p>
    </Viz>,
  );

describe("Viz", () => {
  it("wraps the picture in a figure the CI gate can find, with its takeaway and its stamp", () => {
    viewport(false);
    const { container } = draw();
    const figure = container.querySelector("figure[data-vg-viz]");
    expect(figure).not.toBeNull();
    // A picture with a table behind the toggle.
    expect(figure?.getAttribute("data-vg-viz")).toBe("both");
    expect(figure?.querySelector("figcaption")?.textContent).toContain(
      "Thùng còn chỗ: 420 trên 3.000 token.",
    );
    // One of the seven fixed stamps, word for word: no component may invent one.
    expect(figure?.textContent).toContain("Đo từ lượt của bạn");
    // role="img" on the wrapper orphaned every list item last time it was tried.
    expect(container.querySelector('[role="img"]')).toBeNull();
  });

  it("swaps the picture for the same data as a table, and back", () => {
    viewport(false);
    const { container } = draw();
    expect(container.querySelector("[data-picture]")).not.toBeNull();
    expect(container.querySelector("table")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Xem dạng bảng" }));
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("[data-picture]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Xem dạng hình" }));
    expect(container.querySelector("[data-picture]")).not.toBeNull();
  });

  it("opens as a table on a narrow screen, where the table is the main interface", () => {
    // frontend-architecture §8.2: "Ở 375 px, dạng bảng là mặc định."
    viewport(true);
    const { container } = draw();
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("[data-picture]")).toBeNull();
    expect(screen.getByRole("button", { name: "Xem dạng hình" })).toBeDefined();
  });

  it("opens as a picture on a wide screen", () => {
    viewport(false);
    const { container } = draw();
    expect(container.querySelector("[data-picture]")).not.toBeNull();
    expect(container.querySelector("table")).toBeNull();
    expect(screen.getByRole("button", { name: "Xem dạng bảng" })).toBeDefined();
  });

  it("keeps the form the player chose instead of snapping back to the viewport's", () => {
    viewport(true);
    const { container } = draw();
    fireEvent.click(screen.getByRole("button", { name: "Xem dạng hình" }));
    expect(container.querySelector("[data-picture]")).not.toBeNull();
    expect(container.querySelector("table")).toBeNull();
  });

  it("carries a description beside the stamp when the run on show is not the player's", () => {
    viewport(false);
    render(
      <Viz
        caption="x"
        stamp="recorded"
        note="Lời giải mẫu L1, không phải cấu hình của bạn."
        table={<table />}
      >
        <p data-picture>hình</p>
      </Viz>,
    );
    expect(screen.getByText(/Lượt chạy đã ghi/)).toBeDefined();
    expect(screen.getByText(/Lời giải mẫu L1, không phải cấu hình của bạn\./)).toBeDefined();
  });

  it("offers no toggle for a figure that already is a table", () => {
    // History.tsx is the real caller: its content is a literal <table>, not a picture, so
    // `form="table"` is the only legal way to opt out of the toggle -- a picture with no
    // table alternative at all cannot be constructed; it would fail to typecheck.
    viewport(false);
    render(
      <Viz caption="x" stamp="run" form="table">
        <table data-picture />
      </Viz>,
    );
    expect(screen.queryByRole("button", { name: /Xem dạng/ })).toBeNull();
    // Said on the element, so the CI gate does not have to guess from the DOM.
    expect(document.querySelector("[data-vg-viz]")?.getAttribute("data-vg-viz")).toBe("table");
    expect(document.querySelector("[data-picture]")).not.toBeNull();
  });

  it("cannot be constructed with a picture and no table alternative", () => {
    const invalid = () => (
      // @ts-expect-error -- a figure must declare form="table" or supply a table, per §8.2.
      <Viz caption="x" stamp="run">
        <p>hình</p>
      </Viz>
    );
    expect(typeof invalid).toBe("function");
  });
});

describe("the table form scrolls, so it has to be reachable", () => {
  it("gives the scrolling wrapper a tab stop", () => {
    // axe scrollable-region-focusable, serious: without this a keyboard-only player cannot
    // scroll a wide table. Here the tab stop does something, unlike a chip that does nothing.
    viewport(true);
    const { container } = draw();
    const scroller = container.querySelector(".overflow-x-auto");
    expect(scroller?.getAttribute("tabindex")).toBe("0");
    expect(scroller?.querySelector("table")).not.toBeNull();
  });
});
