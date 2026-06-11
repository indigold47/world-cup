"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Goal, Home, ListOrdered, Trophy, ClipboardEdit } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItemsFor, type NavItem } from "@/lib/nav";

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

export function MainNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = navItemsFor(isAdmin);
  return (
    <nav aria-label="Primary" className="hidden md:flex md:items-center md:gap-1">
      {items.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
      ))}
    </nav>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "text-muted-foreground hover:bg-accent hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-accent text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {item.label}
    </Link>
  );
}
