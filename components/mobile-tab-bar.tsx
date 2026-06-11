"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Goal, Home, ListOrdered, Trophy, ClipboardEdit } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItemsFor } from "@/lib/nav";

const ICONS = {
  Home,
  Goal,
  ListOrdered,
  Trophy,
  ClipboardEdit,
} as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileTabBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = navItemsFor(isAdmin);
  return (
    <nav
      aria-label="Primary mobile"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="mx-auto grid max-w-5xl"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = ICONS[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-2 py-2",
                  "text-[11px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
