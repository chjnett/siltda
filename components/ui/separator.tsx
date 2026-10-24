import { cn } from "@/lib/utils";

export function Separator({ className }: { className?: string }) {
  return <div data-slot="separator" role="separator" className={cn("ui-separator", className)} />;
}
