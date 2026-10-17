"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addDays, daysBetween, todayStr } from "@/lib/shopping";

/** Avisa quando faltam ate este numero de dias (ou ja acabou). */
export const STOCK_ALERT_DAYS = 3;

export interface StockAlertItem {
  id: string;
  name: string;
  /** dias ate acabar (negativo = ja acabou) */
  daysLeft: number;
}

export function daysLeftLabel(daysLeft: number) {
  if (daysLeft < 0) return `acabou há ${-daysLeft} ${daysLeft === -1 ? "dia" : "dias"}`;
  if (daysLeft === 0) return "acaba hoje";
  return `acaba em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`;
}

/**
 * Itens fixos com duracao e data da ultima compra que estao acabando.
 * Recarrega ao trocar de pagina e quando o app avisa que os dados mudaram.
 */
export function useStockAlerts() {
  const pathname = usePathname();
  const [items, setItems] = useState<StockAlertItem[]>([]);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setItems([]); return; }
      const { data } = await supabase
        .from("shopping_items")
        .select("id, name, duration_days, last_bought_at")
        .eq("user_id", user.id)
        .not("duration_days", "is", null)
        .not("last_bought_at", "is", null);

      const today = todayStr();
      const alerts = (data || [])
        .map((it) => ({
          id: it.id as string,
          name: it.name as string,
          daysLeft: daysBetween(today, addDays(it.last_bought_at as string, it.duration_days as number)),
        }))
        .filter((it) => it.daysLeft <= STOCK_ALERT_DAYS)
        .sort((a, b) => a.daysLeft - b.daysLeft);
      setItems(alerts);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load, pathname]);

  useEffect(() => {
    window.addEventListener("finapp:data-changed", load);
    window.addEventListener("finapp:stock-changed", load);
    return () => {
      window.removeEventListener("finapp:data-changed", load);
      window.removeEventListener("finapp:stock-changed", load);
    };
  }, [load]);

  return { items, count: items.length };
}
