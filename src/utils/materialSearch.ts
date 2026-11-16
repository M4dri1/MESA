/**
 * Busca na aba Materiais: por nome, por quem enviou, por dia e por tipo (PDF, imagem, link, outros).
 * Tudo roda no navegador, em cima da lista que a sala já tem.
 */
import type { StudyMaterial } from '@/types';
import { fold, inDateRange, searchTerms } from './chatSearch';

export type MaterialKind = StudyMaterial['type'];

export interface MaterialFilter {
  text: string;
  from: string;
  to: string;
  kinds: MaterialKind[];
}

export const EMPTY_MATERIAL_FILTER: MaterialFilter = { text: '', from: '', to: '', kinds: [] };
export const MATERIAL_KINDS: MaterialKind[] = ['pdf', 'image', 'link', 'file'];

export const isMaterialFilterActive = (filter: MaterialFilter) => !!(filter.text.trim() || filter.from || filter.to || filter.kinds.length);

/** Endereço do link (sem o "https://"), para achar "youtube" num link do YouTube */
const linkAddress = (material: StudyMaterial) => (material.type === 'link' ? material.url.replace(/^https?:\/\//i, '') : '');

export function materialMatches(material: StudyMaterial, filter: MaterialFilter): boolean {
  if (!inDateRange(material.ts ?? Date.now(), filter.from, filter.to)) return false;
  if (filter.kinds.length && !filter.kinds.includes(material.type)) return false;
  const terms = searchTerms(filter.text);
  if (terms.length) {
    const haystack = fold(`${material.title} ${material.uploadedBy} ${linkAddress(material)}`);
    if (!terms.every((term) => haystack.includes(term))) return false;
  }
  return true;
}
