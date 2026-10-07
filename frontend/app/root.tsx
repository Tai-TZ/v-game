import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { themeBootstrapScript } from "./features/theme/bootstrap";
import { loadThemeCatalog } from "./features/theme/catalog.server";
import { ThemeProvider } from "./features/theme/context";
import { THEME_STYLESHEET_ID, themeAssetUrl, themeStylesheetUrl } from "./features/theme/paths";

// Runs at build time only (pre-render and SPA shell); the result is embedded in the HTML.
export async function loader() {
  return { catalog: await loadThemeCatalog(import.meta.env.VITE_DEFAULT_THEME) };
}

export const meta: Route.MetaFunction = () => [
  { title: "V-Game — Học AI thực chiến bằng cách chơi" },
  {
    name: "description",
    content:
      "Trò chơi học tập cho người học AI: lắp agent, chạy thật trên câu hỏi của người dùng và lần theo dấu vết để hiểu vì sao nó đúng hay sai.",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const catalog = data?.catalog;
  const themeId = catalog?.defaultId;
  const fontPreloads = themeId ? (catalog.manifests[themeId]?.fonts.preload ?? []) : [];

  return (
    // The bootstrap script may switch data-theme before hydration.
    <html lang="vi" data-theme={themeId} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {themeId && (
          <>
            {fontPreloads.map((font) => (
              <link
                key={font}
                rel="preload"
                as="font"
                type="font/woff2"
                crossOrigin="anonymous"
                href={themeAssetUrl(themeId, font)}
              />
            ))}
            <link
              id={THEME_STYLESHEET_ID}
              rel="stylesheet"
              href={themeStylesheetUrl(themeId)}
              suppressHydrationWarning
            />
            <script
              // Built from validated theme ids at build time; allowed by a CSP hash.
              // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
              dangerouslySetInnerHTML={{
                __html: themeBootstrapScript(
                  catalog.themes.map((theme) => theme.id),
                  themeId,
                ),
              }}
            />
          </>
        )}
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <ThemeProvider catalog={loaderData.catalog}>
      <Outlet />
    </ThemeProvider>
  );
}

export function HydrateFallback() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <p className="text-sm text-fg-muted">Đang tải V-Game…</p>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const title = notFound ? "Không tìm thấy trang" : "Đã có lỗi xảy ra";
  const detail = notFound
    ? "Đường dẫn này không tồn tại hoặc đã được đổi."
    : "Trang không tải được. Tải lại trang hoặc quay về trang chủ.";

  return (
    <main className="mx-auto grid min-h-dvh max-w-xl content-center gap-4 px-6">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-fg-muted">{detail}</p>
      {import.meta.env.DEV && error instanceof Error && (
        <pre className="overflow-x-auto rounded-sm bg-subtle p-4 text-xs">{error.stack}</pre>
      )}
      <a href="/" className="font-semibold text-brand underline underline-offset-4">
        Về trang chủ
      </a>
    </main>
  );
}
