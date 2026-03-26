"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import type { Account, Profile } from "@/lib/types";
import AppShell from "@/components/AppShell";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { Landmark, LogOut } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, accountsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("accounts").select("*").eq("user_id", user.id),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setName(profileRes.data.name);
      }
      setAccounts(accountsRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ name }).eq("id", user.id);
      setProfile((p) => (p ? { ...p, name } : p));
    }
    setSaving(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <AppShell>
        <p className="text-gray-400">Carregando...</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="hidden md:block text-2xl font-bold mb-6">Perfil</h1>

      <div className="space-y-6">
        <div className="bg-dark-800 rounded-2xl p-4 md:p-5 border border-dark-700 space-y-4">
          <h2 className="text-lg font-semibold">Dados pessoais</h2>
          <Input
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={handleSave} loading={saving}>
            Salvar
          </Button>
        </div>

        <div className="bg-dark-800 rounded-2xl p-4 md:p-5 border border-dark-700">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Contas bancárias</h2>
            <Link href="/connect-bank">
              <Button variant="secondary" className="!py-2 !px-4 text-xs flex items-center gap-2">
                <Landmark size={14} />
                Conectar banco
              </Button>
            </Link>
          </div>

          {accounts.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhuma conta conectada.</p>
          ) : (
            <div className="space-y-3">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between bg-dark-700 rounded-xl p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{a.name}</p>
                    <p className="text-xs text-gray-400">
                      {a.bank_name} • {a.account_type}
                    </p>
                  </div>
                  <span className="font-bold text-sm">
                    {formatCurrency(a.balance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button variant="ghost" onClick={handleLogout} className="flex items-center gap-2 text-red-400">
          <LogOut size={16} />
          Sair da conta
        </Button>
      </div>
    </AppShell>
  );
}
