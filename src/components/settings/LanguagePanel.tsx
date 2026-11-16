'use client';

import React from 'react';
import { Languages } from 'lucide-react';
import { LANGUAGES, setPrefs, usePrefs } from '@/lib/preferences';

/** Seção "Idioma": troca a língua de todo o site, na hora. Vale só neste aparelho. */
export function LanguagePanel() {
  const prefs = usePrefs();

  return (
    <div data-testid="language-panel">
      <h2 className="landing-display text-2xl text-slate-950 flex items-center gap-2">
        <Languages className="w-5 h-5 text-[#3044f0]" /> Idioma
      </h2>
      <p className="text-xs text-slate-500 mt-1 mb-4">Escolha a língua do Mesa. A mudança é na hora e fica guardada neste aparelho.</p>

      <div role="radiogroup" aria-label="Idioma" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {LANGUAGES.map((language) => {
          const selected = prefs.lang === language.code;
          return (
            <button
              key={language.code}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={language.htmlLang}
              data-testid={`lang-${language.code}`}
              onClick={() => setPrefs({ lang: language.code })}
              className={`p-3 rounded-xl border text-left transition-colors flex items-center gap-2.5 ${
                selected ? 'border-[#3044f0] bg-[#3044f0]/[0.07]' : 'border-slate-900/10 bg-white hover:border-slate-900/30'
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${selected ? 'border-[#3044f0] bg-[#3044f0]' : 'border-slate-900/30'}`}
              />
              {/* O nome de cada língua aparece sempre nela mesma, para quem não entende o idioma atual */}
              <span className="text-sm font-bold text-slate-900" translate="no">
                {language.name}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
        A tradução vale para os textos do Mesa: menus, botões e avisos. O que as pessoas escrevem no chat, os nomes das salas e os nomes das pessoas não são traduzidos.
      </p>
    </div>
  );
}
