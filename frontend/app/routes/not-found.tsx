import { data } from "react-router";

export function clientLoader() {
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router convention
  throw data("Not Found", { status: 404 });
}

export default function NotFound() {
  return null;
}
