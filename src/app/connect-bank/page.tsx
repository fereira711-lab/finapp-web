"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PluggyConnect } from "react-pluggy-connect";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";
import Button from "@/components/Button";

type Status = "idle" | "loading" | "open" | "success" | "error";

export default function ConnectBankPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [connectToken, setConnectToken] = useState("");

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

      const data = await res.json();
      setConnectToken(data.connectToken);
      setStatus("open");
    } catch {
      setStatus("error");
      setErrorMsg("Erro ao conectar. Tente novamente.");
    }
  }

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

        router.push("/");
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
    if (status !== "success") {
      setStatus("idle");
      setConnectToken("");
    }
  }, [status]);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-6">Conectar Banco</h1>

      <div className="bg-dark-800 rounded-2xl p-6 border border-dark-700 text-center">
        <p className="text-gray-400 mb-6">
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

      {status === "open" && connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={false}
          theme="dark"
          onSuccess={onSuccess}
          onError={onError}
          onClose={onClose}
        />
      )}
    </AppShell>
  );
}
