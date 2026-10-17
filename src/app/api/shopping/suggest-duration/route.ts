import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { NvidiaNotConfiguredError, extractJson, nvidiaChat } from "@/lib/ai/nvidia";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    const qty = typeof body?.qty === "string" ? body.qty.trim().slice(0, 40) : "";
    if (!name) return NextResponse.json({ error: "Informe o item." }, { status: 400 });

    const text = await nvidiaChat(
      [
        {
          role: "system",
          content:
            "Você estima quanto tempo um item de supermercado dura para UMA única pessoa adulta que mora sozinha no Brasil. " +
            "Responda APENAS com JSON no formato {\"days\": <inteiro de 1 a 365>, \"reason\": \"<frase curta em português>\"}. " +
            "Considere a quantidade informada; se ela não vier clara (ex.: \"1 un\"), assuma a embalagem mais comum do item. " +
            "É só uma estimativa inicial: o app aprende o ritmo real com as compras. " +
            "Referências do usuário: arroz 5 kg = 30 dias; carne 1 kg = 5 dias.",
        },
        { role: "user", content: `Item: ${name}\nQuantidade comprada: ${qty || "não informada"}` },
      ],
      // gpt-oss "pensa" antes de responder: precisa de folga de tokens; 20 s por modelo antes de cair para o reserva
      { maxTokens: 600, temperature: 0.1, timeoutMs: 20000 },
    );

    const parsed = extractJson<{ days?: unknown; reason?: unknown }>(text);
    const days = Math.round(Number(parsed?.days));
    if (!parsed || isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json({ error: "A IA não retornou uma duração válida." }, { status: 502 });
    }
    const reason = typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : "";
    return NextResponse.json({ days, reason });
  } catch (err) {
    if (err instanceof NvidiaNotConfiguredError) {
      return NextResponse.json({ error: "IA não configurada (falta NVIDIA_API_KEY)." }, { status: 503 });
    }
    console.error("suggest-duration error:", err);
    return NextResponse.json({ error: "Erro ao consultar a IA." }, { status: 500 });
  }
}
