'use client';

import React from 'react';
import { X } from 'lucide-react';

interface ModalShellProps {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  /** Largura do cartão todo */
  width?: string;
  /** Conteúdo extra embaixo, na metade cobalto (ex.: pré-visualização) */
  aside?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}

/**
 * Molde de todas as janelas do Mesa: o mesmo cartão dividido do login.
 * Metade cobalto com estrelinhas e título largo em caixa alta, metade papel creme com o conteúdo.
 */
export function ModalShell({ title, subtitle, onClose, width = 'max-w-3xl', aside, children, testId }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0b0f19]/70 animate-fadeIn" data-testid={testId}>
      <div className={`mesa-paper relative w-full ${width} max-h-[94vh] overflow-hidden rounded-3xl flex flex-col md:flex-row shadow-[0_40px_80px_-24px_rgba(0,0,0,0.7)]`}>
        {/* Metade cobalto */}
        <div className="relative flex-shrink-0 md:w-[310px] bg-[#3044f0] text-white p-5 md:p-8 flex flex-col justify-between gap-6 overflow-hidden">
          <div className="relative space-y-5 md:space-y-8">
            <span className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffd027] text-base font-black text-[#0b0f19]">M</span>
              <span className="text-lg font-extrabold tracking-tight">Mesa</span>
            </span>
            <div>
              <h2 className="landing-display text-[22px] md:text-2xl [overflow-wrap:anywhere]">{title}</h2>
              {subtitle && <p className="mt-3 text-sm leading-relaxed text-white/85">{subtitle}</p>}
            </div>
          </div>

          {aside && <div className="relative hidden md:block">{aside}</div>}
        </div>

        {/* Metade creme */}
        <div className="relative flex-1 min-w-0 bg-[#f6f5f0] text-slate-900 p-5 sm:p-7 md:p-9 overflow-y-auto">
          {children}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          title="Fechar"
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white md:bg-slate-900/5 md:text-slate-700 hover:bg-white/25 md:hover:bg-slate-900/10 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

/** Rótulo pequeno em caixa alta dos campos (como no login) */
export const FIELD_LABEL = 'block mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600';
/** Campo de texto sobre o papel creme */
export const FIELD_INPUT =
  'w-full px-4 py-3 rounded-xl bg-white border border-slate-900/15 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#3044f0] focus:ring-2 focus:ring-[#3044f0]/25';
/** Botão principal: pílula preta */
export const BTN_PRIMARY =
  'h-12 px-7 rounded-full bg-[#0b0f19] hover:bg-slate-800 text-white text-sm font-extrabold flex items-center justify-center gap-2 transition-colors active:scale-95 disabled:opacity-60';
/** Botão secundário: texto simples */
export const BTN_GHOST = 'h-12 px-4 text-sm font-bold text-slate-600 hover:text-slate-950 transition-colors';
