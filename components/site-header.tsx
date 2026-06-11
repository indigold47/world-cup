import Link from "next/link";
import { MainNav } from "./main-nav";
import { UserMenu } from "./user-menu";

type Props = {
  displayName: string;
  email: string;
  isAdmin: boolean;
};

export function SiteHeader({ displayName, email, isAdmin }: Props) {
  return (
    <header
      className="sticky top-0 z-30 -mx-4 flex items-center gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <Link
        href="/"
        className="flex items-center gap-2 text-sm font-semibold tracking-tight"
      >
        <span aria-hidden className="text-base">
          ⚽
        </span>
        <span className="hidden sm:inline">Voice123 World Cup</span>
        <span className="sm:hidden">V123</span>
      </Link>
      <div className="mx-2 hidden h-6 w-px bg-border md:block" />
      <MainNav isAdmin={isAdmin} />
      <div className="ml-auto">
        <UserMenu displayName={displayName} email={email} isAdmin={isAdmin} />
      </div>
    </header>
  );
}
