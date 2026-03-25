"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import Button from "@/components/Button";

export default function ConnectBankPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleConnect() {
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/pluggy-token", { method: "POST" });
      if (!res.ok) {
        setStatus("error");
        setErrorMsg("Erro ao gerar token de conexão.");
        return;
      }

      const { connectToken } = await res.json();
      window.location.href = `https://frolicking-taiyaki-eae8ed.netlify.app/pluggy.html?token=${connectToken}`;
    } catch {
      setStatus("error");
      setErrorMsg("Erro ao conectar. Tente novamente.");
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-6">Conectar Banco</h1>

      <div className="bg-dark-800 rounded-2xl p-6 border border-dark-700 text-center">
        <p className="text-gray-400 mb-6">
          Conecte sua conta bancária para importar transações automaticamente via Open Finance.
        </p>

        <Button onClick={handleConnect} loading={status === "loading"}>
          {status === "loading" ? "Conectando..." : "Conectar conta bancária"}
        </Button>

        {status === "error" && (
          <p className="text-red-400 text-sm mt-4">{errorMsg}</p>
        )}
      </div>
    </AppShell>
  );
}
