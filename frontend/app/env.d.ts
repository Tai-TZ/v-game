interface ImportMetaEnv {
  /** Theme pack id used for pre-rendered HTML and first-time visitors. */
  readonly VITE_DEFAULT_THEME?: string;
  /** Comma-separated theme packs to ship (public deploys: "town"); unset ships every pack. */
  readonly VITE_THEME_PACKS?: string;
  /** Absolute API origin when the API is not served from the same origin. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
