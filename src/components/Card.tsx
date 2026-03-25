"use client";

interface CardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
}

export default function Card({ title, value, subtitle, icon, color = "text-white" }: CardProps) {
  return (
    <div className="bg-dark-800 rounded-2xl p-5 border border-dark-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{title}</span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
