/**
 * Preferências de acessibilidade e idioma. Valem só para este aparelho (ficam no navegador),
 * não mudam nada para as outras pessoas e funcionam até antes de entrar na conta.
 */
import { useSyncExternalStore } from 'react';
import { ColorBlind, ColorBlindMode, feColorMatrixValues } from './colorblind';

export type { ColorBlind } from './colorblind';
export type Lang = 'pt' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'nl' | 'pl' | 'tr' | 'ru' | 'hi' | 'ja' | 'ko' | 'zh' | 'zh-tw';
export type FontChoice = 'default' | 'readable' | 'dyslexia' | 'serif';

export interface Preferences {
  lang: Lang;
  fontScale: number;
  font: FontChoice;
  colorBlind: ColorBlind;
  reduceMotion: boolean;
}

export const STORAGE_KEY = 'mesa_prefs';

// Cada idioma aparece escrito nele mesmo. Os textos de cada um ficam em src/lib/i18n-dict/<código>.ts
export const LANGUAGES: { code: Lang; name: string; htmlLang: string }[] = [
  { code: 'pt', name: 'Português (Brasil)', htmlLang: 'pt-BR' },
  { code: 'en', name: 'English', htmlLang: 'en' },
  { code: 'es', name: 'Español', htmlLang: 'es' },
  { code: 'fr', name: 'Français', htmlLang: 'fr' },
  { code: 'de', name: 'Deutsch', htmlLang: 'de' },
  { code: 'it', name: 'Italiano', htmlLang: 'it' },
  { code: 'nl', name: 'Nederlands', htmlLang: 'nl' },
  { code: 'pl', name: 'Polski', htmlLang: 'pl' },
  { code: 'tr', name: 'Türkçe', htmlLang: 'tr' },
  { code: 'ru', name: 'Русский', htmlLang: 'ru' },
  { code: 'hi', name: 'हिन्दी', htmlLang: 'hi' },
  { code: 'ja', name: '日本語', htmlLang: 'ja' },
  { code: 'ko', name: '한국어', htmlLang: 'ko' },
  { code: 'zh', name: '简体中文', htmlLang: 'zh-CN' },
  { code: 'zh-tw', name: '繁體中文', htmlLang: 'zh-TW' },
];

export const FONT_SCALES: { value: number; label: string }[] = [
  { value: 0.9, label: 'Pequeno' },
  { value: 1, label: 'Padrão' },
  { value: 1.15, label: 'Grande' },
  { value: 1.3, label: 'Muito grande' },
  { value: 1.5, label: 'Enorme' },
];

