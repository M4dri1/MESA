'use client';

import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps<K extends string> {
  /** Prefixo dos data-testid: "chat-search" ou "materials-search" */
  testPrefix: string;
  placeholder: string;
  inputLabel: string;
  text: string;
  from: string;
  to: string;
  kinds: K[];
  kindOptions: { kind: K; label: string }[];
  onText: (text: string) => void;
  onFrom: (day: string) => void;
  onTo: (day: string) => void;
  onToggleKind: (kind: K) => void;
  onClose: () => void;
  onClear: () => void;
  /** Tem algum filtro ligado? (mostra "Limpar filtros") */
  filtering: boolean;
  /** Linha que diz quantos resultados há (ou o que a busca cobre, sem filtro) */
  countText: string;
  /** Avisos extras embaixo (carregando histórico, erro...) */
  children?: React.ReactNode;
}

/** Barra de busca: palavra, datas (De / Até) e tipos. Serve para o chat e para os materiais */
export function SearchBar<K extends string>({
  testPrefix,
  placeholder,
  inputLabel,
  text,
  from,
  to,
  kinds,
  kindOptions,
  onText,
  onFrom,
  onTo,
  onToggleKind,
  onClose,
  onClear,
  filtering,
  countText,
  children,
}: SearchBarProps<K>) {
  return (
    <div data-testid={testPrefix} className="px-3 pt-3 pb-2.5 border-b border-slate-900/10 bg-[#f6f5f0] space-y-2">
      <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-900/10 focus-within:border-[#3044f0] px-2.5 transition-colors">
        <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        <input
          data-testid={`${testPrefix}-input`}
          type="text"
          autoFocus
          value={text}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder={placeholder}
          aria-label={inputLabel}
          className="flex-1 min-w-0 bg-transparent py-2 text-xs text-slate-900 placeholder-slate-500 focus:outline-none"
        />
        <button type="button" data-testid={`${testPrefix}-close`} onClick={onClose} title="Fechar busca" className="p-1 rounded-md text-slate-500 hover:text-slate-950 hover:bg-slate-900/10">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] font-bold text-slate-500">
          De
          <input
            data-testid={`${testPrefix}-from`}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onFrom(e.target.value)}
            aria-label="Data inicial"
            className="mt-1 w-full rounded-lg bg-white border border-slate-900/10 focus:border-[#3044f0] px-2 py-1.5 text-xs font-normal normal-case text-slate-800 focus:outline-none [color-scheme:dark]"
          />
        </label>
        <label className="block text-[10px] font-bold text-slate-500">
          Até
          <input
            data-testid={`${testPrefix}-to`}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => onTo(e.target.value)}
            aria-label="Data final"
            className="mt-1 w-full rounded-lg bg-white border border-slate-900/10 focus:border-[#3044f0] px-2 py-1.5 text-xs font-normal normal-case text-slate-800 focus:outline-none [color-scheme:dark]"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {kindOptions.map(({ kind, label }) => {
          const on = kinds.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              data-testid={`${testPrefix}-kind-${kind}`}
              aria-pressed={on}
              onClick={() => onToggleKind(kind)}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors ${
                on ? 'bg-[#ffd027] border-[#3044f0] text-slate-950' : 'bg-white border-slate-900/10 text-slate-700 hover:bg-slate-900/5'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span data-testid={`${testPrefix}-count`} role="status" className="text-slate-500">
          {countText}
        </span>
        {filtering && (
          <button type="button" data-testid={`${testPrefix}-clear`} onClick={onClear} className="flex-shrink-0 font-semibold text-[#3044f0] hover:text-[#2334c9]">
            Limpar filtros
          </button>
        )}
      </div>

      {children}
    </div>
  );
}
