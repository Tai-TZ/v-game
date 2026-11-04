import { Link, type LinkProps } from "react-router";

import { useProjectorHref } from "./projector";

/**
 * A `Link` to another `/play` page that keeps projector mode on while it is on (R1): the teacher
 * walks from the zone page into a level and back without losing the room's view. Only the
 * "Thoát chế độ chiếu" button drops the mode.
 */
export function ProjectorLink({ to, ...props }: Omit<LinkProps, "to"> & { to: string }) {
  const href = useProjectorHref();
  return <Link to={href(to)} {...props} />;
}
