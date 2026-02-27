import * as React from "react";
import { cn } from "@/lib/cn";
import { cva } from "@/lib/cva";

type FieldSize = "sm" | "md" | "lg";

const fieldBase = cva(
  "w-full rounded-xl border border-border bg-card text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "min-h-10 px-3 text-sm",
        md: "min-h-11 px-3 text-sm",
        lg: "min-h-12 px-4 text-base",
      },
      invalid: {
        true: "border-destructive ring-1 ring-destructive",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
      invalid: "false",
    },
  }
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  uiSize?: FieldSize;
  invalid?: boolean;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  uiSize?: FieldSize;
  invalid?: boolean;
}

export function Input(props: InputProps) {
  const { className, uiSize = "md", invalid = false, ...rest } = props;
  return (
    <input
      className={cn(fieldBase({ size: uiSize, invalid: invalid ? "true" : "false" }), className)}
      {...rest}
    />
  );
}

export function Select(props: SelectProps) {
  const { className, uiSize = "md", invalid = false, ...rest } = props;
  return (
    <select
      className={cn(fieldBase({ size: uiSize, invalid: invalid ? "true" : "false" }), className)}
      {...rest}
    />
  );
}
