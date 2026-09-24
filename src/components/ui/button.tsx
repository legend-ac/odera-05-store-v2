import * as React from "react";
import { cn } from "@/lib/cn";
import { cva } from "@/lib/cva";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg" | "icon";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-semibold select-none transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vermeil)] focus-visible:ring-offset-1 active:scale-[0.97] uppercase tracking-widest",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--vermeil)] text-white hover:bg-[var(--vermeil-2)] shadow-[var(--shadow-brand)]",
        secondary:
          "border border-[var(--ash-2)] bg-[var(--ink-3)] text-[var(--paper)] hover:border-[var(--vermeil)] hover:text-[var(--paper)]",
        ghost:
          "border border-transparent bg-transparent text-[var(--paper)] hover:bg-[var(--ink-3)]",
        destructive:
          "border border-[var(--vermeil)] bg-[var(--vermeil)] text-white hover:opacity-90",
      },
      size: {
        sm: "min-h-10 px-3 text-sm",
        md: "min-h-11 px-4 text-sm",
        lg: "min-h-12 px-6 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
