import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center py-16">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-6 text-center sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Compass className="h-6 w-6" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The URL you tried doesn&apos;t match anything in the pool. Maybe it
            was a typo, maybe a stale bookmark.
          </p>
        </div>
        <Button render={<Link href="/" />} size="sm">
          Back to home
        </Button>
      </div>
    </main>
  );
}
