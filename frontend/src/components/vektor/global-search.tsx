import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { marketsQuery } from "@/lib/vektor/queries";
import { bpsToPct, formatDate } from "@/lib/vektor/format";
import { cn } from "@/lib/utils";

export function GlobalSearch({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useQuery(marketsQuery({ sort: "volume" }));
  const markets = data?.items ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground",
          className,
        )}
      >
        <Search className="h-4 w-4" />
        <span className="hidden lg:inline">Search markets</span>
        <kbd className="num ml-2 hidden rounded border border-border bg-surface-raised px-1.5 py-0.5 text-[0.625rem] lg:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search by instrument or question…" />
        <CommandList>
          <CommandEmpty>No markets match that query.</CommandEmpty>
          <CommandGroup heading="Markets">
            {markets.map((m) => (
              <CommandItem
                key={m.id}
                value={`${m.instrument} ${m.question}`}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: "/market/$id", params: { id: m.id } });
                }}
                className="gap-3"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">{m.instrument}</span>
                  <span className="text-muted-foreground"> · {formatDate(m.targetDate)}</span>
                </span>
                <span className="num shrink-0 text-xs text-up">
                  {m.upBps === 0 && m.downBps === 0 ? "—" : bpsToPct(m.upBps)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

export { Link };
