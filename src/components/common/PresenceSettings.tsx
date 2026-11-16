'use client';

import React from 'react';
import { useMesa } from '@/context/MesaContext';
import { NotifyLevel, Presence } from '@/types';
import { BellRing } from 'lucide-react';

export const PRESENCE_OPTIONS: { id: Presence; label: string; hint: string; dot: string }[] = [
  { id: 'online', label: 'Online', hint: 'Disponível para estudar', dot: 'bg-emerald-400' },
  { id: 'ausente', label: 'Ausente', hint: 'Longe do teclado', dot: 'bg-[#ffd027]' },
  { id: 'ocupado', label: 'Não perturbe', hint: 'Sem sons nem avisos de mensagem', dot: 'bg-rose-500' },
];

const LEVELS: { id: NotifyLevel; label: string; hint: string }[] = [
  { id: 'all', label: 'Todas as mensagens', hint: 'Som a cada mensagem nova da sala' },
  { id: 'mentions', label: 'Só quando me marcarem', hint: 'Avisa só com @seu-nick ou @todos' },
  { id: 'none', label: 'Nenhuma', hint: 'Sem sons nem avisos (as mensagens continuam chegando)' },
];

/** Status (online / ausente / não perturbe) e nível de notificação. As escolhas valem na hora. */
export function PresenceSettings() {
  const { presence, setPresence, notifyLevel, setNotifyLevel, browserNotify, toggleBrowserNotify } = useMesa();

  const optionClass = (selected: boolean) =>
    `w-full text-left p-2.5 rounded-xl border transition-colors flex items-start gap-2.5 ${
      selected ? 'bg-[#3044f0]/[0.07] border-[#3044f0]' : 'bg-white border-slate-900/10 hover:border-slate-900/30'
    }`;

  return (
    <div className="space-y-4" data-testid="presence-settings">
      <div>
        <p className="text-xs font-bold text-slate-700 mb-1.5">Meu status</p>
        <div className="space-y-1.5">
          {PRESENCE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`status-${option.id}`}
              aria-pressed={presence === option.id}
              onClick={() => setPresence(option.id)}
              className={optionClass(presence === option.id)}
            >
              <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${option.dot}`} />
              <span>
                <span className="block text-xs font-bold text-slate-900">{option.label}</span>
                <span className="block text-[11px] text-slate-500">{option.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-slate-700 mb-1.5">Notificações de mensagem</p>
        <div className="space-y-1.5">
          {LEVELS.map((level) => (
            <button
              key={level.id}
              type="button"
              data-testid={`notify-${level.id}`}
              aria-pressed={notifyLevel === level.id}
              onClick={() => setNotifyLevel(level.id)}
              className={optionClass(notifyLevel === level.id)}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                  notifyLevel === level.id ? 'border-[#3044f0] bg-[#3044f0]' : 'border-slate-900/30'
                }`}
              />
              <span>
                <span className="block text-xs font-bold text-slate-900">{level.label}</span>
                <span className="block text-[11px] text-slate-500">{level.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          data-testid="browser-notify"
          aria-pressed={browserNotify}
          onClick={toggleBrowserNotify}
          className={`mt-2 ${optionClass(browserNotify)}`}
        >
          <BellRing className={`w-4 h-4 mt-0.5 flex-shrink-0 ${browserNotify ? 'text-[#3044f0]' : 'text-slate-500'}`} />
          <span>
            <span className="block text-xs font-bold text-slate-900">Avisos do navegador</span>
            <span className="block text-[11px] text-slate-500">
              {browserNotify ? 'Ligado: aparece um aviso no canto da tela quando o Mesa está em segundo plano.' : 'Desligado: clique para ligar os avisos no canto da tela.'}
            </span>
          </span>
        </button>
        <p className="text-[11px] text-slate-500 mt-1.5">
          Em "Não perturbe" nada toca nem aparece, mas o contador de não lidas continua. Marcações chegam mesmo se você estiver em outra sala.
        </p>
      </div>
    </div>
  );
}
