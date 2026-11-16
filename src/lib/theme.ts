'use client';

/**
 * Personalização de cores, só no navegador de quem escolheu.
 *
 * O estilo do Mesa usa centenas de cores fixas. Em vez de trocar uma por uma, o tema lê as regras
 * de CSS já carregadas, recalcula cada cor e injeta uma folha de estilo por cima:
 *  - fundos escuros ganham o tom do fundo escolhido;
 *  - o azul dos botões e o amarelo da marca ganham a cor de destaque escolhida;
 *  - verde, vermelho e roxo (que significam sucesso, perigo etc.) ficam como estão.
 */

export interface ThemeSettings {
  /** Cor de fundo (sempre escurecida para o texto continuar legível); null = a original */
  bg: string | null;
  /** Cor de destaque; null = as originais (azul e amarelo) */
  accent: string | null;
  /** Cor exclusiva do painel de chat; null = acompanha o modo/tema */
  chat?: string | null;
  preset: string;
  /** Claro (janelas e chat em papel creme) ou escuro (tudo escuro) */
  mode: 'light' | 'dark';
}

export const DEFAULT_THEME: ThemeSettings = { bg: null, accent: null, chat: null, preset: 'padrao', mode: 'light' };

export const THEME_PRESETS: { id: string; label: string; bg: string | null; accent: string | null }[] = [
  { id: 'padrao', label: 'Mesa (padrão)', bg: null, accent: null },
  { id: 'preto', label: 'Preto', bg: '#060606', accent: null },
  { id: 'grafite', label: 'Grafite', bg: '#1c2029', accent: '#6d8dff' },
  { id: 'floresta', label: 'Floresta', bg: '#0c261c', accent: '#34d399' },
  { id: 'oceano', label: 'Oceano', bg: '#092432', accent: '#22d3ee' },
  { id: 'roxo', label: 'Roxo', bg: '#1d1036', accent: '#a78bfa' },
  { id: 'vinho', label: 'Vinho', bg: '#2b0f1b', accent: '#f472b6' },
  { id: 'por-do-sol', label: 'Pôr do sol', bg: '#2c160a', accent: '#fb923c' },
];

const STORAGE_KEY = 'mesa_theme';
const STYLE_ID = 'mesa-theme';

export function loadTheme(): ThemeSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      const hex = /^#[0-9a-fA-F]{6}$/;
      return {
        bg: hex.test(saved.bg) ? saved.bg : null,
        accent: hex.test(saved.accent) ? saved.accent : null,
        chat: hex.test(saved.chat) ? saved.chat : null,
        preset: typeof saved.preset === 'string' ? saved.preset : 'custom',
        mode: saved.mode === 'dark' ? 'dark' : 'light',
      };
    }
  } catch {}
  return { ...DEFAULT_THEME };
}

export function saveTheme(theme: ThemeSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch {}
}

/* ---------------- cores ---------------- */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

interface Params {
  bg?: { hue: number; satScale: number; lightScale: number };
  accent?: { hue: number; sat: number; light: number };
  chat?: { hex: string; hue: number; sat: number; light: number; isDark: boolean };
}

// O fundo original do Mesa (#0b0f19) serve de referência para medir os outros
const REF_BG_SAT = 0.41;
const REF_BG_LIGHT = 0.0745;

function buildParams(theme: ThemeSettings): Params {
  const params: Params = {};
  if (theme.bg) {
    const [h, s, l] = rgbToHsl(...hexToRgb(theme.bg));
    params.bg = {
      hue: h,
      satScale: clamp(s / REF_BG_SAT, s > 0.08 ? 1.25 : 0, 2.4),
      lightScale: clamp(Math.min(l, 0.24) / REF_BG_LIGHT, 0.35, 3.0),
    };
  }
  if (theme.accent) {
    const [h, s, l] = rgbToHsl(...hexToRgb(theme.accent));
    // Nem escura demais (o texto branco some) nem clara demais (o texto escuro some)
    params.accent = { hue: h, sat: s, light: clamp(l, 0.45, 0.72) };
  }
  if (theme.chat) {
    const [r, g, b] = hexToRgb(theme.chat);
    const [h, s, l] = rgbToHsl(r, g, b);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    params.chat = { hex: theme.chat, hue: h, sat: s, light: l, isDark: lum < 0.48 };
  }
  return params;
}

