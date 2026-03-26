"use client";

import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function Input({ label, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-gray-400">{label}</label>
      <input
        {...props}
        className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-base md:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
      />
    </div>
  );
}
