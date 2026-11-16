'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { GifResult } from '@/types';
import { X, Search, Plus, Trash2, Loader2 } from 'lucide-react';

type Tab = 'emoji' | 'gif' | 'sticker';

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Carinhas', emojis: ['😀', '😂', '🤣', '😅', '😊', '😍', '😎', '🤔', '😴', '😭', '😡', '🥳', '🤯', '😱', '🥺', '😏', '🙄', '😬', '🤡', '💀'] },
  { label: 'Gestos', emojis: ['👍', '👎', '👏', '🙌', '🙏', '💪', '👀', '🤝', '✌️', '🤞', '👋', '🫡'] },
  { label: 'Estudo', emojis: ['📚', '✏️', '🧠', '✅', '❌', '❓', '⏰', '☕', '💯', '🔥', '✨', '🎉', '❤️', '🍕', '🎧', '💤'] },
];

/**
 * Seletor do chat com três abas, no estilo dos apps de conversa:
 * emojis (entram no texto), GIFs (busca no Giphy e envia) e figurinhas (coleção da pessoa).
 */
export function ChatPicker({ onEmoji, onClose }: { onEmoji: (emoji: string) => void; onClose: () => void }) {
  const { searchGifs, sendGif, stickers, createSticker, deleteSticker, sendSticker } = useMesa();
  const [tab, setTab] = useState<Tab>('emoji');

  // GIFs
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [gifState, setGifState] = useState<'idle' | 'loading' | 'error' | 'needsKey'>('idle');
  const [gifError, setGifError] = useState('');
  const requestRef = useRef(0);

  // Figurinhas
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (tab !== 'gif') return;
    const id = ++requestRef.current;
    setGifState('loading');
    // Espera a pessoa parar de digitar antes de buscar
    const timer = window.setTimeout(async () => {
      const result = await searchGifs(query.trim());
      if (id !== requestRef.current) return;
      if (result.ok) {
        setGifs(result.gifs);
        setGifState('idle');
      } else {
        setGifs([]);
        setGifError(result.error || 'Não foi possível buscar GIFs.');
        setGifState(result.needsKey ? 'needsKey' : 'error');
      }
    }, query ? 350 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, query]);

  const handleStickerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (stickerInputRef.current) stickerInputRef.current.value = '';
    if (!file) return;
    setCreating(true);
    await createSticker(file);
    setCreating(false);
  };

  const tabButton = (id: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      data-testid={`picker-tab-${id}`}
      onClick={() => setTab(id)}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
        tab === id ? 'bg-[#ffd027] text-slate-950' : 'text-slate-700 hover:bg-slate-900/5'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      data-testid="chat-picker"
      className="absolute bottom-full left-2 right-2 mb-2 z-30 h-80 flex flex-col rounded-xl bg-white border border-slate-900/10 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 p-2 border-b border-slate-900/10 flex-shrink-0">
        <div role="tablist" className="flex items-center gap-1">
          {tabButton('emoji', 'Emojis')}
          {tabButton('gif', 'GIFs')}
          {tabButton('sticker', 'Figurinhas')}
        </div>
        <button type="button" onClick={onClose} title="Fechar" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-950 hover:bg-slate-900/5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ---------- Emojis ---------- */}
      {tab === 'emoji' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-1 pb-1 text-[11px] font-bold text-slate-500">{group.label}</p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onEmoji(emoji)}
                    className="h-8 rounded-md text-lg hover:bg-slate-900/5"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- GIFs ---------- */}
      {tab === 'gif' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="p-2 flex-shrink-0">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#f6f5f0] border border-slate-900/10 focus-within:border-[#3044f0]">
              <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <input
                type="text"
                autoFocus
                data-testid="gif-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Procurar GIF (ex: comemorando, sono, gato)"
                className="flex-1 min-w-0 bg-transparent text-xs text-slate-900 placeholder-slate-500 focus:outline-none"
              />
              {gifState === 'loading' && <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin flex-shrink-0" />}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {gifState === 'needsKey' && (
              <div data-testid="gif-needs-key" className="h-full flex flex-col items-center justify-center text-center px-4 gap-1.5">
                <p className="text-xs font-bold text-slate-900">A busca de GIFs ainda não foi ligada</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Quem cuida do servidor precisa colocar a chave gratuita do Klipy ou do Giphy. Enquanto isso, dá para mandar GIF pelo
                  clipe (Foto ou GIF) ou colando o link direto do GIF no chat.
                </p>
              </div>
            )}
            {gifState === 'error' && <p className="text-xs text-rose-700 text-center py-6">{gifError}</p>}
            {gifState === 'idle' && gifs.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-6">Nenhum GIF encontrado para essa busca.</p>
            )}
            {gifs.length > 0 && (
              <div className="columns-2 gap-1.5">
                {gifs.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    data-testid="gif-result"
                    title={gif.title}
                    onClick={() => {
                      sendGif(gif.url);
                      onClose();
                    }}
                    className="mb-1.5 block w-full rounded-lg overflow-hidden bg-[#f6f5f0] hover:ring-2 hover:ring-[#ffd027] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3044f0]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={gif.preview} alt={gif.title} loading="lazy" referrerPolicy="no-referrer" className="block w-full" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="px-2 py-1 text-[10px] text-slate-500 text-right border-t border-slate-900/10 flex-shrink-0">GIFs via Klipy / GIPHY</p>
        </div>
      )}

      {/* ---------- Figurinhas ---------- */}
      {tab === 'sticker' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <input ref={stickerInputRef} type="file" accept="image/*" onChange={handleStickerFile} className="hidden" data-testid="sticker-file" />
          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                data-testid="sticker-create"
                disabled={creating}
                onClick={() => stickerInputRef.current?.click()}
                title="Criar figurinha a partir de uma imagem"
                className="aspect-square rounded-xl border-2 border-dashed border-slate-900/15 text-slate-700 hover:border-[#3044f0] hover:text-[#3044f0] flex flex-col items-center justify-center gap-1 disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                <span className="text-[10px] font-bold">Criar</span>
              </button>

              {stickers.map((sticker) => (
                <div key={sticker.id} className="relative aspect-square">
                  <button
                    type="button"
                    data-testid="sticker-item"
                    title={removing ? 'Apagar esta figurinha' : 'Enviar figurinha'}
                    onClick={() => {
                      if (removing) return deleteSticker(sticker.id);
                      sendSticker(sticker.id);
                      onClose();
                    }}
                    className={`w-full h-full rounded-xl p-1 hover:bg-slate-900/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3044f0] ${
                      removing ? 'ring-1 ring-rose-500/60' : ''
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sticker.url} alt="Figurinha" loading="lazy" className="w-full h-full object-contain" />
                  </button>
                  {removing && (
                    <span className="absolute -top-1 -right-1 p-0.5 rounded-full bg-rose-600 text-white pointer-events-none">
                      <Trash2 className="w-3 h-3" />
                    </span>
                  )}
                </div>
              ))}
            </div>

            {stickers.length === 0 && (
              <p className="text-[11px] text-slate-500 text-center leading-relaxed mt-3 px-3">
                Você ainda não tem figurinhas. Clique em Criar e escolha uma imagem (PNG com fundo transparente fica melhor).
                Também dá para salvar as figurinhas que os colegas mandam, clicando nelas no chat.
              </p>
            )}
          </div>

          {stickers.length > 0 && (
            <div className="px-2 py-1.5 border-t border-slate-900/10 flex items-center justify-between flex-shrink-0">
              <span className="text-[10px] text-slate-500">{stickers.length} figurinha(s)</span>
              <button
                type="button"
                onClick={() => setRemoving((v) => !v)}
                className={`text-[11px] font-bold ${removing ? 'text-emerald-600' : 'text-rose-600'} hover:underline`}
              >
                {removing ? 'Pronto' : 'Apagar figurinhas'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
