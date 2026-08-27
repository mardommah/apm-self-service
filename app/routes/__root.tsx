import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "../styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Klinik Syamsinar Maros Self Service" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  scripts: () =>
    import.meta.env.DEV
      ? [
          {
            type: "module",
            children: `
              import RefreshRuntime from "/_build/@react-refresh";
              RefreshRuntime.injectIntoGlobalHook(window);
              window.$RefreshReg$ = () => {};
              window.$RefreshSig$ = () => (type) => type;
              window.__vite_plugin_react_preamble_installed__ = true;
            `,
          },
          {
            type: "module",
            src: import.meta.env.SSR
              ? `/_build/@fs${process.cwd()}/app/client.tsx`
              : undefined,
          },
        ]
      : [],
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});

function NotFoundPage() {
  return (
    <main className="min-h-dvh grid place-items-center bg-gray-50 px-6 text-center">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Halaman tidak ditemukan</h1>
        <a
          href="/kiosk"
          className="mt-6 inline-flex rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800"
        >
          Kembali ke Kiosk
        </a>
      </div>
    </main>
  );
}

function RootComponent() {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
