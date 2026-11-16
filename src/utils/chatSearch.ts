/**
 * Busca no chat: por palavra, por data e por tipo de mídia. Tudo roda no navegador, em cima das
 * mensagens que a sala guarda.
 */
import type { ChatMessage } from '@/types';

export type MediaKind = 'photo' | 'video' | 'audio' | 'file' | 'link';

export interface ChatFilter {
  text: string;
  /** Dia inicial (AAAA-MM-DD), como o campo de data do navegador entrega */
  from: string;
  /** Dia final (AAAA-MM-DD), incluindo o dia inteiro */
  to: string;
  kinds: MediaKind[];
}

export const EMPTY_FILTER: ChatFilter = { text: '', from: '', to: '', kinds: [] };
export const MEDIA_KINDS: MediaKind[] = ['photo', 'video', 'audio', 'file', 'link'];

export const isFilterActive = (filter: ChatFilter) => !!(filter.text.trim() || filter.from || filter.to || filter.kinds.length);

/** Sem acento e em minúsculas: "calculo" acha "Cálculo" */
export const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const searchTerms = (text: string) => fold(text).split(/\s+/).filter(Boolean);

const IMAGE_HOSTS = ['media.tenor.com', 'c.tenor.com', 'i.giphy.com', 'i.imgur.com'];

/** Link que aponta direto para uma imagem ou GIF (o chat mostra aberto, como foto) */
function isImageLink(link: string): boolean {
  try {
    const url = new URL(link);
    return /\.(gif|png|jpe?g|webp)$/i.test(url.pathname) || IMAGE_HOSTS.includes(url.hostname) || /^media\d*\.giphy\.com$/.test(url.hostname);
  } catch {
    return false;
  }
}

/** Que tipos de mídia a mensagem tem (foto, vídeo, áudio, arquivo e/ou link) */
export function kindsOf(message: ChatMessage): MediaKind[] {
  const kinds = new Set<MediaKind>();
  const attachment = message.attachment;
  if (attachment) {
    if (attachment.type === 'image' && !attachment.asDocument) kinds.add('photo');
    else if (attachment.type === 'sticker') kinds.add('photo');
    else if (attachment.type === 'video' && !attachment.asDocument) kinds.add('video');
    else if (attachment.type === 'audio') kinds.add('audio');
    else if (attachment.type === 'link') kinds.add('link');
    else kinds.add('file'); // PDF, arquivo, e foto/vídeo enviados "como arquivo"
  }
  if (message.senderId !== 'system') {
    for (const link of message.content.match(/https?:\/\/[^\s<>"']+/gi) || []) kinds.add(isImageLink(link) ? 'photo' : 'link');
  }
  return Array.from(kinds);
}

const dayStart = (day: string) => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).getTime();
};
const dayAfter = (day: string) => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date + 1).getTime();
};

/** O momento cai entre os dias "de" e "até" (os dois dias inteiros)? Datas trocadas valem como o intervalo entre as duas */
export function inDateRange(ts: number, from: string, to: string): boolean {
  if (from && to && from > to) [from, to] = [to, from];
  if (from && ts < dayStart(from)) return false;
  if (to && ts >= dayAfter(to)) return false;
  return true;
}

export function messageMatches(message: ChatMessage, filter: ChatFilter): boolean {
  if (!inDateRange(message.ts ?? Date.now(), filter.from, filter.to)) return false;

  if (filter.kinds.length) {
    const kinds = kindsOf(message);
    if (!filter.kinds.some((kind) => kinds.includes(kind))) return false;
  }

  const terms = searchTerms(filter.text);
  if (terms.length) {
    const haystack = fold(`${message.senderName} ${message.content} ${message.attachment?.name || ''}`);
    if (!terms.every((term) => haystack.includes(term))) return false;
  }
  return true;
}

/** Pedaços do texto que casam com as palavras buscadas (ignorando acentos), para destacar */
export function highlightRanges(text: string, terms: string[]): [number, number][] {
  if (!terms.length) return [];
  let folded = '';
  const origin: number[] = []; // posição no texto sem acento -> posição no texto original
  for (let i = 0; i < text.length; i++) {
    const piece = fold(text[i]);
    for (let k = 0; k < piece.length; k++) {
      folded += piece[k];
      origin.push(i);
    }
  }
  const found: [number, number][] = [];
  for (const term of terms) {
    let at = folded.indexOf(term);
    while (at !== -1) {
      found.push([origin[at], origin[at + term.length - 1] + 1]);
      at = folded.indexOf(term, at + term.length);
    }
  }
  found.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of found) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}
