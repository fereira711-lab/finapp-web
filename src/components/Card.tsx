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
    <div className="glass-card p-3 md:p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="label-upper">{title}</span>
        {icon && <span className="text-white/45">{icon}</span>}
      </div>
      <p className={`value-large text-lg md:text-2xl ${color}`}>{value}</p>
      {subtitle && <p className="text-xs text-white/30 mt-1">{subtitle}</p>}
    </div>
  );
}
