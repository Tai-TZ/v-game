import { CompassIcon, RotateCcwIcon, RotateCwIcon } from "~/components/ui/icons";

import { HOME_YAW } from "../camera";
import { viewNeedle } from "../scene/labels";
import { hubStore, useHub } from "../store";
import { STAGE, useSceneLoad } from "./sceneLoad";

const BUTTON = "grid size-11 place-items-center text-fg";
const LIVE = "cursor-pointer hover:bg-subtle";
const LEFT = "Xoay ngược chiều kim đồng hồ";
const HOME = "Về góc nhìn mặc định";
const RIGHT = "Xoay theo chiều kim đồng hồ";

/** Mouse-down keeps focus on the scene, so the movement keys still work after a click. */
const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault();

const registerNeedle = (element: SVGGElement | null) => {
  viewNeedle.element = element;
  // Until the next frame draws, show where the view already is (a remount mid-visit).
  if (element) {
    const { yaw } = hubStore.getState().view;
    element.style.transform = `rotate(${(yaw - HOME_YAW).toFixed(4)}rad)`;
  }
};

/**
 * "Góc nhìn" (orbit-camera §2.3): turn the campus 90° either way or back to the home view, the
 * path that needs no dragging (WCAG 2.2, 2.5.7). Lives in CampusScene, so it shows only with a
 * scene, and only from its first frame on; a modal dialog makes it inert. The compass is `aria-disabled` at home, not `disabled`,
 * so focus stays on it after it brings the view home.
 */
export function ViewControls() {
  const rotated = useHub((state) => state.rotated);
  // Not over the loader card, and no turn before the first frame lands on its home blueprint.
  const ready = useSceneLoad((s) => s.stage >= STAGE.done);
  if (!ready) return null;
  const rotate = (dir: -1 | 0 | 1) => () => hubStore.getState().rotateView(dir);
  return (
    <div
      role="group"
      aria-label="Góc nhìn"
      className="on-scene absolute right-4 bottom-20 z-20 flex rounded-sm border border-line-strong bg-surface lg:right-6 lg:bottom-6"
    >
      <button
        type="button"
        aria-label={LEFT}
        title={`${LEFT} (phím ,)`}
        onMouseDown={keepFocus}
        onClick={rotate(-1)}
        className={`${BUTTON} ${LIVE}`}
      >
        <RotateCcwIcon className="size-5" />
      </button>
      <button
        type="button"
        aria-label={HOME}
        title={HOME}
        aria-disabled={!rotated}
        onMouseDown={keepFocus}
        onClick={rotated ? rotate(0) : undefined}
        className={`${BUTTON} border-x border-line ${rotated ? LIVE : "opacity-50"}`}
      >
        <CompassIcon className="size-5" needleRef={registerNeedle} />
      </button>
      <button
        type="button"
        aria-label={RIGHT}
        title={`${RIGHT} (phím .)`}
        onMouseDown={keepFocus}
        onClick={rotate(1)}
        className={`${BUTTON} ${LIVE}`}
      >
        <RotateCwIcon className="size-5" />
      </button>
    </div>
  );
}
