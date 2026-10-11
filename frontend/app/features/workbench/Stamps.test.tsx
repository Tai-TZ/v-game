import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Stamps } from "./Stamps";

afterEach(cleanup);

describe("Stamps", () => {
  it("summarises the sentence kinds for a screen reader, without posing as a picture", () => {
    render(<Stamps answer="Nộp đơn [ab12cd34]. Bạn nên hỏi thêm." included={["ab12cd34"]} />);
    expect(screen.getByText("1 câu có nguồn, 1 câu không nguồn")).toBeDefined();
  });

  it("names a fabricated citation as such, with the id the model invented", () => {
    render(<Stamps answer="Theo Điều 47 [zz99zz99]." included={[]} />);
    expect(screen.getByText(/1 câu trích nguồn bịa/)).toBeDefined();
    expect(screen.getByText(/zz99zz99/)).toBeDefined();
  });

  it("renders nothing without an answer to stamp", () => {
    const { container } = render(<Stamps answer="" included={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
