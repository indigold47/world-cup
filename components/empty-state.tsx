import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, icon, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-background text-muted-foreground">
          {icon}
        </div>
      )}
      <h2 className="text-base font-semibold">{title}</h2>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
