export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: string): string {
  // YYYY-MM-DD sem timezone e tratado como UTC pelo JS; adiciona T12:00:00 para
  // ancorar no meio do dia local e evitar shift para o dia anterior.
  const safe = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date;
  return new Intl.DateTimeFormat("pt-BR").format(new Date(safe));
}
