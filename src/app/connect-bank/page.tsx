"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import Button from "@/components/Button";

declare global {
  interface Window {
    PluggyConnect: new (config: {
      connectToken: string;
      onSuccess: (data: unknown) => void;
      onError: (error: unknown) => void;
      onClose: () => void;
    }) => { init: () => void };
  }
}

export default function ConnectBankPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const scriptLoaded = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (scriptLoaded.current) return;
    const script = document.createElement("script");
    script.src = "https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js";
    script.onload = () => {
      scriptLoaded.current = true;
    };
    document.head.appendChild(script);
  }, []);

  async function handleConnect() {
    setStatus("loading");
    setErrorMsg("");

    const res = await fetch("/api/pluggy-token", { method: "POST" });
    if (!res.ok) {
      setStatus("error");
      setErrorMsg("Erro ao gerar token de conexão.");
      return;
    }

    const { connectToken } = await res.json();

    if (!window.PluggyConnect) {
      setStatus("error");
      setErrorMsg("Script do Pluggy não carregou.");
      return;
    }

    setStatus("ready");

    new window.PluggyConnect({
      connectToken,
      onSuccess: () => {
        router.push("/profile");
      },
      onError: (err) => {
        setStatus("error");
        setErrorMsg("Erro na conexão: " + String(err));
      },
      onClose: () => {
        setStatus("idle");
      },
    }).init();
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
