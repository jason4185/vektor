import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Wallet, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { VektorWordmark } from "./logo";
import { GlobalSearch } from "./global-search";
import { useWallet } from "@/lib/vektor/wallet";
import { formatGen } from "@/lib/vektor/format";

const NAV = [
  { to: "/", label: "Markets", exact: true },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/activity", label: "Activity" },
  { to: "/create", label: "Create Market" },
  { to: "/how-it-works", label: "How it works" },
] as const;

function WalletButton() {
  const { address, status, balance, connect, disconnect } = useWallet();

  if (status === "connected" && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="surface" size="sm" className="h-9 gap-2 px-3">
            <span className="h-2 w-2 rounded-full bg-up" />
            <span className="num text-xs">{address}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="label-xs">Connected wallet</DropdownMenuLabel>
          <div className="px-2 pb-2">
            <div className="num text-sm text-foreground">{address}</div>
            <div className="num mt-1 text-xs text-muted-foreground">
              {formatGen(balance)} GEN available
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={disconnect} className="gap-2 text-down">
            <LogOut className="h-4 w-4" /> Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      size="sm"
      className="h-9 gap-2 px-4 font-semibold"
      onClick={() => void connect()}
      disabled={status === "connecting"}
    >
      {status === "connecting" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Wallet className="h-4 w-4" />
      )}
      {status === "connecting" ? "Connecting" : "Connect Wallet"}
    </Button>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="shrink-0">
          <VektorWordmark />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exact" in item ? item.exact : false }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground data-[status=active]:bg-surface data-[status=active]:text-foreground"
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
