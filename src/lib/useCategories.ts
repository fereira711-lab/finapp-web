"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Utensils, Car, Home, Heart, GraduationCap, Gamepad2,
  Banknote, TrendingUp, MoreHorizontal, Package,
} from "lucide-react";

export interface Category {
  id: string;
  name: string;
  label: string;
  color: string;
  icon: string;
  isCustom: boolean;
}

const ICON_MAP: Record<string, typeof Package> = {
  "🍽️": Utensils,
  "🚗": Car,
  "🏠": Home,
  "❤️": Heart,
  "🎓": GraduationCap,
  "🎮": Gamepad2,
  "💰": Banknote,
  "📈": TrendingUp,
  "📦": Package,
};

const DEFAULT_LABELS: Record<string, string> = {
  alimentacao: "Alimentação",
  transporte: "Transporte",
  moradia: "Moradia",
  saude: "Saúde",
  educacao: "Educação",
  lazer: "Lazer",
  salario: "Salário",
  investimento: "Investimento",
  outros: "Outros",
};

const DEFAULT_NAMES = Object.keys(DEFAULT_LABELS);

export function getCategoryIcon(icon: string) {
  return ICON_MAP[icon] || Package;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const cats: Category[] = (data || []).map((c) => ({
      id: c.id,
      name: c.name,
      label: DEFAULT_LABELS[c.name] || c.name.charAt(0).toUpperCase() + c.name.slice(1),
      color: c.color,
      icon: c.icon,
      isCustom: !DEFAULT_NAMES.includes(c.name),
    }));

    setCategories(cats);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addCategory(name: string): Promise<Category | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const key = name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");

    const { data, error } = await supabase
      .from("categories")
      .insert({ user_id: user.id, name: key, color: "#6366F1", icon: "📦" })
      .select()
      .single();

    if (error || !data) return null;

    const newCat: Category = {
      id: data.id,
      name: data.name,
      label: name.trim().charAt(0).toUpperCase() + name.trim().slice(1),
      color: data.color,
      icon: data.icon,
      isCustom: true,
    };

    setCategories((prev) => [...prev, newCat]);
    return newCat;
  }

  async function removeCategory(id: string) {
    const supabase = createClient();
    await supabase.from("categories").delete().eq("id", id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  return { categories, loading, addCategory, removeCategory, reload: load };
}
