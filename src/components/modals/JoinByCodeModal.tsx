'use client';

import React, { useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { ArrowRight } from 'lucide-react';
import { ModalShell, FIELD_LABEL, BTN_PRIMARY, BTN_GHOST } from '@/components/common/ModalShell';

export function JoinByCodeModal() {
  const { isJoinCodeModalOpen, setIsJoinCodeModalOpen, joinRoomByCode } = useMesa();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isJoinCodeModalOpen) return null;

  const close = () => {
    setIsJoinCodeModalOpen(false);
    setError(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    const success = await joinRoomByCode(code);
    setBusy(false);
    if (success) {
      setIsJoinCodeModalOpen(false);
      setCode('');
      setError(false);
    } else {
      setError(true);
    }
  };

  return (
    <ModalShell
      title="Entrar com código"
      subtitle="Digite o código que quem criou a sala te mandou."
      onClose={close}
      width="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 md:pt-10">
        <div>
          <label className={FIELD_LABEL}>Código da sala</label>
          <input
            type="text"
            autoFocus
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(false);
            }}
            placeholder="Ex: MESA-4K7P"
            className="w-full px-4 py-4 rounded-xl bg-white border border-slate-900/15 focus:border-[#3044f0] text-slate-900 placeholder-slate-400 text-xl font-mono font-bold tracking-wider text-center focus:outline-none focus:ring-2 focus:ring-[#3044f0]/25"
          />
          {error && <p className="text-sm text-rose-600 mt-2.5 font-semibold">Código não encontrado. Confira com quem criou a sala.</p>}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={close} className={BTN_GHOST}>
            Cancelar
          </button>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            <span>Entrar na sala</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
