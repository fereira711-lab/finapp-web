"use client";

interface CardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
  onClick?: () => void;
}

export default function Card({ title, value, subtitle, icon, color = "text-white", onClick }: CardProps) {
  return (
    <div
      className={`glass-card p-3 md:p-4 ${onClick ? "cursor-pointer hover:bg-white/5 transition-colors" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="label-upper">{title}</span>
        {icon && <span className="text-white/45">{icon}</span>}
      </div>
      <p className={`value-large text-lg md:text-2xl ${color}`}>{value}</p>
      {subtitle && <p className="text-xs text-white/30 mt-1">{subtitle}</p>}
    </div>
  );
}
