import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Atualiza o saldo da carteira do usuario somando o delta (positivo entra, negativo sai).
 * Operacao atomica via RPC Postgres (balance = balance + delta).
 * Cria a carteira se nao existir.
 *
 * O parametro userId e mantido por compatibilidade com chamadas existentes,
 * mas a funcao no banco usa auth.uid() como fonte de verdade.
 *
 * Despesas de cartao NAO devem chamar isso (saldo so muda quando a fatura for paga).
 */
export async function updateWalletBalance(
  supabase: SupabaseClient,
  _userId: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return;
  const { error } = await supabase.rpc("increment_wallet_balance", { p_delta: delta });
  if (error) {
    console.error("updateWalletBalance error:", error.message);
    throw error;
  }
}
