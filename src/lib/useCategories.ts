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

export function categoryKey(label: string) {
  return label.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
}

export function humanizeCategory(key: string) {
  const t = key.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Tabelas que guardam a categoria como texto (chave = categories.name)
const CATEGORY_TABLES = ["transactions", "card_transactions", "recurring_templates", "category_rules", "goals"] as const;

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
      label: DEFAULT_LABELS[c.name] || humanizeCategory(c.name),
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

    const key = categoryKey(name);

    const { data, error } = await supabase
      .from("categories")
      .insert({ user_id: user.id, name: key, color: "#6366F1", icon: "📦" })
      .select()
      .single();

    if (error || !data) return null;

    const newCat: Category = {
      id: data.id,
      name: data.name,
      label: humanizeCategory(key),
      color: data.color,
      icon: data.icon,
      isCustom: true,
    };

    setCategories((prev) => [...prev, newCat]);
    return newCat;
  }

  // Renomeia a categoria e propaga a nova chave para tudo que a usa
  async function renameCategory(id: string, newLabel: string): Promise<{ ok: boolean; error?: string }> {
    const cat = categories.find((c) => c.id === id);
    if (!cat || !cat.isCustom) return { ok: false, error: "Categoria não pode ser editada" };
    const newKey = categoryKey(newLabel);
    if (!newKey) return { ok: false, error: "Informe um nome" };
    if (newKey === cat.name) return { ok: true };
    if (categories.some((c) => c.name === newKey)) return { ok: false, error: "Já existe uma categoria com esse nome" };

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sessão expirada" };

    const { error } = await supabase.from("categories").update({ name: newKey }).eq("id", id);
    if (error) return { ok: false, error: "Não foi possível renomear" };

    const results = await Promise.all(
      CATEGORY_TABLES.map((t) =>
        supabase.from(t).update({ category: newKey }).eq("user_id", user.id).eq("category", cat.name)
      )
    );
    await load();
    if (results.some((r) => r.error)) return { ok: false, error: "Renomeada, mas algum registro não foi atualizado" };
    return { ok: true };
  }

  // Apaga a categoria: lançamentos vão para "outros"; metas e regras dela são removidas
  async function removeCategory(id: string): Promise<{ ok: boolean; error?: string }> {
    const cat = categories.find((c) => c.id === id);
    if (!cat || !cat.isCustom) return { ok: false, error: "Categoria não pode ser apagada" };

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sessão expirada" };

    const moved = await Promise.all(
      (["transactions", "card_transactions", "recurring_templates"] as const).map((t) =>
        supabase.from(t).update({ category: "outros" }).eq("user_id", user.id).eq("category", cat.name)
      )
    );
    if (moved.some((r) => r.error)) return { ok: false, error: "Não foi possível mover os lançamentos" };

    await Promise.all(
      (["goals", "category_rules"] as const).map((t) =>
        supabase.from(t).delete().eq("user_id", user.id).eq("category", cat.name)
      )
    );
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return { ok: false, error: "Não foi possível apagar" };

    setCategories((prev) => prev.filter((c) => c.id !== id));
    return { ok: true };
  }

  return { categories, loading, addCategory, renameCategory, removeCategory, reload: load };
}
