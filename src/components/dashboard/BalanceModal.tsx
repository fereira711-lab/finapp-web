"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { formatCurrency } from "@/lib/format";

type ReceiveDate = { date: string; amount: number };

interface BalanceModalProps {
  open: boolean;
  currentBalance: number;
  onClose: () => void;
  onSave: (value: number) => void;
  receiveDates: ReceiveDate[];
  onReceiveDatesChange: (dates: ReceiveDate[]) => void;
}

export default function BalanceModal({
  open,
  currentBalance,
  onClose,
  onSave,
  receiveDates,
  onReceiveDatesChange,
}: BalanceModalProps) {
  const [value, setValue] = useState("");
  const [dates, setDates] = useState<ReceiveDate[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(currentBalance.toFixed(2).replace(".", ","));
      setDates(receiveDates);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, currentBalance, receiveDates]);

  // Persiste imediatamente toda mudança em dates
  useEffect(() => {
    if (open) onReceiveDatesChange(dates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates]);

  if (!open) return null;

  function handleSave() {
    const parsed = parseFloat(value.replace(/\./g, "").replace(",", "."));
    if (!isNaN(parsed)) {
      onSave(parsed);
      onReceiveDatesChange(dates);
    }
  }

  function addReceiveDate() {
    setDates([...dates, { date: "", amount: 0 }]);
  }

  function removeReceiveDate(idx: number) {
    setDates(dates.filter((_, i) => i !== idx));
  }

  function updateReceiveDate(idx: number, field: "date" | "amount", val: string) {
    const newDates = [...dates];
    if (field === "date") {
      newDates[idx].date = val;
    } else {
      const numVal = parseFloat(val.replace(/[^\d,.-]/g, "").replace(",", "."));
      newDates[idx].amount = isNaN(numVal) ? 0 : numVal;
    }
    setDates(newDates);
  }

  const totalReceive = dates.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass w-full max-w-sm p-5 relative z-10 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Atualizar Saldo</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div>
          <label className="label-upper block mb-1">Saldo atual (R$)</label>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            className="glass-input w-full px-3 py-2 text-sm text-white"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="label-upper block">Valores a receber</label>
            <button onClick={addReceiveDate} className="text-[10px] text-[#6366F1] hover:underline">
              + Adicionar
            </button>
          </div>
          {dates.map((rec, idx) => (
            <div key={idx} className="space-y-2 p-3 glass-card">
              <div>
                <label className="text-[10px] text-white/60 block mb-1">Data</label>
                <input
                  type="date"
                  className="glass-input w-full px-2 py-1.5 text-sm text-white"
                  value={rec.date}
                  onChange={(e) => updateReceiveDate(idx, "date", e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-white/60 block mb-1">Valor</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="glass-input w-full px-2 py-1.5 text-sm text-white"
                  value={rec.amount.toFixed(2).replace(".", ",")}
                  onChange={(e) => updateReceiveDate(idx, "amount", e.target.value)}
                />
              </div>
              <button
                onClick={() => removeReceiveDate(idx)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remover
              </button>
            </div>
          ))}
          {dates.length > 0 && (
            <p className="text-xs text-white/60 text-center">
              Total a receber: <span className="text-green-400 font-bold">{formatCurrency(totalReceive)}</span>
            </p>
          )}
        </div>
        <button
          onClick={handleSave}
          className="glass-btn-active w-full py-2.5 text-sm font-medium"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
