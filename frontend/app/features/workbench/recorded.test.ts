import { describe, expect, it } from "vitest";

import { parseRecorded, recordedUrl, replayRecorded } from "./recorded";
import { LEVEL_IDS, readText } from "./test-fixtures";

const file = (id: string) => JSON.parse(readText("public", "runs", `${id}.json`)) as unknown;

describe("parseRecorded", () => {
  it.each(LEVEL_IDS)("reads the log B0 shipped for %s", (id) => {
    const log = parseRecorded(id, 1, file(id));
    expect(log?.events.length).toBeGreaterThan(0);
    expect(log?.events[0]?.type).toBe("run.started");
  });

  it("marks the log as a recorded run, so nothing downstream reads it as an attempt", () => {
    const log = parseRecorded("grounded-citation", 1, file("grounded-citation"));
    const started = log?.events[0];
    expect(started?.type === "run.started" && started.scope).toBe("da_ghi");
  });

  it("refuses a log recorded against a different level", () => {
    expect(parseRecorded("chunk-tuning", 1, file("grounded-citation"))).toBeNull();
  });

  // The log is a frozen answer to a question the level asks. A level whose cases or rules moved
  // on would be answered with last month's run, silently.
  it("refuses a log recorded against an older version of the level", () => {
    expect(parseRecorded("grounded-citation", 2, file("grounded-citation"))).toBeNull();
  });

  it("refuses a file in a format it does not know", () => {
    const bumped = { ...(file("grounded-citation") as object), format: 2 };
    expect(parseRecorded("grounded-citation", 1, bumped)).toBeNull();
  });

  it("refuses junk rather than throwing at the caller", () => {
    expect(parseRecorded("grounded-citation", 1, null)).toBeNull();
    expect(parseRecorded("grounded-citation", 1, { events: "no" })).toBeNull();
  });

  it("drops an event the engine contract does not describe, and keeps the rest", () => {
    const base = file("grounded-citation") as { events: unknown[] };
    const withJunk = { ...base, events: [...base.events, { type: "run.gossip", hi: 1 }] };
    expect(parseRecorded("grounded-citation", 1, withJunk)?.events).toHaveLength(
      base.events.length,
    );
  });

  it("replays into a finished run with every case graded", () => {
    const log = parseRecorded("grounded-citation", 1, file("grounded-citation"));
    if (!log) throw new Error("the shipped L1 log does not parse");
    const run = replayRecorded(log);
    expect(run?.phase).toBe("finished");
    expect(run?.stream).toBe("closed");
    expect(run?.scope).toBe("da_ghi");
    expect(run?.cases).toHaveLength(10);
    expect(run?.cases.every((c) => c.state === "graded")).toBe(true);
  });
});

describe("recordedUrl", () => {
  it("points at the static file, not at the API that may be asleep", () => {
    expect(recordedUrl("grounded-citation")).toBe("/runs/grounded-citation.json");
  });

  it("will not let a level id climb out of the runs folder", () => {
    expect(recordedUrl("../../etc/passwd")).toBe("/runs/..%2F..%2Fetc%2Fpasswd.json");
  });
});
