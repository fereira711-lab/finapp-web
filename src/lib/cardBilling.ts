// Calculo do ciclo de fatura do cartao de credito.
//
// Regras:
// - Compra ate o dia do fechamento (inclusive) → entra na fatura deste mes
// - Compra depois do fechamento → entra na fatura do mes seguinte
// - Vencimento no mes do fechamento se due_day > closing_day,
//   caso contrario no mes seguinte ao fechamento.

export interface BillingPeriod {
  /** Primeiro dia do mes de fechamento da fatura. Usado como bill_date no DB. */
  billDate: string;
  /** Data de vencimento da fatura (YYYY-MM-DD). */
  dueDate: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Dado uma data de compra (YYYY-MM-DD) e os dias de fechamento/vencimento do cartao,
 * retorna o periodo de fatura em que essa compra entra.
 */
export function computeBilling(
  purchaseDate: string,
  closingDay: number,
  dueDay: number,
): BillingPeriod {
  const d = new Date(purchaseDate + "T12:00:00");
  let year = d.getFullYear();
  let month = d.getMonth();
  const day = d.getDate();

  // Compra depois do fechamento → fatura fecha mes seguinte
  if (day > closingDay) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }

  // billDate = primeiro dia do mes de fechamento
  const billDate = `${year}-${pad(month + 1)}-01`;

  // Vencimento: mesmo mes do fechamento se due_day > closing_day, senao mes seguinte
  let dueYear = year;
  let dueMonth = month;
  if (dueDay <= closingDay) {
    dueMonth += 1;
    if (dueMonth > 11) { dueMonth = 0; dueYear += 1; }
  }
  const dueDayClamped = Math.min(dueDay, lastDayOfMonth(dueYear, dueMonth));
  const dueDate = `${dueYear}-${pad(dueMonth + 1)}-${pad(dueDayClamped)}`;

  return { billDate, dueDate };
}

/**
 * Avanca uma BillingPeriod em N meses (usado para parcelas).
 * Cada parcela cai numa fatura subsequente.
 */
export function addMonths(period: BillingPeriod, monthsToAdd: number, dueDay: number): BillingPeriod {
  const [bY, bM] = period.billDate.split("-").map(Number);
  let newBillMonth = bM - 1 + monthsToAdd;
  let newBillYear = bY;
  while (newBillMonth > 11) { newBillMonth -= 12; newBillYear += 1; }

  const [dY, dM] = period.dueDate.split("-").map(Number);
  let newDueMonth = dM - 1 + monthsToAdd;
  let newDueYear = dY;
  while (newDueMonth > 11) { newDueMonth -= 12; newDueYear += 1; }

  const newDueDayClamped = Math.min(dueDay, lastDayOfMonth(newDueYear, newDueMonth));

  return {
    billDate: `${newBillYear}-${pad(newBillMonth + 1)}-01`,
    dueDate: `${newDueYear}-${pad(newDueMonth + 1)}-${pad(newDueDayClamped)}`,
  };
}
