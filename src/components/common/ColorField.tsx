'use client';

import React, { useEffect, useState } from 'react';

const HEX_FULL = /^#[0-9a-fA-F]{6}$/;

/** Aceita "fff", "#fff", "ffd027" ou "#ffd027" e devolve "#rrggbb" (ou null se ainda estiver incompleto) */
export function parseHex(text: string): string | null {
  const t = text.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(t)) return `#${t.split('').map((c) => c + c).join('')}`.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t}`.toLowerCase();
  return null;
}

interface ColorFieldProps {
  value: string;
  onChange: (hex: string) => void;
  testId?: string;
  /** Tamanho do seletor: "md" (padrão) ou "sm" */
  size?: 'sm' | 'md';
  /** Mostra só o campo do código (quando o seletor de cor já existe em outro lugar) */
  hexOnly?: boolean;
  /** Visual escuro (barras escuras como a da lousa) */
  dark?: boolean;
  className?: string;
}

/**
 * Seletor de cor com o código hexadecimal ao lado: dá para ver o valor e também digitar/colar o código.
 */
export function ColorField({ value, onChange, testId, size = 'md', hexOnly = false, dark = false, className = '' }: ColorFieldProps) {
  const safe = HEX_FULL.test(value) ? value.toLowerCase() : '#000000';
  const [text, setText] = useState(safe.toUpperCase());

  // Quando a cor muda por fora (seletor, restaurar padrão), o texto acompanha
  useEffect(() => {
    setText(safe.toUpperCase());
  }, [safe]);

  const h = size === 'sm' ? 'h-8' : 'h-9';
  const textSkin = dark
    ? 'bg-slate-800 border border-slate-600 focus:border-white text-white'
    : 'bg-white border border-slate-900/15 focus:border-[#3044f0] text-slate-900';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!hexOnly && (
        <input
          type="color"
          data-testid={testId}
          value={safe}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          aria-label="Escolher cor"
          className={`${h} w-12 flex-shrink-0 rounded-lg bg-transparent cursor-pointer`}
        />
      )}
      <input
        type="text"
        data-testid={testId ? `${testId}-hex` : undefined}
        value={text}
        maxLength={7}
        spellCheck={false}
        autoCapitalize="characters"
        aria-label="Código hexadecimal da cor"
        title="Código hexadecimal (ex: #FFD027). Digite ou cole aqui."
        onChange={(e) => {
          const next = e.target.value.toUpperCase();
          setText(next);
          const parsed = parseHex(next);
          if (parsed) onChange(parsed);
        }}
        onBlur={() => setText(safe.toUpperCase())}
        className={`${h} flex-1 min-w-0 px-2.5 rounded-lg ${textSkin} text-xs font-mono font-bold uppercase focus:outline-none`}
      />
    </div>
  );
}