function transformRgb(r: number, g: number, b: number, p: Params, isTextProperty = false): [number, number, number] {
  const [h, s, l] = rgbToHsl(r, g, b);
  const bluish = h >= 195 && h <= 262;
  // Nunca escurece cor de texto (color) com a cor de fundo, senão textos escuros (slate-800/900) ficam invisíveis no modo escuro
  if (!isTextProperty && p.bg && bluish && s <= 0.55 && l <= 0.45) {
    return hslToRgb(p.bg.hue, clamp(s * p.bg.satScale, 0, 1), clamp(l * p.bg.lightScale, 0, 0.6));
  }
  if (p.accent) {
    if (bluish && s > 0.4) {
      return hslToRgb(p.accent.hue, clamp(s * (p.accent.sat / 0.83), 0, 1), clamp(l + (p.accent.light - 0.53) * 0.6, 0, 0.97));
    }
    if (h >= 30 && h <= 60 && s > 0.6) {
      return hslToRgb(p.accent.hue, clamp(s * p.accent.sat, 0, 1), clamp(l + (p.accent.light - 0.58) * 0.6, 0, 0.97));
    }
  }
  return [r, g, b];
}

const RGB_FUNCTION = /rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(\s*[\/,]\s*(?:var\([^)]*\)|[^)]+))?\s*\)/g;
const HEX_COLOR = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const HAS_COLOR = /rgba?\(|#[0-9a-fA-F]{3}/;

function transformValue(value: string, p: Params, isTextProperty = false): string {
  return value
    .replace(RGB_FUNCTION, (match, r, g, b, alpha) => {
      const [nr, ng, nb] = transformRgb(+r, +g, +b, p, isTextProperty);
      if (nr === +r && ng === +g && nb === +b) return match;
      return `rgb(${nr} ${ng} ${nb}${alpha ? ` / ${String(alpha).replace(/^\s*[\/,]\s*/, '')}` : ''})`;
    })
    .replace(HEX_COLOR, (match, digits: string) => {
      const full = digits.length === 3 ? digits.split('').map((c) => c + c).join('') : digits;
      const [r, g, b] = hexToRgb(`#${full}`);
      const [nr, ng, nb] = transformRgb(r, g, b, p, isTextProperty);
      if (nr === r && ng === g && nb === b) return match;
      const hex = [nr, ng, nb].map((n) => n.toString(16).padStart(2, '0')).join('');
      return `#${hex}${full.length === 8 ? full.slice(6) : ''}`;
    });
}

function ruleToOverride(rule: CSSRule, p: Params): string | null {
  // 1 = regra normal; 4 = @media; 12 = @supports
  if (rule.type === 1) {
    const styleRule = rule as CSSStyleRule;
    const declarations: string[] = [];
    for (let i = 0; i < styleRule.style.length; i++) {
      const property = styleRule.style[i];
      const value = styleRule.style.getPropertyValue(property);
      if (!HAS_COLOR.test(value)) continue;
      const isText = property === 'color' || property === 'fill' || property === 'stroke';
      const next = transformValue(value, p, isText);
      if (next !== value) declarations.push(`${property}:${next} !important`);
    }
    return declarations.length ? `${styleRule.selectorText}{${declarations.join(';')}}` : null;
  }
  if (rule.type === 4 || rule.type === 12) {
    const group = rule as CSSMediaRule;
    const inner = Array.from(group.cssRules)
      .map((child) => ruleToOverride(child, p))
      .filter(Boolean)
      .join('');
    const head = rule.type === 4 ? `@media ${group.conditionText}` : `@supports ${(rule as unknown as { conditionText: string }).conditionText}`;
    return inner ? `${head}{${inner}}` : null;
  }
  return null;
}

/** Regras de cor recalculadas para o tema (lendo as folhas de estilo já carregadas) */
function buildOverrideCss(p: Params): string {
  const css: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    if ((sheet.ownerNode as HTMLElement | null)?.id === STYLE_ID) continue;
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // folha de outro site: o navegador não deixa ler
    }
    for (const rule of Array.from(rules)) {
      const override = ruleToOverride(rule, p);
      if (override) css.push(override);
    }
  }

  // Moldura e grandes painéis estruturais (.bg-[#3044f0] que NÃO são botões) nunca devem virar a cor viva de destaque,
  // senão os botões amarelos/destaque lá dentro somem por falta de contraste.
  if (p.bg) {
    const [fr, fg, fb] = hslToRgb(p.bg.hue, clamp(0.55 * p.bg.satScale, 0, 0.8), clamp(0.065 * p.bg.lightScale, 0.012, 0.17));
    const [sr, sg, sb] = hslToRgb(p.bg.hue, clamp(0.62 * p.bg.satScale, 0, 0.85), clamp(0.15 * p.bg.lightScale, 0.04, 0.26));
    const [pr, pg, pb] = hslToRgb(p.bg.hue, clamp(0.50 * p.bg.satScale, 0, 0.75), clamp(0.105 * p.bg.lightScale, 0.02, 0.20));
    const [cr, cg, cb] = hslToRgb(p.bg.hue, clamp(0.46 * p.bg.satScale, 0, 0.75), clamp(0.16 * p.bg.lightScale, 0.04, 0.26));
    const [lr, lg, lb] = hslToRgb(p.bg.hue, clamp(0.28 * p.bg.satScale, 0, 0.45), 0.92);
    css.push(`.mesa-frame,html[data-mesa-mode="dark"] .mesa-frame{background-color:rgb(${fr} ${fg} ${fb}) !important}`);
    css.push(`:not(button).bg-\\[\\#3044f0\\]:not(.mesa-frame){background-color:rgb(${sr} ${sg} ${sb}) !important}`);
    css.push(
      `html:not([data-mesa-mode="dark"]) .mesa-paper.bg-\\[\\#f6f5f0\\],html:not([data-mesa-mode="dark"]) .mesa-paper .bg-\\[\\#f6f5f0\\]{background-color:rgb(${lr} ${lg} ${lb}) !important}`
    );
    css.push(
      `html[data-mesa-mode="dark"] .mesa-paper.bg-\\[\\#f6f5f0\\],html[data-mesa-mode="dark"] .mesa-paper .bg-\\[\\#f6f5f0\\]{background-color:rgb(${pr} ${pg} ${pb}) !important}`
    );
    css.push(
      `html[data-mesa-mode="dark"] .mesa-paper.bg-white,html[data-mesa-mode="dark"] .mesa-paper .bg-white{background-color:rgb(${cr} ${cg} ${cb}) !important}`
    );
  } else if (p.accent) {
    const [fr, fg, fb] = hslToRgb(p.accent.hue, clamp(p.accent.sat * 0.65, 0, 0.75), 0.14);
    const [sr, sg, sb] = hslToRgb(p.accent.hue, clamp(p.accent.sat * 0.68, 0, 0.78), 0.20);
    css.push(`.mesa-frame{background-color:rgb(${fr} ${fg} ${fb}) !important}`);
    css.push(`:not(button).bg-\\[\\#3044f0\\]:not(.mesa-frame){background-color:rgb(${sr} ${sg} ${sb}) !important}`);
  }

  // Garante legibilidade total do texto nos cartões e no chat no modo escuro
  css.push(
    `html[data-mesa-mode="dark"] .mesa-paper .text-slate-950,html[data-mesa-mode="dark"] .mesa-paper .text-slate-900{color:#f8fafc !important}`,
    `html[data-mesa-mode="dark"] .mesa-paper .text-slate-800,html[data-mesa-mode="dark"] .mesa-paper .text-slate-700{color:#e2e8f0 !important}`,
    `html[data-mesa-mode="dark"] .mesa-paper .text-slate-600,html[data-mesa-mode="dark"] .mesa-paper .text-slate-500{color:#94a3b8 !important}`
  );

  // Cor exclusiva do painel de chat (com contraste automático de leitura para qualquer cor clara ou escura)
  if (p.chat) {
    const [br, bg, bb] = hslToRgb(p.chat.hue, p.chat.sat, p.chat.light);
    const cardL = p.chat.isDark ? clamp(p.chat.light + 0.07, 0.08, 0.38) : clamp(p.chat.light + 0.06, 0.85, 0.99);
    const [cr, cg, cb] = hslToRgb(p.chat.hue, clamp(p.chat.sat * 0.85, 0, 0.85), cardL);
    const titleHex = p.chat.isDark ? '#f8fafc' : '#0f172a';
    const bodyHex = p.chat.isDark ? '#e2e8f0' : '#1e293b';
    const mutedHex = p.chat.isDark ? '#cbd5e1' : '#475569';
    css.push(
      `.mesa-chat-panel,html[data-mesa-mode="dark"] .mesa-chat-panel,.mesa-chat-panel .bg-\\[\\#f6f5f0\\],html[data-mesa-mode="dark"] .mesa-chat-panel .bg-\\[\\#f6f5f0\\]{background-color:rgb(${br} ${bg} ${bb}) !important;color:${bodyHex} !important}`,
      `.mesa-chat-panel .bg-white,html[data-mesa-mode="dark"] .mesa-chat-panel .bg-white{background-color:rgb(${cr} ${cg} ${cb}) !important;color:${titleHex} !important}`,
      `.mesa-chat-panel .text-slate-950,.mesa-chat-panel .text-slate-900,html[data-mesa-mode="dark"] .mesa-chat-panel .text-slate-950,html[data-mesa-mode="dark"] .mesa-chat-panel .text-slate-900{color:${titleHex} !important}`,
      `.mesa-chat-panel .text-slate-800,.mesa-chat-panel .text-slate-700,html[data-mesa-mode="dark"] .mesa-chat-panel .text-slate-800,html[data-mesa-mode="dark"] .mesa-chat-panel .text-slate-700{color:${bodyHex} !important}`,
      `.mesa-chat-panel .text-slate-600,.mesa-chat-panel .text-slate-500,html[data-mesa-mode="dark"] .mesa-chat-panel .text-slate-600,html[data-mesa-mode="dark"] .mesa-chat-panel .text-slate-500{color:${mutedHex} !important}`,
      `.mesa-chat-panel input,.mesa-chat-panel textarea{color:${titleHex} !important}`
    );
  }

  return css.join('\n');
}

