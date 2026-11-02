import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";

import {
  benchFromGraph,
  graphFromBench,
  setAttached,
  setParam,
  starterBench,
  type Bench,
} from "./bench";
import { BenchSection, type BenchRunView } from "./BenchView";
import { LEVEL_COPY, npcOf } from "./copy";
import { beatLine, MachineMap } from "./MachineMap";
import { Scene } from "./Scene";
import type { EventType } from "./schema";
import { frame, levelFile, readText, replay, testEnv } from "./test-fixtures";
import { validateGraph } from "./validate";

/**
 * Watchtower W1 on the bench (watchtower.md §3.2, §3.7): the desk, its guards and the tool
 * branch. The runs are the engine's own event streams for the starter and the reference graph,
 * with the scripted model of backend/tests/engine/test_watchtower.py (e2e/data/README.md).
 */

afterEach(cleanup);

const w1 = testEnv("direct-injection");

function starter(): Bench {
  const bench = starterBench(w1);
  if (!bench) throw new Error("the W1 starter is not drawable");
  return bench;
}

function reference(): Bench {
  const bench = benchFromGraph(w1, levelFile("direct-injection").reference_graph);
  if (!bench) throw new Error("the W1 reference is not drawable");
  return bench;
}

function recorded(name: "starter" | "reference", caseId: string): BenchRunView {
  const text = readText("e2e", "data", `run-w1-${name}.sse`);
  const frames = text
    .trim()
    .split("\n\n")
    .map((block) => {
      const [id = "", event = "", data = ""] = block.split("\n");
      return frame(
        Number(id.slice(4)),
        event.slice(7) as EventType,
        JSON.parse(data.slice(6)) as object,
      );
    });
  const run = replay(frames);
  const followed = run?.cases.find((c) => c.id === caseId);
  if (!run || !followed) throw new Error(`the W1 ${name} run does not replay ${caseId}`);
  return { run, followed, gold: null };
}

function machine(
  bench: Bench,
  view: BenchRunView | null = null,
  onChange: (next: Bench) => void = () => undefined,
) {
  render(
    <MachineMap
      env={w1}
      bench={bench}
      onChange={onChange}
      disabled={false}
      states={{}}
      highlight={null}
      answer={null}
      view={view}
    />,
  );
  return screen.getByRole("group", { name: /Sơ đồ trợ lý/ });
}

const all = (selector: string) => [...document.querySelectorAll(selector)];

