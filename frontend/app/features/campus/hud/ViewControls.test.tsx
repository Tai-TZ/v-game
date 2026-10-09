import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { advanceScene, sceneLoad, STAGE } from "./sceneLoad";
import { ViewControls } from "./ViewControls";

const fresh = sceneLoad.getState();

afterEach(() => {
  cleanup();
  sceneLoad.setState(fresh, true);
});

it("shows the view buttons only once the first frame is up, never over the loader", () => {
  sceneLoad.setState({ stage: STAGE.build });
  render(<ViewControls />);
  expect(screen.queryByRole("group", { name: "Góc nhìn" })).toBeNull();

  act(() => advanceScene(STAGE.done));
  expect(screen.getByRole("group", { name: "Góc nhìn" })).toBeTruthy();
});
