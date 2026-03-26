"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import type { Account, Profile } from "@/lib/types";
import AppShell from "@/components/AppShell";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { Landmark, LogOut, Palette } from "lucide-react";
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
        <p className="text-white/45">Carregando...</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Dados pessoais */}
        <div className="glass-divider pb-5 space-y-4">
          <h2 className="label-upper">Dados Pessoais</h2>
          <Input
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={handleSave} loading={saving}>
            Salvar
          </Button>
        </div>

        {/* Aparência */}
        <div className="glass-divider pb-5">
          <h2 className="label-upper mb-3">Personalização</h2>
          <Link href="/settings/appearance">
            <button className="glass-btn w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:text-white">
              <Palette size={18} className="text-[#6366F1]" />
              <span>Configurar Aparência</span>
            </button>
          </Link>
        </div>

        {/* Contas bancárias */}
        <div className="glass-divider pb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="label-upper">Contas Bancárias</h2>
            <Link href="/connect-bank">
              <Button variant="secondary" className="!py-2 !px-4 text-xs flex items-center gap-2">
                <Landmark size={14} />
                Conectar
              </Button>
            </Link>
          </div>

          {accounts.length === 0 ? (
            <p className="text-white/30 text-sm">Nenhuma conta conectada.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between glass-card p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{a.name}</p>
                    <p className="text-xs text-white/30">
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

        {/* Logout */}
        <Button variant="ghost" onClick={handleLogout} className="flex items-center gap-2 text-red-400">
          <LogOut size={16} />
          Sair da conta
        </Button>
      </div>
    </AppShell>
  );
}
