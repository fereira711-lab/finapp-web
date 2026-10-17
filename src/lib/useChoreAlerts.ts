"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { overdueFixed, type ChoreLog, type ChoreTask } from "@/lib/chores";
import { addDays, todayStr } from "@/lib/shopping";

/** Dias para tras em que uma tarefa fixa nao feita ainda conta como atrasada. */
const WINDOW_DAYS = 14;

/**
 * Quantidade de tarefas fixas atrasadas (nao marcadas como feitas) nos ultimos dias.
 * Recarrega ao trocar de pagina e quando a tela Casa avisa que algo mudou.
 */
export function useChoreAlerts() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCount(0); return; }
      const today = todayStr();
      const [taskRes, logRes] = await Promise.all([
        supabase.from("chore_tasks").select("*").eq("user_id", user.id).eq("mode", "fixed"),
        supabase.from("chore_logs").select("*").eq("user_id", user.id)
          .gte("log_date", addDays(today, -WINDOW_DAYS)).lt("log_date", today),
      ]);
      if (taskRes.error || logRes.error) { setCount(0); return; }
      setCount(overdueFixed((taskRes.data || []) as ChoreTask[], (logRes.data || []) as ChoreLog[], today, WINDOW_DAYS).length);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => { load(); }, [load, pathname]);

  useEffect(() => {
    window.addEventListener("finapp:chores-changed", load);
    return () => window.removeEventListener("finapp:chores-changed", load);
  }, [load]);

  return { count };
}
