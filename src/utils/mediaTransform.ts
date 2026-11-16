import React from 'react';

const POS_RE = /#pos=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/;

/**
 * Lê o posicionamento e zoom salvos no final da URL (#pos=tx,ty,zoom) e devolve
 * o estilo CSS que aplica o mesmo enquadramento sem perder a animação de GIFs.
 */
export function mediaTransformStyle(url?: string): React.CSSProperties | undefined {
  if (!url) return undefined;
  const m = POS_RE.exec(url);
  if (!m) return undefined;
  const tx = Number(m[1]) || 0;
  const ty = Number(m[2]) || 0;
  const scale = Math.max(1, Math.min(4, Number(m[3]) || 1));
  if (tx === 0 && ty === 0 && scale === 1) return undefined;
  return {
    transform: `translate(${tx}%, ${ty}%) scale(${scale})`,
    transformOrigin: 'center center',
  };
}

export function parseMediaPos(url?: string): { baseUrl: string; tx: number; ty: number; zoom: number } {
  if (!url) return { baseUrl: '', tx: 0, ty: 0, zoom: 1 };
  const m = POS_RE.exec(url);
  if (!m) return { baseUrl: url, tx: 0, ty: 0, zoom: 1 };
  return {
    baseUrl: url.slice(0, m.index),
    tx: Number(m[1]) || 0,
    ty: Number(m[2]) || 0,
    zoom: Math.max(1, Math.min(3, Number(m[3]) || 1)),
  };
}

export function formatMediaPos(baseUrl: string, tx: number, ty: number, zoom: number): string {
  const clean = baseUrl.replace(POS_RE, '');
  const rx = Math.round(tx * 10) / 10;
  const ry = Math.round(ty * 10) / 10;
  const rz = Math.round(zoom * 100) / 100;
  if (rx === 0 && ry === 0 && rz === 1) return clean;
  return `${clean}#pos=${rx},${ry},${rz}`;
}
