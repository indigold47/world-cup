import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex flex-col gap-6 py-6 sm:py-10" aria-busy="true">
      <div className="space-y-3 pb-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-24 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </main>
  );
}