describe("the W1 machine", () => {
  it("runs the guards along the belt and forks the bell and the refund desk off the model", () => {
    const map = machine(reference());
    const main = all("[data-column]:not([data-branch])").map((g) => g.getAttribute("data-column"));
    expect(main).toEqual([
      "input",
      "pattern_guard",
      "injection_classifier",
      "action_llm",
      "output",
    ]);
    const fork = all("[data-branch]").map((g) => g.getAttribute("data-column"));
    expect(fork).toEqual(["human_approval", "tool_refund"]);
    expect(map.querySelector("[data-branch-base]")).not.toBeNull();
  });

  it("walks the beats in the order a case meets them, the branch right after the model", () => {
    machine(reference());
    expect(all("[data-beat]").map((b) => b.getAttribute("data-beat"))).toEqual([
      "input",
      "pattern_guard",
      "injection_classifier",
      "action_llm",
      "human_approval",
      "tool_refund",
      "output",
    ]);
    expect(document.querySelector('[data-beat="input"]')?.textContent).toBe("Bước 1: Khách gõ cửa");
  });

  it("draws the branch red with no bell on it, and gated once the bell is attached", () => {
    machine(starter());
    const pipes = () => all("[data-pipe-branch]").map((p) => p.getAttribute("data-pipe"));
    expect(pipes()).toEqual(["unguarded", "unguarded"]);
    cleanup();
    machine(setAttached(starter(), "human_approval", true));
    expect(pipes()).toEqual(["gated", "gated"]);
  });

  it("leaves an empty socket for each guard and the bell on the starter", () => {
    machine(starter());
    for (const type of ["pattern_guard", "injection_classifier", "human_approval"]) {
      expect(document.querySelector(`[data-tile-type="${type}"]`)?.getAttribute("data-tile")).toBe(
        "empty",
      );
    }
    expect(
      document.querySelector('[data-tile-type="tool_refund"]')?.getAttribute("data-tile"),
    ).toBe("on");
  });

  it("attaches the bell from its socket", () => {
    let next: Bench | null = null;
    machine(starter(), null, (bench) => (next = bench));
    const socket = document.querySelector('[data-tile-type="human_approval"]');
    if (!socket) throw new Error("no bell socket");
    fireEvent.click(socket);
    expect(next).not.toBeNull();
    expect((next as Bench | null)?.attached.human_approval).toBe(true);
  });

  it("hangs one tag in the net for every phrase in it", () => {
    machine(reference());
    expect(all("[data-gauge-phrase]")).toHaveLength(reference().phrases.length);
    expect(reference().phrases.length).toBe(3);
  });

  it("tags the bell's lid only when it asks above a threshold", () => {
    machine(reference());
    expect(document.querySelector("[data-gauge-policy]")?.getAttribute("data-gauge-policy")).toBe(
      "hoi_neu_vuot",
    );
    expect(all("[data-gauge-above]")).toHaveLength(1);
    cleanup();
    machine(setParam(w1, reference(), "human_approval", "policy", "luon_hoi"));
    expect(document.querySelector("[data-gauge-policy]")?.getAttribute("data-gauge-policy")).toBe(
      "luon_hoi",
    );
    expect(all("[data-gauge-above]")).toHaveLength(0);
  });
});

describe("the W1 machine follows a case", () => {
  it("bars the net that stopped the admin role-play, and nothing after it ran", () => {
    const view = recorded("reference", "wt-w1-t03");
    machine(reference(), view);
    expect(all("[data-gauge-stop]")).toHaveLength(1);
    expect(all("[data-gauge-bark]")).toHaveLength(0);
    const bench = reference();
    expect(beatLine("pattern_guard", w1, bench, view)).toBe(
      "Lưới chặn: khớp «quản trị viên». Câu này dừng ở đây.",
    );
    expect(beatLine("injection_classifier", w1, bench, view)).toMatch(/không tới đây/);
    expect(beatLine("tool_refund", w1, bench, view)).toMatch(/không tới đây/);
  });

  it("makes the dog bark at the base64 order the net let through", () => {
    const view = recorded("reference", "wt-w1-t02");
    machine(reference(), view);
    expect(all("[data-gauge-bark]")).toHaveLength(1);
    expect(all("[data-gauge-stop]")).toHaveLength(0);
    expect(beatLine("injection_classifier", w1, reference(), view)).toMatch(
      /^Chó gác sủa: điểm 1, ngưỡng 0,8\./,
    );
  });

  it("writes the starter's five-million refund into the ledger, run, with no bell", () => {
    const view = recorded("starter", "wt-w1-t01");
    const bench = starter();
    machine(bench, view);
    expect(all("[data-gauge-entry]").map((e) => e.getAttribute("data-gauge-entry"))).toEqual([
      "executed",
    ]);
    expect(beatLine("action_llm", w1, bench, view)).toBe(
      "Bộ Óc viết phiếu đòi hoàn 5.000.000 đ cho DH2001.",
    );
    expect(beatLine("human_approval", w1, bench, view)).toMatch(/^Không có Chuông duyệt/);
    expect(beatLine("tool_refund", w1, bench, view)).toBe(
      "Sổ: Hoàn 5.000.000 đ · DH2001 · không qua cổng duyệt · đã chạy.",
    );
  });

  it("lets a small refund through the bell without asking", () => {
    const view = recorded("reference", "wt-w1-v02");
    expect(beatLine("human_approval", w1, reference(), view)).toMatch(
      /dưới ngưỡng: chuông để chạy/,
    );
    // The visible case shows what the desk said, as the library's model does.
    expect(beatLine("action_llm", w1, reference(), view)).toBe(
      "Bộ Óc viết phiếu đòi hoàn 120.000 đ cho DH1042: «Mình đã hoàn 120.000 đ.»",
    );
  });

  it("says who held a refund the bell asked about", () => {
    const view = recorded("reference", "wt-w1-v02");
    const desk = view.followed.steps.desk;
    if (!desk?.facts) throw new Error("no desk step");
    const held: BenchRunView = {
      ...view,
      followed: {
        ...view.followed,
        steps: {
          ...view.followed.steps,
          desk: {
            ...desk,
            facts: desk.facts.map((f) =>
              f.kind === "ledger"
                ? {
                    ...f,
                    entries: f.entries.map((e) => ({
                      ...e,
                      approval: "denied" as const,
                      executed: false,
                    })),
                  }
                : f,
            ),
          },
        },
      },
    };
    expect(beatLine("human_approval", w1, reference(), held)).toMatch(/người duyệt từ chối/);
    expect(beatLine("tool_refund", w1, reference(), held)).toBe(
      "Sổ: Hoàn 120.000 đ · DH1042 · người duyệt từ chối · không chạy.",
    );
    machine(reference(), held);
    expect(all("[data-gauge-entry]").map((e) => e.getAttribute("data-gauge-entry"))).toEqual([
      "held",
    ]);
  });

  it("never quotes a hidden case's message, only what the desk asked for", () => {
    const view = recorded("starter", "wt-w1-h03");
    expect(view.followed.role).toBe("hidden");
    const line = beatLine("action_llm", w1, starter(), view);
    expect(line).toBe("Bộ Óc viết phiếu đòi hoàn 85.000 đ cho DH4120.");
    expect(beatLine("input", w1, starter(), view)).toMatch(/không hiện câu hỏi/);
  });
});

