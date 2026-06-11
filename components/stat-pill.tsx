import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "muted" | "locked";

type Props = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  variant?: Variant;
  className?: string;
};

const VARIANT_STYLES: Record<Variant, string> = {
  default: "bg-card text-foreground",
  success: "bg-success/10 text-success",
  muted: "bg-muted text-muted-foreground",
  locked: "bg-locked text-locked-foreground",
};

export function StatPill({
  label,
  value,
  hint,
  variant = "default",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type ScoreBadgeProps = {
  home: number | null | undefined;
  away: number | null | undefined;
  variant?: "default" | "predicted" | "actual" | "exact";
  className?: string;
};

const SCORE_VARIANT_STYLES: Record<
  NonNullable<ScoreBadgeProps["variant"]>,
  string
> = {
  default: "bg-muted text-foreground",
  predicted: "bg-accent text-accent-foreground",
  actual: "bg-secondary text-secondary-foreground",
  exact: "bg-success text-success-foreground",
};

export function ScoreBadge({
  home,
  away,
  variant = "default",
  className,
}: ScoreBadgeProps) {
  const display =
    home == null || away == null ? "— : —" : `${home} : ${away}`;
  return (
    <span
      className={cn(
        "inline-flex min-w-[3.25rem] items-center justify-center rounded-md px-2 py-1 text-sm font-semibold tabular-nums",
        SCORE_VARIANT_STYLES[variant],
        className,
      )}
    >
      {display}
    </span>
  );
}
