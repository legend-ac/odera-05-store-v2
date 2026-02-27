import * as React from "react";
import { cn } from "@/lib/cn";
import { cva } from "@/lib/cva";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg" | "icon";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        primary: "border border-primary bg-primary text-primary-foreground hover:opacity-95",
        secondary: "border border-border bg-card text-foreground hover:bg-background",
        ghost: "border border-transparent bg-transparent text-foreground hover:bg-background",
        destructive: "border border-destructive bg-destructive text-destructive-foreground hover:opacity-95",
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
