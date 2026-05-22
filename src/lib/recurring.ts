import type { SupabaseClient } from "@supabase/supabase-js";
import { computeBilling } from "./cardBilling";
import { updateWalletBalance } from "./wallet";
import type { RecurringTemplate, CreditCard } from "./types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Materializa templates recorrentes ativos para o mes corrente, se ainda nao foram criados
 * e o dia ja chegou. Retorna a quantidade de transacoes criadas.
 *
 * Chamado ao entrar no dashboard. Idempotente: usa last_materialized_year/month
 * para nao duplicar no mesmo mes.
 */
export async function materializeRecurringTemplates(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  const today = now.getDate();

  const { data: templates } = await supabase
    .from("recurring_templates")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true);

  if (!templates || templates.length === 0) return 0;

  let created = 0;

  for (const tpl of templates as RecurringTemplate[]) {
    // Ja materializado este mes?
    if (
      tpl.last_materialized_year === currentYear &&
      tpl.last_materialized_month === currentMonth
    ) continue;

    // Dia do mes ainda nao chegou?
    if (today < tpl.day_of_month) continue;

    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const day = Math.min(tpl.day_of_month, lastDay);
    const dateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}`;

    if (tpl.type === "expense" && tpl.method === "card" && tpl.card_id) {
      // Compra no cartao: insere card_transaction + bill
      const { data: cardRaw } = await supabase
        .from("credit_cards").select("*").eq("id", tpl.card_id).single();
      const card = cardRaw as CreditCard | null;
      if (!card) continue;

      const period = computeBilling(dateStr, card.closing_day, card.due_day);
      await supabase.from("card_transactions").insert({
        user_id: userId, card_id: card.id,
        description: tpl.description, amount: tpl.amount,
        date: dateStr, bill_date: period.billDate,
        installments: 1, installment_current: 1,
        category: tpl.category,
      });
      await supabase.from("bills").insert({
        user_id: userId,
        description: `${card.name} - ${tpl.description}`,
        amount: tpl.amount,
        due_date: period.dueDate,
        type: "payable",
        status: "pending",
        recurrent: false,
        recurrence_day: null,
        notes: `card:${card.id}`,
      });
    } else {
      // PIX/debito ou receita: insere em transactions + ajusta saldo
      await supabase.from("transactions").insert({
        user_id: userId,
        description: tpl.description,
        amount: tpl.amount,
        category: tpl.category,
        date: dateStr,
        type: tpl.type,
        status: "completed",
      });
      const delta = tpl.type === "income" ? tpl.amount : -tpl.amount;
      await updateWalletBalance(supabase, userId, delta);
    }

    await supabase.from("recurring_templates").update({
      last_materialized_year: currentYear,
      last_materialized_month: currentMonth,
    }).eq("id", tpl.id);

    created++;
  }

  return created;
}
