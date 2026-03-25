import {
  Utensils,
  Car,
  Home,
  Heart,
  GraduationCap,
  Gamepad2,
  Banknote,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";

export const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof Utensils }
> = {
  alimentacao: { label: "Alimentação", color: "#F59E0B", icon: Utensils },
  transporte: { label: "Transporte", color: "#3B82F6", icon: Car },
  moradia: { label: "Moradia", color: "#8B5CF6", icon: Home },
  saude: { label: "Saúde", color: "#EF4444", icon: Heart },
  educacao: { label: "Educação", color: "#06B6D4", icon: GraduationCap },
  lazer: { label: "Lazer", color: "#EC4899", icon: Gamepad2 },
  salario: { label: "Salário", color: "#10B981", icon: Banknote },
  investimento: { label: "Investimento", color: "#6366F1", icon: TrendingUp },
  outros: { label: "Outros", color: "#94A3B8", icon: MoreHorizontal },
};

export function getCategoryConfig(key: string) {
  return CATEGORY_CONFIG[key] || CATEGORY_CONFIG.outros;
}
