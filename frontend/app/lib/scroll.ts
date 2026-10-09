import type { Location } from "react-router";

/**
 * ScrollRestoration key. The first page of a visit (direct link, new tab) and a native hash
 * entry under it ("Xem câu #2") both have the key "default", so Back would restore the hash's
 * position over the page's: key those by pathname and hash instead.
 */
export const scrollKey = ({ key, pathname, hash }: Pick<Location, "key" | "pathname" | "hash">) =>
  key === "default" ? pathname + hash : key;
