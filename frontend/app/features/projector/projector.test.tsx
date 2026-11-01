import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { PROJECTOR_CLASS, useProjector, useProjectorClass } from "./projector";

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove(PROJECTOR_CLASS);
});

/** A data router, since `setSearchParams` needs one to navigate. */
function at(url: string) {
  let router: ReturnType<typeof createMemoryRouter> | undefined;
  const wrapper = ({ children }: { children: ReactNode }) => {
    router ??= createMemoryRouter([{ path: "*", element: children }], { initialEntries: [url] });
    return <RouterProvider router={router} />;
  };
  return { wrapper, search: () => router?.state.location.search };
}

describe("useProjector", () => {
  it("is on only for ?chieu=1", () => {
    expect(renderHook(useProjector, at("/play/library?chieu=1")).result.current.on).toBe(true);
    expect(renderHook(useProjector, at("/play/library?chieu=0")).result.current.on).toBe(false);
    expect(renderHook(useProjector, at("/play/library")).result.current.on).toBe(false);
  });

  it("leaves by dropping the parameter and keeping any other", () => {
    const route = at("/play/library?x=2&chieu=1");
    const { result } = renderHook(useProjector, route);
    act(() => result.current.exit());
    expect(result.current.on).toBe(false);
    expect(route.search()).toBe("?x=2");
  });
});

describe("useProjectorClass", () => {
  it("puts the class on <html> while on, and takes it off when the mode or the page goes", () => {
    const root = document.documentElement;
    const { rerender, unmount } = renderHook((on: boolean) => useProjectorClass(on), {
      initialProps: true,
    });
    expect(root.classList.contains(PROJECTOR_CLASS)).toBe(true);
    rerender(false);
    expect(root.classList.contains(PROJECTOR_CLASS)).toBe(false);
    rerender(true);
    unmount();
    expect(root.classList.contains(PROJECTOR_CLASS)).toBe(false);
  });

  it("never touches <html> when off", () => {
    renderHook(() => useProjectorClass(false));
    expect(document.documentElement.classList.contains(PROJECTOR_CLASS)).toBe(false);
  });
});
