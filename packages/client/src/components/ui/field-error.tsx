import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FieldError({
  id,
  message,
  className,
}: {
  id: string;
  message?: ReactNode | undefined;
  className?: string | undefined;
}) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className={cn("text-xs text-destructive", className)}>
      {message}
    </p>
  );
}
