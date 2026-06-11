import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
};

export function SectionCard({
  title,
  description,
  action,
  className,
  contentClassName,
  children,
}: Props) {
  return (
    <Card className={cn(className)}>
      {(title || description || action) && (
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
    </Card>
  );
}
