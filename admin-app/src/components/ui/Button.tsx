import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";

type Variant = "primary" | "secondary" | "outline";
type Size = "sm" | "md";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-primary-600 text-white hover:bg-primary-700",
  secondary: "border border-neutral-400 bg-white text-neutral-700 hover:bg-neutral-100",
  outline: "border border-neutral-300 text-neutral-600 hover:bg-neutral-50",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

const BASE_CLASS = "rounded-md font-medium disabled:cursor-not-allowed disabled:opacity-50";

function buttonClassName(variant: Variant, size: Size, className?: string): string {
  return [BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], className]
    .filter(Boolean)
    .join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingLabel?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={buttonClassName(variant, size, className)}
      {...rest}
    >
      {loading ? (loadingLabel ?? children) : children}
    </button>
  );
}

export interface LinkButtonProps extends LinkProps {
  variant?: Variant;
  size?: Size;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: LinkButtonProps) {
  return <Link className={buttonClassName(variant, size, className)} {...rest} />;
}
