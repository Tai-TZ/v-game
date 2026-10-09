import { describe, expect, it } from "vitest";

import { scrollKey } from "./scroll";

const at = (pathname: string, hash = "", key = "default") => ({ pathname, hash, key });

describe("scrollKey", () => {
  it("tells the first page of a visit from its own hash entry (both have the key 'default')", () => {
    const page = scrollKey(at("/play/library/grounded-citation"));
    const hash = scrollKey(at("/play/library/grounded-citation", "#cau-1"));
    expect(page).not.toBe(hash);
  });

  it("keeps the history key of every entry the router made", () => {
    expect(scrollKey(at("/play/library", "", "k1"))).toBe("k1");
    expect(scrollKey(at("/play/library", "#cau-1", "k2"))).toBe("k2");
  });
});
