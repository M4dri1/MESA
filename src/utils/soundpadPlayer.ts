'use client';

/**
 * Toca sons curtos do soundpad. Os arquivos são baixados uma vez, decodificados e guardados na
 * memória, para o som sair na hora nas próximas vezes (sem esperar a rede).
 */

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();
let active = 0;
const MAX_ACTIVE = 6;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctx: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    return ctx;
  } catch {
    return null;
  }
}

function load(context: AudioContext, url: string): Promise<AudioBuffer> {
  let promise = buffers.get(url);
  if (!promise) {
    promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data));
    promise.catch(() => buffers.delete(url));
    buffers.set(url, promise);
    // Guarda no máximo 40 sons na memória
    if (buffers.size > 40) buffers.delete(buffers.keys().next().value as string);
  }
  return promise;
}

/** Baixa e decodifica o som antes de ser preciso (opcional) */
export function preloadClip(url: string) {
  const context = getContext();
  if (context) void load(context, url).catch(() => {});
}

/** Toca o som com o volume dado (0 a 1). Devolve false se não tocou. */
export async function playClip(url: string, volume: number): Promise<boolean> {
  if (volume <= 0 || active >= MAX_ACTIVE) return false;
  const context = getContext();
  if (!context) return false;
  try {
    const buffer = await load(context, url);
    if (context.state === 'suspended') await context.resume();
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = Math.min(1, volume);
    source.connect(gain);
    gain.connect(context.destination);
    active++;
    source.onended = () => {
      active = Math.max(0, active - 1);
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    return true;
  } catch {
    return false;
  }
}
