"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";
import Button from "@/components/Button";

type Status = "idle" | "loading" | "open" | "success" | "error";

declare global {
  interface Window {
    PluggyConnect: new (config: {
      connectToken: string;
      includeSandbox?: boolean;
      theme?: string;
      onSuccess: (data: { item: { id: string } }) => void;
      onError: (error: { message?: string }) => void;
      onClose: () => void;
    }) => { init: () => void; destroy?: () => void };
  }
}

export default function ConnectBankPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [scriptReady, setScriptReady] = useState(false);
  const widgetRef = useRef<{ init: () => void; destroy?: () => void } | null>(null);

  const onSuccess = useCallback(
    async (data: { item: { id: string } }) => {
      setStatus("success");

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setStatus("error");
          setErrorMsg("Usuário não autenticado.");
          return;
        }

        const { error } = await supabase.from("accounts").insert({
          user_id: user.id,
          pluggy_account_id: data.item.id,
          bank_name: "Conta conectada",
          account_type: "checking",
          name: "Conta via Open Finance",
          balance: 0,
        });

        if (error) {
          setStatus("error");
          setErrorMsg("Erro ao salvar conta: " + error.message);
          return;
        }

        router.push("/dashboard");
      } catch {
        setStatus("error");
        setErrorMsg("Erro ao salvar conta conectada.");
      }
    },
    [router]
  );

  const onError = useCallback((error: { message?: string }) => {
    setStatus("error");
    setErrorMsg(error.message || "Erro durante a conexão.");
  }, []);

  const onClose = useCallback(() => {
    setStatus((prev) => (prev !== "success" ? "idle" : prev));
  }, []);

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

      if (!scriptReady || !window.PluggyConnect) {
        setStatus("error");
        setErrorMsg("Widget ainda carregando. Tente novamente.");
        return;
      }

      const widget = new window.PluggyConnect({
        connectToken,
        includeSandbox: false,
        theme: "dark",
        onSuccess,
        onError,
        onClose,
      });

      widgetRef.current = widget;
      widget.init();
      setStatus("open");
    } catch {
      setStatus("error");
      setErrorMsg("Erro ao conectar. Tente novamente.");
    }
  }

  return (
    <AppShell>
      <Script
        src="https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js"
        strategy="lazyOnload"
        onReady={() => setScriptReady(true)}
      />

      <h2 className="label-upper mb-4">Conectar Banco</h2>

      <div className="text-center py-6">
        <p className="text-white/45 mb-6">
          Conecte sua conta bancária para importar transações automaticamente
          via Open Finance.
        </p>

        {status !== "open" && (
          <Button
            onClick={handleConnect}
            loading={status === "loading" || status === "success"}
          >
            {status === "loading"
              ? "Gerando token..."
              : status === "success"
                ? "Redirecionando..."
                : "Conectar conta bancária"}
          </Button>
        )}

        {status === "error" && (
          <p className="text-red-400 text-sm mt-4">{errorMsg}</p>
        )}

        {status === "success" && (
          <p className="text-green-400 text-sm mt-4">
            Conta conectada com sucesso! Redirecionando...
          </p>
        )}
      </div>
    </AppShell>
  );
}
