import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "default" | "sale" | "success" | "info";

const toneStyles: Record<Tone, string> = {
  default: "bg-slate-100 text-slate-700 border-slate-200",
  sale: "bg-rose-50 text-rose-700 border-rose-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};

export function Badge({
  tone = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", toneStyles[tone], className)}
      {...props}
    />
  );
}
