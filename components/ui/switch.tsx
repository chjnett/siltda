import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({ checked, onCheckedChange, className, disabled, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      data-slot="switch"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      className={cn("ui-switch", className)}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span data-slot="switch-thumb" />
    </button>
  );
}
