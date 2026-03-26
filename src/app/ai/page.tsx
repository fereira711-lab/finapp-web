"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import AppShell from "@/components/AppShell";
import { Send, Bot, User, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "Quanto gastei este mês?",
  "Qual minha maior despesa?",
  "Como estão minhas finanças?",
  "Em que categoria gasto mais?",
  "Quanto sobrou este mês?",
  "Dicas para economizar",
];

export default function AIPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessages([...updated, { role: "assistant", content: data.reply }]);
      } else {
        setMessages([
          ...updated,
          { role: "assistant", content: data.error || "Erro ao processar resposta." },
        ]);
      }
    } catch {
      setMessages([
        ...updated,
        { role: "assistant", content: "Erro de conexão. Tente novamente." },
      ]);
    }

    setLoading(false);
    inputRef.current?.focus();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-220px)]">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-14 h-14 rounded-2xl glass-card flex items-center justify-center mb-4">
                <Sparkles size={24} className="text-[#6366F1]" />
              </div>
              <p className="text-lg font-medium mb-1">Olá! Sou sua IA financeira.</p>
              <p className="text-sm text-white/45 mb-6">
                Pergunte sobre seus gastos, receitas ou peça dicas financeiras.
              </p>

              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="glass-btn px-3 py-2 text-white/60 hover:text-white text-xs transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  m.role === "user"
                    ? "bg-[#6366F1]/20"
                    : "bg-emerald-500/20"
                }`}
              >
                {m.role === "user" ? (
                  <User size={14} className="text-[#6366F1]" />
                ) : (
                  <Bot size={14} className="text-emerald-400" />
                )}
              </div>

              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#6366F1] text-white"
                    : "glass-card text-white/80"
                }`}
              >
                {m.content.split("\n").map((line, j) => (
                  <span key={j}>
                    {line}
                    {j < m.content.split("\n").length - 1 && <br />}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-emerald-400" />
              </div>
              <div className="glass-card px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 glass-divider pt-3"
          style={{ borderBottom: "none", borderTop: "1px solid var(--glass-divider)" }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre suas finanças..."
            disabled={loading}
            className="flex-1 glass-input px-4 py-3 text-sm text-white placeholder-white/30 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white rounded-xl px-4 py-3 transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </AppShell>
  );
}
