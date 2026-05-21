import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Atualiza o saldo da carteira do usuario somando o delta (positivo entra, negativo sai).
 * Se a carteira nao existe, cria com o delta como saldo inicial.
 *
 * Usado para que receitas e despesas PIX/Debito reflitam em tempo real no Saldo Atual.
 * Despesas de cartao NAO devem chamar isso (saldo so muda quando a fatura for paga).
 */
export async function updateWalletBalance(
  supabase: SupabaseClient,
  userId: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return;

  const { data: existing } = await supabase
    .from("accounts")
    .select("id, balance")
    .eq("user_id", userId)
    .ilike("name", "carteira")
    .maybeSingle();

  if (existing) {
    const newBalance = Number(existing.balance) + delta;
    await supabase.from("accounts").update({ balance: newBalance }).eq("id", existing.id);
  } else {
    await supabase.from("accounts").insert({
      user_id: userId,
      name: "Carteira",
      bank_name: "Manual",
      account_type: "checking",
      balance: delta,
    });
  }
}
