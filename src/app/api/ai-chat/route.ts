import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Mensagem é obrigatória." }, { status: 400 });
    }

    // Fetch user financial data server-side
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const [accountsRes, txRes, billsRes] = await Promise.all([
      supabase.from("accounts").select("name, bank_name, balance").eq("user_id", user.id),
      supabase
        .from("transactions")
        .select("description, amount, category, date, type")
        .eq("user_id", user.id)
        .gte("date", startOfMonth)
        .lte("date", endOfMonth)
        .order("date", { ascending: false }),
      supabase
        .from("bills")
        .select("description, amount, due_date, status")
        .eq("user_id", user.id)
        .eq("status", "pending"),
    ]);

    const accounts = accountsRes.data || [];
    const transactions = txRes.data || [];
    const bills = billsRes.data || [];

    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const income = transactions
      .filter((t) => t.type === "income" || t.amount > 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const expenses = transactions
      .filter((t) => t.type === "expense" || t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    // Group expenses by category
    const catTotals: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "expense" || t.amount < 0)
      .forEach((t) => {
        const cat = t.category || "outros";
        catTotals[cat] = (catTotals[cat] || 0) + Math.abs(t.amount);
      });

    const catSummary = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => `  - ${cat}: ${formatBRL(total)}`)
      .join("\n");

    const txList = transactions
      .slice(0, 15)
      .map((t) => {
        const sign = t.type === "income" || t.amount > 0 ? "+" : "-";
        return `  - ${t.date} | ${t.description} | ${sign}${formatBRL(Math.abs(t.amount))} | ${t.category}`;
      })
      .join("\n");

    const accountsList = accounts
      .map((a) => `  - ${a.name} (${a.bank_name}): ${formatBRL(a.balance)}`)
      .join("\n");

    const billsList = bills
      .map((b) => `  - ${b.description}: ${formatBRL(b.amount)} (vence ${b.due_date})`)
      .join("\n");

    const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    const systemPrompt = `Você é o assistente financeiro do FinApp. Ajude o usuário a entender suas finanças pessoais.
Responda sempre em português brasileiro, de forma clara e concisa.
Use os dados financeiros abaixo para responder com precisão.
Quando mencionar valores, use o formato R$ X.XXX,XX.
Se o usuário perguntar algo que não está nos dados, diga que não tem essa informação disponível.

=== DADOS FINANCEIROS DO USUÁRIO (${monthName}) ===

Saldo total: ${formatBRL(totalBalance)}
Receitas do mês: ${formatBRL(income)}
Despesas do mês: ${formatBRL(expenses)}
Saldo do mês: ${formatBRL(income - expenses)}

Contas bancárias:
${accountsList || "  Nenhuma conta cadastrada"}

Gastos por categoria:
${catSummary || "  Nenhuma despesa"}

Últimas transações:
${txList || "  Nenhuma transação"}

Contas a pagar pendentes:
${billsList || "  Nenhuma conta pendente"}`;

    // Build messages array with history
    const apiMessages = [
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: apiMessages,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error("AI Chat error:", err);
    return NextResponse.json(
      { error: "Erro ao processar sua mensagem." },
      { status: 500 }
    );
  }
}
