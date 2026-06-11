import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex flex-col gap-6 py-6 sm:py-10" aria-busy="true">
      <div className="space-y-3 pb-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </main>
  );
}
