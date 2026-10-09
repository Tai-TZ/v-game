import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { siteInfo } from "../sites";
import { LanDialog } from "./LanDialog";

const library = siteInfo(null).library;

function show(opening: boolean, onTeach = vi.fn(), onEnter = vi.fn()) {
  render(
    <LanDialog
      lines="first"
      library={library}
      opening={opening}
      onTeach={onTeach}
      onEnter={onEnter}
      onClose={() => undefined}
      zonesFailed={false}
      onRetry={() => undefined}
      zoneCard={null}
    />,
  );
  return { onTeach, onEnter };
}

beforeEach(() => {
  // jsdom has neither a modal <dialog> nor ResizeObserver.
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.open = true;
    },
    close(this: HTMLDialogElement) {
      this.open = false;
    },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LanDialog", () => {
  it("says the level is opening on the teach button while it loads, and ignores a second press", () => {
    const { onTeach } = show(true);
    const button = screen.getByRole("button", { name: "Đang mở màn…" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole("status").textContent).toBe("Đang mở màn…");
    fireEvent.click(button);
    expect(onTeach).not.toHaveBeenCalled();
  });

  it("enters the zone from 'Vào …' and teaches from 'Dạy trợ lý tra sách'", () => {
    const { onTeach, onEnter } = show(false);
    fireEvent.click(screen.getByRole("button", { name: `Vào ${library.name}` }));
    expect(onEnter).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Dạy trợ lý tra sách" }));
    expect(onTeach).toHaveBeenCalledOnce();
  });
});
