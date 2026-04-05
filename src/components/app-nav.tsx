"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, Gamepad2, LayoutGrid, Sparkles, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Workspace", icon: LayoutGrid },
  { href: "/generator", label: "Generate", icon: Sparkles },
  { href: "/sprites", label: "Library", icon: Film },
  { href: "/tester", label: "Test", icon: Gamepad2 },
  { href: "/credits", label: "Credits", icon: Wallet },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-4 z-20 rounded-[1.75rem] border border-border/70 bg-card/90 px-4 py-3 shadow-[0_20px_80px_-40px_rgba(21,59,41,0.35)] backdrop-blur md:px-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Game Assets
          </div>
          <div className="truncate text-lg font-semibold sm:text-xl">Workbench</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-foreground text-background shadow-sm hover:bg-foreground/90"
                    : "bg-background/70 text-foreground hover:bg-secondary",
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
