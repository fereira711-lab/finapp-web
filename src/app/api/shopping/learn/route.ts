import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { NvidiaNotConfiguredError, extractJson, nvidiaChat } from "@/lib/ai/nvidia";
import { daysBetween } from "@/lib/shopping";

interface Suggestion {
  item_id: string;
  name: string;
  current: number | null;
  suggested: number;
  reason: string;
}

export async function POST() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const [itemsRes, listsRes] = await Promise.all([
      supabase.from("shopping_items").select("id, name, qty, duration_days").eq("user_id", user.id),
      supabase.from("shopping_lists").select("id, finished_at").eq("user_id", user.id).eq("status", "done"),
    ]);
    const items = itemsRes.data || [];
    const lists = listsRes.data || [];
    if (items.length === 0 || lists.length === 0) {
      return NextResponse.json({ suggestions: [], note: "Ainda não há compras finalizadas para analisar." });
    }

    const finishedById = new Map(
      lists.filter((l) => l.finished_at).map((l) => [l.id, (l.finished_at as string).slice(0, 10)]),
    );
    const { data: bought } = await supabase.from("shopping_list_items").select("item_id, list_id")
      .eq("user_id", user.id).eq("checked", true).not("item_id", "is", null)
      .in("list_id", Array.from(finishedById.keys()));

    // datas de compra por item
    const datesByItem = new Map<string, Set<string>>();
    (bought || []).forEach((b) => {
      const d = finishedById.get(b.list_id);
      if (!d || !b.item_id) return;
      if (!datesByItem.has(b.item_id)) datesByItem.set(b.item_id, new Set());
      datesByItem.get(b.item_id)!.add(d);
    });

    const stats = items.flatMap((it) => {
      const dates = Array.from(datesByItem.get(it.id) || []).sort();
      if (dates.length < 2) return [];
      const intervals = dates.slice(1).map((d, i) => daysBetween(dates[i], d)).filter((n) => n > 0);
      if (intervals.length === 0) return [];
      return [{ item_id: it.id as string, name: it.name as string, qty: it.qty as string,
        current: (it.duration_days as number | null) ?? null, intervals_days: intervals.slice(-6) }];
    });

    if (stats.length === 0) {
      return NextResponse.json({ suggestions: [], note: "Preciso de pelo menos 2 compras do mesmo item para aprender." });
    }

    const text = await nvidiaChat(
      [
        {
          role: "system",
          content:
            "Você ajusta a duração estimada de itens de supermercado com base no intervalo real entre recompras. " +
            "Para cada item, intervals_days são os dias entre compras consecutivas (o usuário recompra quando acaba). " +
            "Ignore valores atípicos (viagens, promoções). Só sugira mudança quando fizer diferença (mais de ~10% da duração atual ou se não houver duração atual). " +
            "Responda APENAS com JSON: {\"suggestions\":[{\"item_id\":\"...\",\"days\":<inteiro 1-365>,\"reason\":\"frase curta em português\"}]}. " +
            "Use somente os item_id recebidos.",
        },
        { role: "user", content: JSON.stringify(stats) },
      ],
      { maxTokens: 1200, temperature: 0.1 },
    );

    const parsed = extractJson<{ suggestions?: { item_id?: unknown; days?: unknown; reason?: unknown }[] }>(text);
    const byId = new Map(stats.map((s) => [s.item_id, s]));
    const suggestions: Suggestion[] = [];
    (parsed?.suggestions || []).forEach((s) => {
      const base = typeof s.item_id === "string" ? byId.get(s.item_id) : undefined;
      const days = Math.round(Number(s.days));
      if (!base || isNaN(days) || days < 1 || days > 365 || days === base.current) return;
      suggestions.push({
        item_id: base.item_id, name: base.name, current: base.current, suggested: days,
        reason: typeof s.reason === "string" ? s.reason.slice(0, 200) : "",
      });
    });

    return NextResponse.json({ suggestions, note: suggestions.length === 0 ? "Suas durações já batem com o histórico." : "" });
  } catch (err) {
    if (err instanceof NvidiaNotConfiguredError) {
      return NextResponse.json({ error: "IA não configurada (falta NVIDIA_API_KEY)." }, { status: 503 });
    }
    console.error("shopping learn error:", err);
    return NextResponse.json({ error: "Erro ao consultar a IA." }, { status: 500 });
  }
}
