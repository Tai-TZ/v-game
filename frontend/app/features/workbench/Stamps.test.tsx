import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

describe("the stamp wall in its frame", () => {
  it("wears the run stamp and says what the wall shows", () => {
    render(<Stamps answer="A [aa11]. B." included={["aa11"]} />);
    expect(document.querySelector("figure[data-vg-viz]")).not.toBeNull();
    expect(document.body.textContent).toContain("Đo từ lượt của bạn");
    expect(document.querySelector("figcaption")?.textContent).toBeTruthy();
  });

  it("gives an unsourced sentence words of its own, not only a dashed border", () => {
    // L1 §12: "TRƯỢT vì thiếu nguồn: bong bóng vỡ, chữ 'không có nguồn'". Until now only the
    // fabricated kind printed words, so a bubble was style-only.
    render(<Stamps answer="Thường thì trường nào cũng vậy." included={[]} />);
    const bubble = document.querySelector('[data-stamp="bubble"]');
    expect(bubble?.textContent).toContain("không có nguồn");
  });

  it("names each sentence's kind in words in the table form", () => {
    render(<Stamps answer="A [aa11]. B [zz99]. C." included={["aa11"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Xem dạng bảng" }));
    const kinds = [...document.querySelectorAll("tbody tr")].map(
      (tr) => tr.querySelectorAll("td")[1]?.textContent,
    );
    expect(kinds).toEqual(["có nguồn trong thùng", "trích nguồn bịa", "không có nguồn"]);
  });
});
