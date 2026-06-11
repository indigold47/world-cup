"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in the browser console — Vercel/Supabase logs catch this in prod.
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center py-16">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-6 text-center sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Something went sideways</h1>
          <p className="text-sm text-muted-foreground">
            We hit an unexpected error rendering this page. The team can&apos;t
            see what you were doing — only that something broke.
          </p>
          {error.digest && (
            <p className="font-mono text-[11px] text-muted-foreground">
              ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()} size="sm">
            Try again
          </Button>
          <Button
            render={<Link href="/" />}
            variant="ghost"
            size="sm"
          >
            Back to home
          </Button>
        </div>
      </div>
    </main>
  );
}
