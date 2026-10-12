/**
 * jsdom implements no `window.matchMedia`, and every figure on the bench asks for one (the
 * table is the default below 640 px). Default to a wide viewport with motion allowed, which is
 * what 1280 px answers; a test that cares about the other side stubs the global itself.
 */
if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
