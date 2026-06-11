export type NavItem = {
  href: string;
  label: string;
  // Lucide icon name, resolved client-side in MainNav / MobileTabBar.
  icon: "Home" | "Goal" | "ListOrdered" | "Trophy" | "ClipboardEdit";
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: "Home" },
  { href: "/matches", label: "Matches", icon: "Goal" },
  { href: "/group-tables", label: "Groups", icon: "ListOrdered" },
  { href: "/leaderboard", label: "Leaderboard", icon: "Trophy" },
  { href: "/results", label: "Results", icon: "ClipboardEdit", adminOnly: true },
];

export function navItemsFor(isAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
}
