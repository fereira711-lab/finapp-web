"use client";

import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function Input({ label, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      <label className="label-upper">{label}</label>
      <input
        {...props}
        className="w-full glass-input px-4 py-3 text-base md:text-sm text-white placeholder-white/30 transition-colors"
      />
    </div>
  );
}
