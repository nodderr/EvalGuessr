import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

/** One shape for every button: 12px radius, 48px+ tall for touch. */
export function Button({ variant = "primary", className = "", ...rest }: Props) {
  const look =
    variant === "primary"
      ? "bg-accent text-accent-ink hover:brightness-110"
      : "border border-line bg-surface-raised text-ink hover:border-ink-muted";
  return (
    <button
      type="button"
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold whitespace-nowrap transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${look} ${className}`}
      {...rest}
    />
  );
}
