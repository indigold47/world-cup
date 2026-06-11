"use client";

import { useState, useTransition } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EditDisplayNameDialog } from "./edit-display-name-dialog";
import { signOutAction } from "@/app/account/actions";

type Props = {
  displayName: string;
  email: string;
  isAdmin: boolean;
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu({ displayName, email, isAdmin }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const { theme, setTheme } = useTheme();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="h-10 gap-2 px-2"
              aria-label="Account menu"
            />
          }
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs font-medium">
              {initialsOf(displayName) || "?"}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">
            {displayName}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{displayName}</span>
              <span className="text-xs text-muted-foreground">{email}</span>
              {isAdmin && (
                <span className="mt-1 text-xs font-medium text-primary">
                  Admin
                </span>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            Edit display name
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Theme
          </DropdownMenuLabel>
          <ThemeItem
            label="Light"
            icon={<Sun className="h-3.5 w-3.5" />}
            active={theme === "light"}
            onSelect={() => setTheme("light")}
          />
          <ThemeItem
            label="Dark"
            icon={<Moon className="h-3.5 w-3.5" />}
            active={theme === "dark"}
            onSelect={() => setTheme("dark")}
          />
          <ThemeItem
            label="System"
            icon={<Monitor className="h-3.5 w-3.5" />}
            active={theme === "system" || theme === undefined}
            onSelect={() => setTheme("system")}
          />

          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={signingOut}
            onClick={() => startSignOut(() => signOutAction())}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditDisplayNameDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        currentName={displayName}
      />
    </>
  );
}

function ThemeItem({
  label,
  icon,
  active,
  onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onClick={onSelect}>
      <span
        className={cn(
          "flex w-full items-center gap-2",
          active && "font-medium text-primary",
        )}
      >
        <span aria-hidden>{icon}</span>
        <span className="flex-1">{label}</span>
        {active && <Check className="h-3.5 w-3.5" />}
      </span>
    </DropdownMenuItem>
  );
}
