import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { NvidiaNotConfiguredError, extractJson, nvidiaChat } from "@/lib/ai/nvidia";
import { SHOP_CATEGORIES, mondayOf } from "@/lib/shopping";
import { brToday, buildDraft, type ParseContext } from "@/lib/quickEntry";

// So INTERPRETA a frase e devolve um rascunho. Nada e gravado aqui:
// quem grava e o app, depois que o usuario confere e confirma.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 300) : "";
    if (!text) return NextResponse.json({ error: "Fale ou digite o que você gastou." }, { status: 400 });

    const forceShopping = body?.context === "shopping";
    const today = brToday();
    const [y, m, d] = today.split("-").map(Number);
    const weekStart = mondayOf(new Date(y, m - 1, d));
    const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" }).format(new Date());

    const [catRes, cardRes, listRes] = await Promise.all([
      supabase.from("categories").select("name").eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase.from("credit_cards").select("id, name").eq("user_id", user.id),
      supabase.from("shopping_lists").select("id, status").eq("user_id", user.id).eq("week_start", weekStart)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const categories = (catRes.data || []).map((c) => ({
      name: c.name as string,
      label: (c.name as string).replace(/_/g, " "),
    }));
    const cards = (cardRes.data || []).map((c) => ({ id: c.id as string, name: c.name as string }));

    let openList: ParseContext["openList"] = null;
    if (listRes.data && listRes.data.status === "open") {
      const { data: items } = await supabase.from("shopping_list_items").select("id, name")
        .eq("list_id", listRes.data.id).eq("checked", false);
      openList = { id: listRes.data.id as string, items: (items || []).map((i) => ({ id: i.id as string, name: i.name as string })) };
    }

    if (forceShopping && !openList) {
      return NextResponse.json(
        { error: "Não há lista de compras aberta nesta semana. Gere a lista (ou toque em Nova compra) e tente de novo." },
        { status: 409 },
      );
    }
    const ctx: ParseContext = { today, categories, cards, openList, forceShopping };

    const system =
      "Você converte UMA frase falada em português do Brasil em UM lançamento financeiro. Responda APENAS com JSON.\n" +
      `Hoje é ${today} (${weekday}). Datas como "ontem", "anteontem" ou "sexta" viram YYYY-MM-DD; sem data, use hoje.\n` +
      'Formato: {"kind":"expense|income|shopping","amount":<número em reais>,"description":"<curta, ex.: Mercado, Gasolina>",' +
      '"category":"<uma chave da lista de categorias>","date":"YYYY-MM-DD","payment":"pix|card","card":"<nome do cartão ou null>",' +
      '"installments":<1 a 48>,"shopping_category":"<chave de compras>"}\n' +
      "Regras:\n" +
      '- income: recebi, ganhei, entrou, salário, me pagaram. Todo o resto é expense.\n' +
      '- payment=card só se a frase citar cartão/crédito ou o nome de um cartão da lista; pix, débito ou dinheiro = pix.\n' +
      '- installments só para cartão ("em 3x", "parcelei em 3 vezes"); senão 1.\n' +
      '- shopping só quando a frase diz que comprou um item que está na LISTA DA SEMANA abaixo; gastos gerais como "gastei 80 no mercado" são expense.\n' +
      '- amount é o valor TOTAL em reais; converta números por extenso ("quarenta e cinco" = 45; "45 e 90" = 45.90).\n' +
      (forceShopping
        ? '- CONTEXTO: o usuário está na tela de Compras. SEMPRE kind=shopping: é a compra de UM item. description = só o nome do item (sem o valor); amount = quanto pagou; escolha shopping_category.\n'
        : "") +
      `Categorias (chaves): ${categories.map((c) => c.name).join(", ") || "outros"}\n` +
      `Cartões: ${cards.map((c) => c.name).join(", ") || "nenhum"}\n` +
      `Lista da semana (ainda não comprados): ${openList && openList.items.length > 0 ? openList.items.map((i) => i.name).join(", ") : "nenhuma"}\n` +
      `Chaves de compras (shopping_category): ${Object.keys(SHOP_CATEGORIES).join(", ")}`;

    const answer = await nvidiaChat(
      [{ role: "system", content: system }, { role: "user", content: text }],
      // modelo de raciocínio: precisa de folga de tokens; 20 s por modelo antes de cair para o reserva
      { maxTokens: 700, temperature: 0.1, timeoutMs: 20000 },
    );

    const built = buildDraft(extractJson<Record<string, unknown>>(answer), ctx);
    if (!built) {
      return NextResponse.json({ error: "Não entendi o valor. Tente de novo, ex.: \"gastei 45 no mercado\"." }, { status: 422 });
    }
    return NextResponse.json(built);
  } catch (err) {
    if (err instanceof NvidiaNotConfiguredError) {
      return NextResponse.json({ error: "IA não configurada (falta NVIDIA_API_KEY)." }, { status: 503 });
    }
    console.error("quick-entry parse error:", err);
    return NextResponse.json({ error: "Erro ao consultar a IA." }, { status: 500 });
  }
}
