"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AlertBill {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  type: "payable" | "receivable";
  status: string;
}

interface BillAlerts {
  overdue: AlertBill[];
  today: AlertBill[];
  tomorrow: AlertBill[];
  upcoming: AlertBill[];
  totalAlerts: number;
  loading: boolean;
}

export function useBillAlerts(): BillAlerts {
  const [data, setData] = useState<Omit<BillAlerts, "loading">>({
    overdue: [],
    today: [],
    tomorrow: [],
    upcoming: [],
    totalAlerts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];

      const pastDate = new Date(now);
      pastDate.setDate(pastDate.getDate() - 30);
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + 3);

      const { data: bills } = await supabase
        .from("bills")
        .select("id, description, amount, due_date, type, status")
        .eq("user_id", user.id)
        .in("status", ["pending", "overdue"])
        .gte("due_date", pastDate.toISOString().split("T")[0])
        .lte("due_date", futureDate.toISOString().split("T")[0])
        .order("due_date", { ascending: true });

      const result = bills || [];

      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      const overdue = result.filter((b) => b.due_date < todayStr || b.status === "overdue");
      const dueToday = result.filter((b) => b.due_date === todayStr && b.status !== "overdue");
      const dueTomorrow = result.filter((b) => b.due_date === tomorrowStr && b.status !== "overdue");
      const dueUpcoming = result.filter((b) => b.due_date > tomorrowStr && b.status !== "overdue");

      setData({
        overdue,
        today: dueToday,
        tomorrow: dueTomorrow,
        upcoming: dueUpcoming,
        totalAlerts: overdue.length + dueToday.length + dueTomorrow.length + dueUpcoming.length,
      });
      setLoading(false);
    }
    load();
  }, []);

  return { ...data, loading };
}
