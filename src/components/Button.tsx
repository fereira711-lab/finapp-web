"use client";

import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  loading,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const base = "px-6 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50";
  const variants = {
    primary: "bg-[#6366F1] hover:bg-[#4F46E5] text-white",
    secondary: "glass-btn text-white",
    ghost: "text-white/45 hover:text-white",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Carregando..." : children}
    </button>
  );
}
