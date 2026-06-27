import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  lockedAt: Date;
  title?: string;
  message?: string;
  className?: string;
};

const FMT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function LockedBanner({ lockedAt, title, message, className }: Props) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-locked px-4 py-3 text-sm text-locked-foreground",
        className,
      )}
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium text-foreground">
          {title ?? "Predictions are locked"}
        </p>
        <p className="text-locked-foreground">
          {message ?? `The deadline passed on ${FMT.format(lockedAt)}. You can still view your picks below.`}
        </p>
      </div>
    </div>
  );
}
