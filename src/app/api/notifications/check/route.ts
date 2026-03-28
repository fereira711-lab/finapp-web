import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Fetch pending/overdue bills within a window of -30 days to +3 days
  const pastDate = new Date(today);
  pastDate.setDate(pastDate.getDate() - 30);
  const futureDate = new Date(today);
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

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const overdue = result.filter((b) => b.due_date < todayStr || b.status === "overdue");
  const dueToday = result.filter((b) => b.due_date === todayStr && b.status !== "overdue");
  const dueTomorrow = result.filter((b) => b.due_date === tomorrowStr && b.status !== "overdue");
  const dueUpcoming = result.filter((b) => b.due_date > tomorrowStr && b.status !== "overdue");

  return NextResponse.json({
    overdue,
    today: dueToday,
    tomorrow: dueTomorrow,
    upcoming: dueUpcoming,
    totalAlerts: overdue.length + dueToday.length + dueTomorrow.length + dueUpcoming.length,
  });
}
