import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center rounded px-3 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
const variants: Record<Variant, string> = {
  primary: "bg-zinc-50 text-zinc-950 hover:bg-zinc-200",
  secondary: "bg-zinc-800 text-zinc-50 hover:bg-zinc-700",
  ghost: "bg-transparent text-zinc-200 hover:bg-zinc-900",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
