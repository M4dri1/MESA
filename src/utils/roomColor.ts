/**
 * Cor da sala: dá para escolher qualquer cor. A cor é ajustada para nunca ficar clara demais
 * nem apagada (o texto branco do cartão da sala precisa continuar legível), e vira o degradê do cartão.
 */

type Rgb = [number, number, number];
type Hsl = [number, number, number];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb([h, s, l]: Hsl): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const toHex = (rgb: Rgb) => `#${rgb.map((n) => n.toString(16).padStart(2, '0')).join('')}`;

/** Mesma cor, mas com brilho entre "escuro" e "médio", para o texto branco sempre aparecer bem */
export function normalizeRoomColor(hex: string): string {
  if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return '#2563eb';
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  // Cinza e branco continuam sem cor (viram um cinza médio); as demais ganham pelo menos um pouco de cor
  return toHex(hslToRgb([h, s < 0.08 ? s : Math.max(s, 0.35), clamp(l, 0.3, 0.52)]));
}

/** Degradê do cartão da sala a partir da cor (em três tons, como os degradês prontos) */
export function roomGradient(color: string): string {
  const base = /^#[0-9a-f]{6}$/i.test(color) ? color : '#2563eb';
  const [h, s, l] = rgbToHsl(hexToRgb(base));
  const top = toHex(hslToRgb([h, s, clamp(l + 0.04, 0.3, 0.58)]));
  const middle = toHex(hslToRgb([h + 6, s, clamp(l - 0.08, 0.18, 0.5)]));
  const bottom = toHex(hslToRgb([h + 22, s * 0.9, 0.17]));
  return `linear-gradient(135deg, ${top}, ${middle}, ${bottom})`;
}
