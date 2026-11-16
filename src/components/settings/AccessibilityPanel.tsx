'use client';

import React from 'react';
import { Accessibility, RotateCcw } from 'lucide-react';
import { COLOR_BLIND_MODES, DEFAULT_PREFS, FONTS, FONT_SCALES, resetAccessibility, setPrefs, usePrefs } from '@/lib/preferences';

const optionClass = (selected: boolean) =>
  `p-3 rounded-xl border text-left transition-colors ${
    selected ? 'border-[#3044f0] bg-[#3044f0]/[0.07]' : 'border-slate-900/10 bg-white hover:border-slate-900/30'
  }`;

const Radio = ({ selected }: { selected: boolean }) => (
  <span
    aria-hidden="true"
    className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 ${selected ? 'border-[#3044f0] bg-[#3044f0]' : 'border-slate-900/30'}`}
  />
);

// Cores que costumam ser confundidas, para dar para ver o efeito do modo escolhido
const SAMPLE_COLORS = ['#e53935', '#43a047', '#fb8c00', '#9ccc65', '#1e88e5', '#26a69a', '#fdd835', '#f8bbd0', '#8e24aa'];

/** Seção "Acessibilidade": tamanho do texto, fonte, daltonismo e movimento. Vale só neste aparelho. */
export function AccessibilityPanel() {
  const prefs = usePrefs();
  const changed =
    prefs.fontScale !== DEFAULT_PREFS.fontScale || prefs.font !== DEFAULT_PREFS.font || prefs.colorBlind !== DEFAULT_PREFS.colorBlind || prefs.reduceMotion !== DEFAULT_PREFS.reduceMotion;

  return (
    <div data-testid="accessibility-panel" className="space-y-7">
      <div>
        <h2 className="landing-display text-2xl text-slate-950 flex items-center gap-2">
          <Accessibility className="w-5 h-5 text-[#3044f0]" /> Acessibilidade
        </h2>
        <p className="text-xs text-slate-500 mt-1">Deixe o Mesa do jeito que for mais confortável para você. Fica guardado neste aparelho e ninguém mais vê.</p>
      </div>

      {/* Tamanho do texto */}
      <section aria-labelledby="a11y-size-title">
        <p id="a11y-size-title" className="text-xs font-bold text-slate-700 mb-2">
          Tamanho do texto
        </p>
        <div role="radiogroup" aria-labelledby="a11y-size-title" className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {FONT_SCALES.map((scale) => {
            const selected = prefs.fontScale === scale.value;
            return (
              <button
                key={scale.value}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`a11y-size-${Math.round(scale.value * 100)}`}
                onClick={() => setPrefs({ fontScale: scale.value })}
                className={`${optionClass(selected)} min-w-0 flex flex-col items-center justify-end gap-1 px-1 py-2 min-h-[5rem]`}
              >
                <span className="font-bold text-slate-900 leading-none" style={{ fontSize: 15 * scale.value }}>
                  Aa
                </span>
                <span className="max-w-full text-[11px] font-semibold text-slate-700 text-center leading-tight break-words">{scale.label}</span>
              </button>
            );
          })}
        </div>
        <p data-testid="a11y-size-preview" className="mt-3 p-3 rounded-xl bg-[#f6f5f0] border border-slate-900/10 text-sm text-slate-800 leading-relaxed">
          Assim fica o texto do chat, dos menus e dos botões. Estudar junto é mais fácil quando dá para ler sem esforço.
        </p>
      </section>

      {/* Fonte */}
      <section aria-labelledby="a11y-font-title">
        <p id="a11y-font-title" className="text-xs font-bold text-slate-700 mb-2">
          Fonte
        </p>
        <div role="radiogroup" aria-labelledby="a11y-font-title" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FONTS.map((font) => {
            const selected = prefs.font === font.id;
            return (
              <button
                key={font.id}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`a11y-font-${font.id}`}
                onClick={() => setPrefs({ font: font.id })}
                className={`${optionClass(selected)} flex items-start gap-2.5`}
              >
                <Radio selected={selected} />
                <span className="min-w-0">
                  <span data-font-sample="" className="block text-sm font-bold text-slate-900" style={{ fontFamily: font.stack }} translate="no">
                    Mesa · Aa Bb Cc 123
                  </span>
                  <span className="block text-xs font-bold text-slate-800 mt-0.5">{font.label}</span>
                  <span className="block text-[11px] text-slate-500">{font.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Daltonismo */}
      <section aria-labelledby="a11y-cb-title">
        <p id="a11y-cb-title" className="text-xs font-bold text-slate-700 mb-1">
          Modo daltonismo
        </p>
        <p className="text-[11px] text-slate-500 mb-2">Ajusta as cores da tela para facilitar a diferença entre tons que são difíceis de separar.</p>
        <div role="radiogroup" aria-labelledby="a11y-cb-title" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {COLOR_BLIND_MODES.map((mode) => {
            const selected = prefs.colorBlind === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`a11y-cb-${mode.id}`}
                onClick={() => setPrefs({ colorBlind: mode.id })}
                className={`${optionClass(selected)} flex items-start gap-2.5`}
              >
                <Radio selected={selected} />
                <span>
                  <span className="block text-xs font-bold text-slate-900">{mode.label}</span>
                  <span className="block text-[11px] text-slate-500">{mode.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true" data-testid="a11y-cb-sample">
          {SAMPLE_COLORS.map((color) => (
            <span key={color} className="h-6 flex-1 rounded-md" style={{ backgroundColor: color }} />
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">As cores acima mudam na hora, para você ver o efeito.</p>
      </section>

      {/* Movimento */}
      <section>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.reduceMotion}
          data-testid="a11y-motion"
          onClick={() => setPrefs({ reduceMotion: !prefs.reduceMotion })}
          className={`${optionClass(prefs.reduceMotion)} w-full flex items-center justify-between gap-3`}
        >
          <span>
            <span className="block text-xs font-bold text-slate-900">Reduzir animações</span>
            <span className="block text-[11px] text-slate-500">Tira movimentos e transições da tela. Ajuda quem se incomoda com animações.</span>
          </span>
          <span className={`relative w-10 h-6 rounded-full flex-shrink-0 transition-colors ${prefs.reduceMotion ? 'bg-[#ffd027]' : 'bg-slate-400'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${prefs.reduceMotion ? 'left-[1.15rem]' : 'left-0.5'}`} />
          </span>
        </button>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          data-testid="a11y-reset"
          disabled={!changed}
          onClick={resetAccessibility}
          className="px-3 py-2 rounded-xl bg-slate-900/5 hover:bg-slate-900/10 disabled:opacity-40 disabled:hover:bg-slate-900/5 text-slate-900 text-xs font-bold flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrão
        </button>
      </div>
    </div>
  );
}
