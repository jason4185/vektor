import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { VektorWordmark } from "./logo";
import { GlobalSearch } from "./global-search";

const NAV = [
  { to: "/", label: "Markets", exact: true },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/activity", label: "Activity" },
  { to: "/create", label: "Create Market" },
  { to: "/how-it-works", label: "How it works" },
] as const;

function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        if (!connected)
          return (
            <Button size="sm" className="h-9 px-4 font-semibold" onClick={openConnectModal}>
              Connect Wallet
            </Button>
          );
        if (chain.unsupported)
          return (
            <Button
              size="sm"
              variant="surface"
              className="h-9 px-3 text-down"
              onClick={openChainModal}
            >
              Wrong network
            </Button>
          );
        return (
          <Button size="sm" variant="surface" className="h-9 px-3" onClick={openAccountModal}>
            <span className="mr-2 h-2 w-2 rounded-full bg-up" />
            <span className="num text-xs">{account.displayName}</span>
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 overflow-visible border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[3.75rem] max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0">
          <VektorWordmark />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exact" in item ? item.exact : false }}
              className="rounded-md px-3 py-2 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground data-[status=active]:bg-surface data-[status=active]:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <GlobalSearch className="w-9 justify-center px-0 sm:w-auto sm:px-3" />
          <WalletButton />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="surface" size="icon" className="h-9 w-9 lg:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 border-border bg-surface">
              <div className="mt-8 flex flex-col gap-1">
                {NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground data-[status=active]:bg-surface-raised data-[status=active]:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
