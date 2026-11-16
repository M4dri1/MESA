'use client';

import React, { useEffect, useState } from 'react';
import { THEME_PRESETS, ThemeSettings, applyTheme, effectiveAccent, effectiveBg, loadTheme, saveTheme, DEFAULT_THEME } from '@/lib/theme';
import { Palette, RotateCcw, Check, Sun, Moon } from 'lucide-react';
import { ColorField } from '@/components/common/ColorField';

const FALLBACK_BG = '#0b0f19';
const FALLBACK_ACCENT = '#ffd027';

/**
 * Seção "Aparência" das Configurações: cores do Mesa. Tudo vale só no seu navegador:
 * ninguém mais vê, e a escolha fica guardada neste aparelho.
 */
export function AppearancePanel() {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);

  useEffect(() => {
    setTheme(loadTheme());
  }, []);

  const update = (next: ThemeSettings) => {
    setTheme(next);
    saveTheme(next);
    applyTheme(next);
  };

  return (
    <div data-testid="appearance-panel">
      <h2 className="landing-display text-2xl text-slate-950 flex items-center gap-2">
        <Palette className="w-5 h-5 text-[#3044f0]" /> Aparência
      </h2>
      <p className="text-xs text-slate-500 mt-1 mb-4">Escolha as cores do Mesa. Só você vê essa mudança, nos outros nada muda.</p>

      <p className="text-xs font-bold text-slate-700 mb-2">Modo</p>
      <div className="grid grid-cols-2 gap-2 mb-5" data-testid="theme-mode" role="group" aria-label="Modo">
        {(
          [
            ['light', 'Claro', 'Janelas e chat em papel creme', Sun],
            ['dark', 'Escuro', 'Tudo escuro, bom para a noite', Moon],
          ] as const
        ).map(([id, label, hint, Icon]) => {
          const selected = theme.mode === id;
          return (
            <button
              key={id}
              type="button"
              data-testid={`mode-${id}`}
              aria-pressed={selected}
              onClick={() => update({ ...theme, mode: id })}
              className={`p-3 rounded-2xl border-2 text-left flex items-center gap-3 transition-colors ${
                selected ? 'border-[#3044f0] bg-[#3044f0]/[0.07]' : 'border-slate-900/10 bg-white hover:border-slate-900/30'
              }`}
            >
              <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${id === 'dark' ? 'bg-[#0f1524] text-[#ffd027]' : 'bg-[#f6f5f0] text-[#3044f0] border border-slate-900/15'}`}>
                <Icon className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-extrabold text-slate-950">{label}</span>
                <span className="block text-[11px] text-slate-500 leading-snug">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs font-bold text-slate-700 mb-2">Temas prontos</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {THEME_PRESETS.map((preset) => {
          const selected = theme.preset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              data-testid={`theme-${preset.id}`}
              aria-pressed={selected}
              onClick={() =>
                update({
                  bg: preset.bg,
                  accent: preset.accent,
                  chat: theme.chat || null,
                  preset: preset.id,
                  mode: theme.mode,
                })
              }
              className={`p-2 rounded-xl border text-left transition-colors ${
                selected ? 'border-[#3044f0] bg-[#3044f0]/[0.07]' : 'border-slate-900/10 bg-white hover:border-slate-900/30'
              }`}
            >
              <span
                className="flex items-center justify-between h-9 px-2 rounded-lg border border-slate-900/10"
                style={{ backgroundColor: effectiveBg(preset.bg || FALLBACK_BG) }}
              >
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.accent ? effectiveAccent(preset.accent) : '#ffd027' }} />
                {selected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
              </span>
              <span className="block mt-1.5 text-[11px] font-bold text-slate-900 truncate">{preset.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs font-bold text-slate-700 mt-5 mb-2">Escolher as cores</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
        <div className="p-3 rounded-xl bg-[#f6f5f0] border border-slate-900/10 flex flex-col justify-between">
          <div>
            <span className="block text-xs font-bold text-slate-900">Fundo</span>
            <span className="block text-[11px] text-slate-500 mb-2">Palco, barras e moldura</span>
          </div>
          <ColorField
            testId="theme-bg"
            value={theme.bg || FALLBACK_BG}
            onChange={(hex) => update({ ...theme, bg: hex, preset: 'custom' })}
          />
        </div>
        <div className="p-3 rounded-xl bg-[#f6f5f0] border border-slate-900/10 flex flex-col justify-between">
          <div>
            <span className="block text-xs font-bold text-slate-900">Destaque</span>
            <span className="block text-[11px] text-slate-500 mb-2">Botões, abas e a cor da marca</span>
          </div>
          <ColorField
            testId="theme-accent"
            value={theme.accent || FALLBACK_ACCENT}
            onChange={(hex) => update({ ...theme, accent: hex, preset: 'custom' })}
          />
        </div>
        <div className="p-3 rounded-xl bg-[#f6f5f0] border border-slate-900/10 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <div>
              <span className="block text-xs font-bold text-slate-900">Cor do chat</span>
              <span className="block text-[11px] text-slate-500 mb-2">Painel de mensagens (texto ajusta sozinho)</span>
            </div>
            {theme.chat && (
              <button
                type="button"
                onClick={() => update({ ...theme, chat: null })}
                className="text-[10px] font-bold text-[#3044f0] hover:underline flex-shrink-0"
              >
                Padrão
              </button>
            )}
          </div>
          <ColorField
            testId="theme-chat"
            value={theme.chat || (theme.mode === 'dark' ? '#0f1524' : '#f6f5f0')}
            onChange={(hex) => update({ ...theme, chat: hex })}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Verde, vermelho e roxo (sucesso, perigo, bot) não mudam, para continuarem fáceis de entender.
        </p>
        <button
          type="button"
          data-testid="theme-reset"
          onClick={() => update({ ...DEFAULT_THEME })}
          className="px-3 py-2 rounded-xl bg-slate-900/5 hover:bg-slate-900/10 text-slate-900 text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrão
        </button>
      </div>
    </div>
  );
}
