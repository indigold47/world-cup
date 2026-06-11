import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function CardLoadingState({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)} aria-busy="true">
      <Skeleton className="h-7 w-2/5" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
