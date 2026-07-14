import type { Bill } from "./types";

type AccountLike = {
  id?: string | null;
  name?: string | null;
  balance: number;
};

type BillLike = Pick<Bill, "amount" | "due_date" | "status" | "type">;

export interface AgendaWeekRange {
  index: number;
  start: Date;
  end: Date;
}

export interface OfficialBillTotals {
  totalPayable: number;
  totalReceivable: number;
  saldoPrevisto: number;
}

export function parseLocalDate(date: string): Date {
  const safe = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date;
  const parsed = new Date(safe);
  parsed.setHours(12, 0, 0, 0);
  return parsed;
}

export function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function isDateWithinRange(date: Date, start: Date, end: Date): boolean {
  const time = startOfLocalDay(date).getTime();
  return time >= startOfLocalDay(start).getTime() && time <= startOfLocalDay(end).getTime();
}

export function getMonthAgendaWeeks(year: number, month: number): AgendaWeekRange[] {
  const firstDay = new Date(year, month, 1, 12, 0, 0, 0);
  const lastDay = new Date(year, month + 1, 0, 12, 0, 0, 0);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  const end = new Date(lastDay);
  end.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

  const weeks: AgendaWeekRange[] = [];
  let cursor = startOfLocalDay(start);
  let index = 1;

  while (cursor.getTime() <= startOfLocalDay(end).getTime()) {
    const weekStart = startOfLocalDay(cursor);
    const weekEnd = startOfLocalDay(addLocalDays(weekStart, 6));
    weeks.push({ index, start: weekStart, end: weekEnd });
    cursor = startOfLocalDay(addLocalDays(weekStart, 7));
    index += 1;
  }

  return weeks;
}

export function getLiquidBalance(accounts: AccountLike[]): number {
  const wallet = accounts.find((account) => account.name?.toLowerCase() === "carteira");
  if (wallet) return wallet.balance;
  return accounts.reduce((sum, account) => sum + account.balance, 0);
}

export function getOfficialBillTotals(bills: BillLike[], currentBalance = 0): OfficialBillTotals {
  const totalPayable = bills
    .filter((bill) => bill.type === "payable" && bill.status !== "paid")
    .reduce((sum, bill) => sum + bill.amount, 0);

  const totalReceivable = bills
    .filter((bill) => bill.type === "receivable" && bill.status !== "paid")
    .reduce((sum, bill) => sum + bill.amount, 0);

  return {
    totalPayable,
    totalReceivable,
    saldoPrevisto: currentBalance + totalReceivable - totalPayable,
  };
}
