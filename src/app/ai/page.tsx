"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import AppShell from "@/components/AppShell";
import Button from "@/components/Button";
import { Send } from "lucide-react";

export default function AIPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadContext() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [accounts, transactions, bills] = await Promise.all([
        supabase.from("accounts").select("*").eq("user_id", user.id),
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(20),
        supabase.from("bills").select("*").eq("user_id", user.id).eq("status", "pending"),
      ]);

      const balance = (accounts.data || []).reduce((s, a) => s + a.balance, 0);
      const parts = [
        `Saldo total: ${formatCurrency(balance)}`,
        `Contas: ${(accounts.data || []).map((a) => `${a.name} (${formatCurrency(a.balance)})`).join(", ") || "Nenhuma"}`,
        `Últimas transações: ${(transactions.data || []).map((t) => `${t.description}: ${formatCurrency(t.amount)}`).join("; ") || "Nenhuma"}`,
        `Contas pendentes: ${(bills.data || []).map((b) => `${b.description}: ${formatCurrency(b.amount)}`).join("; ") || "Nenhuma"}`,
      ];
      setContext(parts.join("\n"));
    }
    loadContext();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages, financialContext: context }),
    });

    const data = await res.json();
    setMessages([...newMessages, { role: "assistant", content: data.message }]);
    setLoading(false);
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-4">IA Financeira</h1>

      <div className="bg-dark-800 rounded-2xl border border-dark-700 flex flex-col h-[calc(100vh-200px)] md:h-[calc(100vh-140px)]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg mb-2">Olá! Sou sua IA financeira.</p>
              <p className="text-sm">Pergunte sobre seus gastos, orçamento ou investimentos.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[80%] ${
                m.role === "user" ? "ml-auto" : "mr-auto"
              }`}
            >
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-white"
                    : "bg-dark-700 text-gray-200"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="mr-auto">
              <div className="bg-dark-700 rounded-2xl px-4 py-3 text-sm text-gray-400">
                Pensando...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSend}
          className="p-3 border-t border-dark-700 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte algo..."
            className="flex-1 bg-dark-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button type="submit" loading={loading} className="!px-4">
            <Send size={18} />
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
