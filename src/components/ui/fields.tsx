import * as React from "react";
import { cn } from "@/lib/cn";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      className={cn(
        "w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] leading-tight text-slate-900 placeholder:text-slate-400 focus:border-blue-500 sm:min-h-10 sm:text-sm",
        className
      )}
      {...rest}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return (
    <select
      className={cn("w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] leading-tight text-slate-900 focus:border-blue-500 sm:min-h-10 sm:text-sm", className)}
      {...rest}
    />
  );
}
