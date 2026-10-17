export interface ShoppingItem {
  id: string;
  user_id: string;
  name: string;
  category: string;
  qty: string;
  estimated_price: number;
  position: number | null;
  duration_days: number | null;
  last_bought_at: string | null;
}

export interface ShoppingList {
  id: string;
  user_id: string;
  week_start: string;
  budget: number;
  status: "open" | "done";
  total: number | null;
  transaction_id: string | null;
  finished_at: string | null;
}

export interface ShoppingListItem {
  id: string;
  list_id: string;
  user_id: string;
  item_id: string | null;
  name: string;
  category: string;
  qty: string;
  estimated_price: number;
  price: number | null;
  checked: boolean;
  position: number | null;
  hint: string | null;
}

export interface NewListItem {
  name: string;
  qty: string;
  category: string;
  estimated_price: number;
  duration_days: number | null;
  saveAsFixed: boolean;
}

export const SHOP_CATEGORIES: Record<string, { label: string; color: string }> = {
  hortifruti: { label: "Hortifruti", color: "#4ade80" },
  carnes: { label: "Carnes", color: "#f87171" },
  mercearia: { label: "Mercearia", color: "#facc15" },
  limpeza: { label: "Limpeza", color: "#38bdf8" },
  higiene: { label: "Higiene", color: "#c084fc" },
  bebidas: { label: "Bebidas", color: "#fb923c" },
  outros: { label: "Outros", color: "#94a3b8" },
};

export const DEFAULT_BUDGET = 400;

export function shopCat(key: string) {
  return SHOP_CATEGORIES[key] || SHOP_CATEGORIES.outros;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayStr() {
  return ymd(new Date());
}

/** Segunda-feira (YYYY-MM-DD, horario local) da semana da data informada */
export function mondayOf(date: Date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() + 6) % 7; // seg=0 ... dom=6
  d.setDate(d.getDate() - diff);
  return ymd(d);
}

export function addDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return ymd(new Date(y, m - 1, d + days));
}

/** "19/10" */
export function shortDate(dateStr: string) {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

export function parsePrice(text: string): number {
  const n = parseFloat(text.replace(/\./g, "").replace(",", "."));
  return isNaN(n) || n < 0 ? 0 : Math.round(n * 100) / 100;
}

export function priceToText(v: number | null) {
  return v == null ? "" : v.toFixed(2).replace(".", ",");
}

export function progressColors(pct: number) {
  if (pct > 100) return { bar: "bg-red-500", text: "text-red-400" };
  if (pct >= 70) return { bar: "bg-yellow-500", text: "text-yellow-400" };
  return { bar: "bg-green-500", text: "text-green-400" };
}

export function daysBetween(fromStr: string, toStr: string) {
  const [fy, fm, fd] = fromStr.split("-").map(Number);
  const [ty, tm, td] = toStr.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

export interface StockStatus {
  /** precisa entrar na lista desta semana */
  due: boolean;
  /** dica curta (ex.: "Acaba em 3 dias") */
  hint: string | null;
  /** data em que o item acaba (YYYY-MM-DD) */
  runsOut: string | null;
  /** dias ate acabar (negativo = ja acabou) */
  daysLeft: number | null;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Item sem duracao: entra toda semana.
 * Item com duracao: entra na semana se o estoque acaba antes da proxima data de compra
 * (segunda seguinte a semana da lista).
 */
export function stockStatus(
  item: Pick<ShoppingItem, "duration_days" | "last_bought_at">,
  weekStart: string,
  today: string = todayStr(),
): StockStatus {
  if (!item.duration_days) return { due: true, hint: null, runsOut: null, daysLeft: null };
  if (!item.last_bought_at) {
    return { due: true, hint: "Sem registro de compra", runsOut: null, daysLeft: null };
  }
  const runsOut = addDays(item.last_bought_at, item.duration_days);
  const daysLeft = daysBetween(today, runsOut);
  const nextBuy = addDays(weekStart, 7);
  const due = runsOut < nextBuy;
  let hint: string;
  if (daysLeft < 0) hint = `Acabou há ${plural(-daysLeft, "dia", "dias")}`;
  else if (daysLeft === 0) hint = "Acaba hoje";
  else hint = `Acaba em ${plural(daysLeft, "dia", "dias")}`;
  return { due, hint, runsOut, daysLeft };
}

export function parseDays(text: string): number | null {
  const n = parseInt(text, 10);
  return isNaN(n) || n < 1 || n > 365 ? null : n;
}
