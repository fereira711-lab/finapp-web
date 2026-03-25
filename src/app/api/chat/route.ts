import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { messages, financialContext } = await req.json();

  const systemPrompt = `Você é um assistente financeiro inteligente do FinApp.
Ajude o usuário com dúvidas sobre finanças pessoais, orçamento, investimentos e planejamento financeiro.
Seja conciso e prático. Responda sempre em português brasileiro.

Contexto financeiro do usuário:
${financialContext || "Nenhum contexto disponível."}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ message: text });
}
