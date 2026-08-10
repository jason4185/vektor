import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportError } from "../lib/error-reporting";
import { SiteHeader } from "@/components/vektor/site-header";
import { WalletProvider } from "@/lib/vektor/wallet";
import { Toaster } from "@/components/ui/sonner";
import { VektorWordmark } from "@/components/vektor/logo";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="num text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Nothing listed here</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This market or page isn't on the Vektor order book.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to markets
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This view didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page could not load. Try again, or return to the markets.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Vektor — Daily FX and Metals Markets" },
      {
        name: "description",
        content: "Vektor is a daily prediction market for GBP/USD, USD/JPY, gold, and silver.",
      },
      { name: "author", content: "Vektor" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/80 bg-surface/35">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0">
          <VektorWordmark />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Daily FX and metals prediction markets powered by GenLayer.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Markets
          </Link>
          <Link to="/create" className="hover:text-foreground">
            Create market
          </Link>
          <Link to="/portfolio" className="hover:text-foreground">
            Portfolio
          </Link>
          <Link to="/activity" className="hover:text-foreground">
            Activity
          </Link>
          <Link to="/how-it-works" className="hover:text-foreground">
            How it works
          </Link>
          <span className="ml-1 inline-flex items-center gap-1.5 border-l border-border pl-4 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground/70">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Bradbury
          </span>
        </nav>
      </div>
    </footer>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <div className="app-shell flex min-h-screen flex-col bg-background">
          <SiteHeader />
          <main className="flex-1">
            {/* Required: nested routes render here. */}
            <Outlet />
          </main>
          <SiteFooter />
        </div>
        <Toaster position="bottom-right" />
      </WalletProvider>
    </QueryClientProvider>
  );
}
