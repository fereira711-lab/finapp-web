import {
  Home, ArrowLeftRight, Receipt, CreditCard, Bot, User, BarChart3, Target, Tag, Tags,
  ShoppingCart, ClipboardCheck, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  /** rótulo curto para a barra inferior do celular */
  short: string;
  icon: LucideIcon;
}

/** Itens do menu, na ordem padrão do menu lateral (PC). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Dashboard", icon: Home },
  { href: "/bills", label: "Agenda Financeira", short: "Agenda", icon: Receipt },
  { href: "/credit-cards", label: "Cartões", short: "Cartões", icon: CreditCard },
  { href: "/reports", label: "Relatórios", short: "Relatórios", icon: BarChart3 },
  { href: "/transactions", label: "Transações", short: "Transações", icon: ArrowLeftRight },
  { href: "/category-rules", label: "Regras de Categoria", short: "Regras", icon: Tag },
  { href: "/categories", label: "Categorias", short: "Categorias", icon: Tags },
  { href: "/shopping", label: "Compras", short: "Compras", icon: ShoppingCart },
  { href: "/chores", label: "Casa", short: "Casa", icon: ClipboardCheck },
  { href: "/goals", label: "Metas", short: "Metas", icon: Target },
  { href: "/ai", label: "IA Financeira", short: "IA", icon: Bot },
  { href: "/profile", label: "Perfil", short: "Perfil", icon: User },
];

/** Ordem padrão do celular (sem ordem personalizada): as 4 primeiras ficam na barra. */
export const MOBILE_DEFAULT_ORDER = [
  "/", "/bills", "/credit-cards", "/transactions", "/shopping", "/chores",
  "/goals", "/category-rules", "/categories", "/reports", "/ai", "/profile",
];

/** Quantos itens cabem na barra inferior (o resto vai para "Mais"). */
export const MOBILE_BAR_SIZE = 4;
