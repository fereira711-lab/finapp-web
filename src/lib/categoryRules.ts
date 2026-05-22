import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryRule } from "./types";

/**
 * Aplica as regras de categorizacao automatica do usuario na descricao.
 * Retorna a categoria que casou com a primeira regra (ordenada por priority desc),
 * ou null se nenhuma casou.
 *
 * O pattern e case-insensitive e usa includes (nao regex).
 */
export async function applyCategoryRules(
  supabase: SupabaseClient,
  userId: string,
  description: string,
): Promise<string | null> {
  if (!description) return null;

  const { data } = await supabase
    .from("category_rules")
    .select("*")
    .eq("user_id", userId)
    .order("priority", { ascending: false });

  if (!data || data.length === 0) return null;

  const lowerDesc = description.toLowerCase();
  for (const rule of data as CategoryRule[]) {
    if (lowerDesc.includes(rule.pattern.toLowerCase())) {
      return rule.category;
    }
  }
  return null;
}