export function clearTheme() {
  if (typeof document === 'undefined') return;
  document.getElementById(STYLE_ID)?.remove();
  document.documentElement.removeAttribute('data-mesa-theme');
  document.documentElement.removeAttribute('data-mesa-mode');
}

/** Só tira as cores recalculadas (o modo claro/escuro é outra coisa e fica) */
function clearColors() {
  document.getElementById(STYLE_ID)?.remove();
  document.documentElement.removeAttribute('data-mesa-theme');
}

export function applyTheme(theme: ThemeSettings) {
  if (typeof document === 'undefined') return;
  // Modo escuro: as superfícies de papel (modo-escuro.css) trocam de cor quando este atributo está ligado
  if (theme.mode === 'dark') document.documentElement.setAttribute('data-mesa-mode', 'dark');
  else document.documentElement.removeAttribute('data-mesa-mode');
  const params = buildParams(theme);
  if (!params.bg && !params.accent && !params.chat) return clearColors();
  const css = buildOverrideCss(params);
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;
  document.documentElement.setAttribute('data-mesa-theme', 'on');
}

/** Cor que realmente será usada como destaque (depois de ajustar o brilho), para mostrar na prévia */
export function effectiveAccent(accent: string): string {
  const [h, s, l] = rgbToHsl(...hexToRgb(accent));
  const [r, g, b] = hslToRgb(h, s, clamp(l, 0.45, 0.72));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** Cor que realmente será usada como fundo (sempre escura), para mostrar na prévia */
export function effectiveBg(bg: string): string {
  const [h, s, l] = rgbToHsl(...hexToRgb(bg));
  const [r, g, b] = hslToRgb(h, s, Math.min(l, 0.2));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}
