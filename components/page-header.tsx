import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, eyebrow, action, className }: Props) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 pb-6 pt-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="space-y-2">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-2xl text-balance text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