function Desk({
  bench,
  view = null,
  onChange = () => undefined,
}: {
  bench: Bench;
  view?: BenchRunView | null;
  onChange?: (next: Bench) => void;
}) {
  const graph = graphFromBench(w1, bench);
  return (
    <BenchSection
      env={w1}
      bench={bench}
      graph={graph}
      onChange={onChange}
      locked={false}
      issues={validateGraph(w1, graph)}
      highlight={null}
      view={view}
      preview={null}
      benchRun={view ? "done" : "none"}
      viz={null}
      vizCase={null}
      saved={false}
      discarded={false}
    />
  );
}

describe("the W1 bench", () => {
  it("lays the slots out in the order a case meets them, with no library toy missing", () => {
    render(<Desk bench={reference()} />);
    const titles = all("section[aria-labelledby] h3").map((h) => h.textContent);
    expect(titles).toEqual([
      "Chuông quầy",
      "Lưới cụm từ",
      "Chó gác",
      "Bộ Óc",
      "Chuông duyệt",
      "Bàn hoàn tiền",
      "Bảng trả lời",
    ]);
    expect(screen.queryByText(/Chưa mở ở màn này/)).toBeNull();
  });

  it("opens on the net, whose phrases are chips pressed in from the tray", () => {
    let next: Bench | null = null;
    render(<Desk bench={reference()} onChange={(bench) => (next = bench)} />);
    const tray = document.querySelector("[data-phrase-tray]");
    if (!tray) throw new Error("the net is not open");
    const chips = within(tray as HTMLElement).getAllByRole("button");
    expect(chips).toHaveLength(w1.level.phrase_tray.length);
    expect(
      chips.filter((c) => c.getAttribute("aria-pressed") === "true").map((c) => c.textContent),
    ).toEqual(["bỏ qua hướng dẫn", "quản trị viên", "lệnh kiểm thử"]);
    expect(tray.textContent).toMatch("3/16 cụm đang trong lưới");
    fireEvent.click(screen.getByRole("button", { name: "bỏ qua" }));
    expect((next as Bench | null)?.phrases).toEqual([
      "bỏ qua",
      "bỏ qua hướng dẫn",
      "quản trị viên",
      "lệnh kiểm thử",
    ]);
  });

  it("gives the watchdog a threshold slider and says its scores were taken beforehand", () => {
    render(<Desk bench={reference()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mở Chó gác" }));
    const slider = screen.getByRole("slider", { name: /Ngưỡng/ });
    expect(slider.getAttribute("min")).toBe("0.5");
    expect(slider.getAttribute("max")).toBe("0.95");
    expect(document.querySelector("[data-precomputed]")?.textContent).toMatch(
      /chấm sẵn bằng model/,
    );
  });

  it("lets the bell ask always or only above an amount, in đồng", () => {
    render(<Desk bench={reference()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mở Chuông duyệt" }));
    expect(screen.getByRole("radio", { name: "Luôn hỏi" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "Hỏi khi vượt ngưỡng" })).toBeDefined();
    const amount = screen.getByRole("slider", { name: /Ngưỡng tiền/ });
    expect(amount.getAttribute("aria-valuetext")).toBe("500.000 đ");
  });

  it("puts the Lăng kính on the desk's model", () => {
    render(<Desk bench={reference()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mở Bộ Óc" }));
    const lens = screen.getByRole("list", { name: "Ba khe của Lăng kính" });
    // The reference's three cards sit in the three slots, read back from its system prompt.
    expect(all("[data-lens-slot]").map((el) => el.getAttribute("data-card"))).toEqual([
      "G3",
      "G4",
      "G5",
    ]);
    expect(lens).toBeDefined();
  });

  it("shows the net's verdict and the ledger in the slots of the followed case", () => {
    const view = recorded("starter", "wt-w1-t01");
    render(<Desk bench={starter()} view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Mở Bộ Óc" }));
    const book = screen.getByRole("list", { name: "Sổ ghi" });
    expect(book.querySelector("[data-ledger]")?.getAttribute("data-ledger")).toBe("executed");
    expect(book.textContent).toBe("Hoàn 5.000.000 đ · DH2001 · không qua cổng duyệt · đã chạy");
    cleanup();
    render(<Desk bench={reference()} view={recorded("reference", "wt-w1-t03")} />);
    const verdict = document.querySelector("[data-guard]");
    expect(verdict?.getAttribute("data-guard")).toBe("block");
    expect(verdict?.textContent).toBe("Lưới cụm từ: chặn · khớp «quản trị viên»");
    cleanup();
    render(<Desk bench={reference()} view={recorded("reference", "wt-w1-v01")} />);
    expect(document.querySelector("[data-guard]")?.getAttribute("data-guard")).toBe("pass");
  });

  it("answers axe's structural rules", async () => {
    const { container } = render(<Desk bench={reference()} />);
    const result = await axe.run(container, {
      runOnly: {
        type: "rule",
        values: [
          "list",
          "listitem",
          "aria-required-children",
          "aria-required-parent",
          "aria-allowed-role",
          "aria-allowed-attr",
          "aria-valid-attr-value",
          "nested-interactive",
        ],
      },
    });
    expect(result.passes.length).toBeGreaterThan(0);
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("the W1 scene", () => {
  it("opens on the refund receipt, told by anh Quân", () => {
    const copy = LEVEL_COPY["direct-injection"];
    if (!copy) throw new Error("no W1 copy");
    render(<Scene scene={copy.scene} npc={npcOf(copy)} line={copy.intro} />);
    expect(document.querySelector("[data-scene-total]")?.textContent).toBe(
      "HOÀN TIỀN 5.000.000 đ · lý do: khách xác nhận đã được quản lý đồng ý",
    );
    expect(screen.getByText("Anh Quân kể lại chuyện tối nay")).toBeDefined();
    expect(screen.queryByText(/Cô Lan/)).toBeNull();
  });
});
