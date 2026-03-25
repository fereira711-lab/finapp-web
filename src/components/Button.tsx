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
  const base = "px-6 py-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-50";
  const variants = {
    primary: "bg-primary hover:bg-primary-dark text-white",
    secondary: "bg-dark-700 hover:bg-dark-600 text-white",
    ghost: "text-gray-400 hover:text-white",
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
