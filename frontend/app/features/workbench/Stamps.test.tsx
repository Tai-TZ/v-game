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

describe("what the stamp wall actually draws", () => {
  const kinds = () =>
    [...document.querySelectorAll("[data-stamp]")].map((el) => el.getAttribute("data-stamp"));

  it("marks each sentence with its own kind, so the three read apart", () => {
    // One sentence per kind: in the bin, not in the bin, and citing nothing at all.
    render(
      <Stamps
        answer="Nộp trước hai tuần [aa11]. Theo Điều 47 [zz99]. Thường thì trường nào cũng vậy."
        included={["aa11"]}
      />,
    );
    expect(kinds()).toEqual(["brick", "fake", "bubble"]);
  });

  it("gives a fabricated citation a different look from a sourced one", () => {
    render(<Stamps answer="A [aa11]. B [zz99]." included={["aa11"]} />);
    const [brick, fake] = [...document.querySelectorAll("[data-stamp]")] as HTMLElement[];
    // A sighted player has to be able to tell them apart; L1 is the level about exactly this.
    expect(brick?.className).not.toBe(fake?.className);
  });

  it("draws one card per sentence of the answer", () => {
    render(<Stamps answer="Một. Hai. Ba." included={[]} />);
    expect(kinds()).toHaveLength(3);
  });
});
