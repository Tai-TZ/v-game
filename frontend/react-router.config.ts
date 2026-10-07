import type { Config } from "@react-router/dev/config";

export default {
  // Static deployment: no runtime server. The landing page is pre-rendered at build
  // time; every other path falls back to the SPA shell (__spa-fallback.html).
  ssr: false,
  prerender: ["/"],
} satisfies Config;
