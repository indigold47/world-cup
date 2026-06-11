import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SignInButton } from "./sign-in-button";
import { SignInError } from "./sign-in-error";

export const metadata = {
  title: "Sign in · Office World Cup Pool",
};

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center py-16">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-8 p-8 sm:p-10">
          <div className="space-y-3 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Office World Cup 2026
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Sign in to play
            </h1>
            <p className="text-balance text-sm text-muted-foreground">
              The pool is open to voice123ers with a{" "}
              <span className="font-medium text-foreground">@voice123.com</span>{" "}
              Google account.
            </p>
          </div>

          <Suspense fallback={<Skeleton className="h-12 w-full" />}>
            <SignInButton />
          </Suspense>

          <Suspense fallback={null}>
            <SignInError />
          </Suspense>

          <p className="text-center text-xs text-muted-foreground">
            We only store your name and predictions. No spreadsheets, no
            passwords.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