export const FONTS: { id: FontChoice; label: string; hint: string; stack: string }[] = [
  { id: 'default', label: 'Padrão do Mesa', hint: 'A fonte original do site', stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  { id: 'readable', label: 'Fácil de ler', hint: 'Letras bem diferentes entre si, feita para baixa visão', stack: '"Atkinson Hyperlegible", "Segoe UI", Arial, sans-serif' },
  { id: 'dyslexia', label: 'Para dislexia', hint: 'OpenDyslexic: letras mais pesadas embaixo, ajudam a não trocar uma por outra', stack: '"OpenDyslexic", "Comic Sans MS", "Segoe UI", sans-serif' },
  { id: 'serif', label: 'Com serifa', hint: 'Letras com pezinhos, como em livros', stack: 'Georgia, Cambria, "Times New Roman", serif' },
];

export const COLOR_BLIND_MODES: { id: ColorBlind; label: string; hint: string }[] = [
  { id: 'none', label: 'Desligado', hint: 'Cores originais' },
  { id: 'protanopia', label: 'Protanopia', hint: 'Dificuldade com vermelho' },
  { id: 'deuteranopia', label: 'Deuteranopia', hint: 'Dificuldade com verde' },
  { id: 'tritanopia', label: 'Tritanopia', hint: 'Dificuldade com azul e amarelo' },
];

export const DEFAULT_PREFS: Preferences = { lang: 'pt', fontScale: 1, font: 'default', colorBlind: 'none', reduceMotion: false };

const FILTER_PREFIX = 'mesa-cb-';
const FILTERS_ID = 'mesa-colorblind-filters';

function sanitize(raw: unknown): Preferences {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<Preferences>;
  const scale = FONT_SCALES.find((s) => s.value === p.fontScale)?.value ?? DEFAULT_PREFS.fontScale;
  return {
    lang: LANGUAGES.some((l) => l.code === p.lang) ? (p.lang as Lang) : DEFAULT_PREFS.lang,
    fontScale: scale,
    font: FONTS.some((f) => f.id === p.font) ? (p.font as FontChoice) : DEFAULT_PREFS.font,
    colorBlind: COLOR_BLIND_MODES.some((c) => c.id === p.colorBlind) ? (p.colorBlind as ColorBlind) : DEFAULT_PREFS.colorBlind,
    reduceMotion: typeof p.reduceMotion === 'boolean' ? p.reduceMotion : DEFAULT_PREFS.reduceMotion,
  };
}

export function loadPrefs(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  let saved: unknown = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {}
  const prefs = sanitize(saved);
  // Sem escolha guardada, segue o pedido do sistema para reduzir movimento
  if (!saved || typeof (saved as Partial<Preferences>).reduceMotion !== 'boolean') {
    try {
      prefs.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {}
  }
  return prefs;
}

function savePrefs(prefs: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

/** Filtros SVG que corrigem as cores para cada tipo de daltonismo */
function ensureColorFilters() {
  if (document.getElementById(FILTERS_ID)) return;
  const modes: ColorBlindMode[] = ['protanopia', 'deuteranopia', 'tritanopia'];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', FILTERS_ID);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  svg.setAttribute('translate', 'no');
  for (const mode of modes) {
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', FILTER_PREFIX + mode);
    // RGB linear é o espaço em que as matrizes de daltonismo foram calculadas
    filter.setAttribute('color-interpolation-filters', 'linearRGB');
    const matrix = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
    matrix.setAttribute('type', 'matrix');
    matrix.setAttribute('values', feColorMatrixValues(mode));
    filter.appendChild(matrix);
    svg.appendChild(filter);
  }
  document.body.appendChild(svg);
}

export function applyPrefs(prefs: Preferences) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (prefs.fontScale === 1) root.style.removeProperty('--mesa-scale');
  else root.style.setProperty('--mesa-scale', String(prefs.fontScale));

  const set = (name: string, value: string | null) => (value ? root.setAttribute(name, value) : root.removeAttribute(name));
  set('data-mesa-font', prefs.font === 'default' ? null : prefs.font);
  set('data-mesa-cb', prefs.colorBlind === 'none' ? null : prefs.colorBlind);
  set('data-mesa-motion', prefs.reduceMotion ? 'reduce' : null);
  root.lang = LANGUAGES.find((l) => l.code === prefs.lang)?.htmlLang || 'pt-BR';
  if (prefs.colorBlind !== 'none') ensureColorFilters();
}

/* ---------- Estado compartilhado (lido pelos componentes e pelo tradutor) ---------- */
let current: Preferences = DEFAULT_PREFS;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const getPrefs = () => current;
export const subscribePrefs = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** Lê o que está guardado e aplica na tela (chamado uma vez quando o app abre) */
export function initPrefs() {
  current = loadPrefs();
  applyPrefs(current);
  emit();
}

export function setPrefs(patch: Partial<Preferences>) {
  current = sanitize({ ...current, ...patch });
  savePrefs(current);
  applyPrefs(current);
  emit();
}

export function resetAccessibility() {
  setPrefs({ fontScale: 1, font: 'default', colorBlind: 'none', reduceMotion: false });
}

export function usePrefs(): Preferences {
  return useSyncExternalStore(subscribePrefs, getPrefs, () => DEFAULT_PREFS);
}
