"use client";

import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { useFieldControl } from "./field";

/** Visual comum dos campos: 16 px no celular (evita o zoom do iOS), 44 px de altura. */
export const fieldClasses = cn(
  "w-full min-w-0 rounded-field border border-line2 bg-surface px-3 text-base text-ink placeholder:text-muted/80",
  "transition-[border-color,box-shadow] duration-150 outline-none",
  "focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)] focus-visible:outline-none",
  "aria-invalid:border-out aria-invalid:focus:shadow-[0_0_0_3px_var(--out-soft)]",
  "disabled:cursor-not-allowed disabled:bg-surface2 disabled:text-muted",
  "lg:text-md",
);

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

export function Input({ className, id, type, "aria-describedby": describedBy, ...props }: InputProps) {
  const a11y = useFieldControl({ id, "aria-describedby": describedBy });
  return <input type={type ?? "text"} className={cn(fieldClasses, "h-11 lg:h-10", className)} {...a11y} {...props} />;
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, id, "aria-describedby": describedBy, ...props }: TextareaProps) {
  const a11y = useFieldControl({ id, "aria-describedby": describedBy });
  return <textarea className={cn(fieldClasses, "min-h-20 resize-y py-2.5", className)} {...a11y} {...props} />;
}
