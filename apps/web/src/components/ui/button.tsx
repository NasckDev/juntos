import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  [
    "hit inline-flex shrink-0 items-center justify-center gap-2 rounded-field font-semibold whitespace-nowrap select-none",
    "transition-[background-color,box-shadow,filter,transform] duration-150 active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.125em] [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-ink hover:brightness-[1.07]",
        line: "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line2)] hover:bg-surface2",
        ghost: "bg-surface3 text-ink hover:bg-line",
        quiet: "bg-transparent text-ink hover:bg-surface3",
        danger: "bg-out-soft text-out hover:brightness-95",
        link: "bg-transparent text-brand-text underline-offset-4 hover:underline",
      },
      size: {
        md: "h-11 px-4 text-md lg:h-10",
        sm: "h-9 px-3 text-sm lg:h-8",
        lg: "h-12 px-5 text-base",
      },
      block: { true: "w-full", false: "" },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0 lg:h-auto" }],
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Renderiza o filho (ex.: `<Link>`) com o visual do botão. */
  asChild?: boolean;
  /** Ícone antes do texto. */
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  icon,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, block }), className);
  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button type={type ?? "button"} className={classes} {...props}>
      {icon}
      {children}
    </button>
  );
}
