import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NPC_ROLES } from "../npcs";
import { siteInfo, type SiteInfo } from "../sites";
import { NpcDialog } from "./NpcDialog";

const watchtower = siteInfo(null).watchtower;

function show(props: { visits?: number; site?: SiteInfo | null; who?: "guard" | "registrar" }) {
  const onEnter = vi.fn();
  const onClose = vi.fn();
  render(
    <NpcDialog
      who={props.who ?? "guard"}
      name="role name"
      visits={props.visits ?? 0}
      site={props.site === undefined ? watchtower : props.site}
      onEnter={onEnter}
      onClose={onClose}
      zoneCard={<p>zone card</p>}
    />,
  );
  return { onEnter, onClose };
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

describe("NpcDialog (npc-cast v0.4 §7.2)", () => {
  it("names the speaker with a capital, gives the role and the greeting, focus on 'Để sau'", () => {
    const { onClose } = show({});
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Role name");
    expect(screen.getByText(NPC_ROLES.guard.subtitle)).toBeTruthy();
    for (const line of NPC_ROLES.guard.greeting) expect(screen.getByText(line)).toBeTruthy();
    // The zone is not open yet: nothing to enter.
    expect(screen.queryByRole("button", { name: /^Vào / })).toBeNull();
    const later = screen.getByRole("button", { name: "Để sau" });
    expect(document.activeElement).toBe(later);
    fireEvent.click(later);
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByText("zone card")).toBeTruthy();
  });

  it("offers the open zone first, and says one line on a later visit", () => {
    const { onEnter } = show({ visits: 2, site: { ...watchtower, status: "open" } });
    expect(screen.getByText(NPC_ROLES.guard.open[1] ?? "")).toBeTruthy();
    const enter = screen.getByRole("button", { name: `Vào ${watchtower.name}` });
    expect(document.activeElement).toBe(enter);
    fireEvent.click(enter);
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("has no zone card for a role without a zone", () => {
    show({ who: "registrar", site: null });
    expect(screen.queryByText("zone card")).toBeNull();
    expect(screen.getByText(NPC_ROLES.registrar.subtitle)).toBeTruthy();
  });
});
