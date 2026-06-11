import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex flex-col gap-6 py-6 sm:py-10" aria-busy="true">
      <div className="space-y-3 pb-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-5 w-48" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full" />
        ))}
      </div>
    </main>
  );
}
