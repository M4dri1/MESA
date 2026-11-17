'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { Avatar } from '@/components/common/Avatar';
import { DirectMessage, GifResult } from '@/types';
import { X, Send, Smile, LogIn, Paperclip, Phone, Video, Reply, Pencil, Check, FileText, Download, Search, Loader2 } from 'lucide-react';

const QUICK_EMOJIS = ['😀', '😂', '❤️', '🔥', '👍', '🎉', '📚', '☕', '👀', '💯', '🙏', '✨'];

/**
 * Chat privado (DM 1-a-1) entre amigos: texto, fotos, arquivos, GIFs, figurinhas, responder, editar e ligar.
 */
export function DirectMessageModal() {
  const {
    activeDmFriendId,
    closeDm,
    friends,
    dmMessages,
    sendDm,
    editDm,
    uploadDmFile,
    searchGifs,
    stickers,
    startDmCall,
    currentUser,
    setCurrentRoomId,
  } = useMesa();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [pickerTab, setPickerTab] = useState<'emoji' | 'gif' | 'sticker' | null>(null);
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; senderName: string; preview: string } | null>(null);
  const [editingMsg, setEditingMsg] = useState<{ id: string; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const friend = activeDmFriendId ? friends[activeDmFriendId] : null;
  const list = activeDmFriendId ? dmMessages[activeDmFriendId] || [] : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [list.length, activeDmFriendId]);

  useEffect(() => {
    if (pickerTab !== 'gif') return;
    setGifLoading(true);
    const t = window.setTimeout(async () => {
      const res = await searchGifs(gifQuery.trim());
      setGifLoading(false);
      if (res.ok) setGifs(res.gifs);
    }, gifQuery ? 300 : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerTab, gifQuery]);

  if (!activeDmFriendId || !friend) return null;

  const isAway = friend.status === 'ausente';

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    setError('');
    const res = await sendDm(friend.id, clean, { replyToId: replyingTo?.id });
    setSending(false);
    if (!res.ok) {
      setError(res.error || 'Não foi possível enviar.');
      return;
    }
    setText('');
    setReplyingTo(null);
    setPickerTab(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setSending(true);
    setError('');
    const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/');
    const res = await uploadDmFile(friend.id, file, !isMedia);
    setSending(false);
    if (!res.ok) setError(res.error || 'Não foi possível enviar o arquivo.');
  };

  const previewOf = (m: DirectMessage) =>
    m.content.trim() ? m.content.trim().slice(0, 90) : m.gifUrl ? 'GIF' : m.stickerUrl ? 'Figurinha' : m.attachment?.name || 'Mídia';

  return (
    <div
      data-testid="dm-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0b0f19]/70 animate-fadeIn"
    >
      <div className="mesa-paper w-full max-w-lg h-[580px] max-h-[90vh] rounded-3xl bg-[#f6f5f0] text-slate-950 flex flex-col overflow-hidden shadow-[0_32px_72px_-20px_rgba(0,0,0,0.65)]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 bg-white border-b border-slate-900/10 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <Avatar letter={friend.avatarLetter} avatarUrl={friend.avatarUrl} color={friend.avatarColor} size="sm" />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white ${
                  isAway ? 'bg-slate-400' : friend.presence === 'ocupado' ? 'bg-rose-500' : friend.presence === 'ausente' ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-950 truncate">{friend.name}</p>
              <p className="text-[11px] text-slate-500 truncate">{friend.statusText}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => void startDmCall(friend, false)}
              title="Ligação de voz privada"
              className="p-2 rounded-xl text-slate-600 hover:text-[#3044f0] hover:bg-slate-900/5 transition-colors"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => void startDmCall(friend, true)}
              title="Chamada de vídeo privada"
              className="p-2 rounded-xl text-slate-600 hover:text-[#3044f0] hover:bg-slate-900/5 transition-colors"
            >
              <Video className="w-4 h-4" />
            </button>
            {friend.currentRoomId && (
              <button
                type="button"
                onClick={() => {
                  const targetRoom = friend.currentRoomId!;
                  closeDm();
                  setCurrentRoomId(targetRoom);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#3044f0] hover:bg-[#2334c9] text-white text-xs font-bold transition-colors"
                title="Entrar na sala do amigo"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Juntar-se</span>
              </button>
            )}
            <button
              type="button"
              onClick={closeDm}
              title="Fechar conversa"
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-950 hover:bg-slate-900/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {list.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <Avatar letter={friend.avatarLetter} avatarUrl={friend.avatarUrl} color={friend.avatarColor} size="md" />
              <p className="mt-3 text-sm font-bold text-slate-900">Conversa privada com {friend.name}</p>
              <p className="mt-1 text-xs text-slate-500">Mande mensagens, fotos, arquivos, GIFs, figurinhas ou faça uma ligação.</p>
            </div>
          )}

          {list.map((m) => {
            const mine = m.senderId === currentUser.id;
            const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
            const att = m.attachment;
            return (
              <div key={m.id} className={`group flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div className={`relative flex items-center gap-1.5 max-w-[85%] ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm break-words ${
                      mine
                        ? 'bg-[#3044f0] text-white rounded-br-sm'
                        : 'bg-white text-slate-900 border border-slate-900/10 rounded-bl-sm'
                    }`}
                  >
                    {m.replyTo && (
                      <div className={`mb-1.5 px-2 py-1 rounded-lg text-[11px] border-l-2 ${mine ? 'bg-white/15 border-white/70 text-white/90' : 'bg-slate-900/5 border-[#3044f0] text-slate-600'}`}>
                        <span className="font-bold">@{m.replyTo.senderName}: </span>
                        <span>{m.replyTo.preview}</span>
                      </div>
                    )}
                    {m.gifUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.gifUrl} alt="GIF" className="rounded-xl max-h-48 mb-1" />
                    )}
                    {m.stickerUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.stickerUrl} alt="Figurinha" className="w-28 h-28 object-contain" />
                    )}
                    {att && att.type === 'image' && !att.asDocument && att.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={att.url} alt={att.name} className="rounded-xl max-h-56 mb-1" />
                    )}
                    {att && att.type === 'video' && !att.asDocument && att.url && (
                      <video controls src={att.url} className="rounded-xl max-h-56 mb-1" />
                    )}
                    {att && att.type === 'audio' && !att.asDocument && att.url && (
                      <audio controls src={att.url} className="h-8 max-w-[230px]" />
                    )}
                    {att && (att.asDocument || att.type === 'pdf' || att.type === 'file') && att.url && (
                      <a
                        href={`${att.url}?download=1`}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold ${mine ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-slate-900/5 text-slate-900 hover:bg-slate-900/10'}`}
                      >
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate max-w-[160px]">{att.name}</span>
                        <Download className="w-3.5 h-3.5 flex-shrink-0" />
                      </a>
                    )}

                    {editingMsg?.id === m.id ? (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const res = await editDm(friend.id, m.id, editingMsg.text);
                          if (res.ok) setEditingMsg(null);
                          else setError(res.error || 'Não foi possível editar.');
                        }}
                        className="flex items-center gap-1 mt-1"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editingMsg.text}
                          onChange={(e) => setEditingMsg({ id: m.id, text: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Escape') setEditingMsg(null); }}
                          className="px-2 py-1 rounded-lg bg-white text-slate-900 text-xs focus:outline-none min-w-[160px]"
                        />
                        <button type="submit" className="p-1 rounded bg-emerald-500 text-white"><Check className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => setEditingMsg(null)} className="p-1 rounded bg-black/20 text-white"><X className="w-3.5 h-3.5" /></button>
                      </form>
                    ) : (
                      m.content && <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    )}
                  </div>

                  {/* Ações rápidas ao passar o mouse */}
                  <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      title="Responder"
                      onClick={() => setReplyingTo({ id: m.id, senderName: m.senderName, preview: previewOf(m) })}
                      className="p-1 rounded-lg text-slate-400 hover:text-[#3044f0] hover:bg-slate-900/5"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    {mine && m.content.trim() && (
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => setEditingMsg({ id: m.id, text: m.content })}
                        className="p-1 rounded-lg text-slate-400 hover:text-[#3044f0] hover:bg-slate-900/5"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <span className="mt-1 px-1 text-[10px] text-slate-500">
                  {time}{m.editedAt ? ' · editada' : ''}
                </span>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Seletor de Emojis / GIFs / Figurinhas */}
        {pickerTab && (
          <div className="mx-3 mb-2 rounded-2xl bg-white border border-slate-900/10 p-2.5 shadow-lg max-h-56 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1">
                {(['emoji', 'gif', 'sticker'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPickerTab(t)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${pickerTab === t ? 'bg-[#ffd027] text-slate-950' : 'text-slate-600 hover:bg-slate-900/5'}`}
                  >
                    {t === 'emoji' ? 'Emojis' : t === 'gif' ? 'GIFs' : 'Figurinhas'}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setPickerTab(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-800">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {pickerTab === 'emoji' && (
              <div className="flex flex-wrap gap-1 overflow-y-auto">
                {QUICK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setText((prev) => prev + em)}
                    className="w-8 h-8 rounded-lg hover:bg-slate-900/5 text-lg flex items-center justify-center"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}

            {pickerTab === 'gif' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[#f6f5f0] mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={gifQuery}
                    onChange={(e) => setGifQuery(e.target.value)}
                    placeholder="Buscar GIF..."
                    className="flex-1 bg-transparent text-xs text-slate-900 focus:outline-none"
                  />
                  {gifLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                </div>
                <div className="flex-1 overflow-y-auto columns-3 gap-1.5">
                  {gifs.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={async () => {
                        setPickerTab(null);
                        await sendDm(friend.id, '', { gifUrl: g.url, replyToId: replyingTo?.id });
                        setReplyingTo(null);
                      }}
                      className="mb-1.5 block w-full rounded-lg overflow-hidden hover:ring-2 hover:ring-[#ffd027]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.preview} alt={g.title} className="w-full block" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {pickerTab === 'sticker' && (
              <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-2">
                {stickers.length === 0 ? (
                  <p className="col-span-4 text-xs text-slate-500 text-center py-4">Você ainda não tem figurinhas salvas.</p>
                ) : (
                  stickers.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={async () => {
                        setPickerTab(null);
                        await sendDm(friend.id, '', { stickerId: s.id, replyToId: replyingTo?.id });
                        setReplyingTo(null);
                      }}
                      className="p-1.5 rounded-xl bg-[#f6f5f0] hover:ring-2 hover:ring-[#3044f0] flex items-center justify-center"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.url} alt="Figurinha" className="w-12 h-12 object-contain" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Barra de envio */}
        <form onSubmit={handleSend} className="relative p-3 bg-white border-t border-slate-900/10 flex-shrink-0">
          {error && <p className="text-xs text-rose-600 font-semibold mb-1.5 px-1">{error}</p>}
          {replyingTo && (
            <div className="mb-2 flex items-center justify-between gap-2 px-2.5 py-1 rounded-xl bg-[#f6f5f0] text-xs">
              <span className="truncate text-slate-600">
                Respondendo a <strong className="text-slate-900">@{replyingTo.senderName}</strong>: {replyingTo.preview}
              </span>
              <button type="button" onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
          <div className="flex items-center gap-1 rounded-2xl bg-[#f6f5f0] border border-slate-900/10 focus-within:border-[#3044f0] p-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              title="Enviar foto, vídeo ou arquivo"
              className="p-2 rounded-xl text-slate-500 hover:text-[#3044f0] transition-colors"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPickerTab((v) => (v ? null : 'emoji'))}
              title="Emojis, GIFs e figurinhas"
              className={`p-2 rounded-xl transition-colors ${pickerTab ? 'text-[#3044f0] bg-slate-900/10' : 'text-slate-500 hover:text-[#3044f0]'}`}
            >
              <Smile className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Conversar com ${friend.name}...`}
              maxLength={1500}
              className="flex-1 min-w-0 bg-transparent px-1 text-sm text-slate-900 placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              title="Enviar"
              className="p-2 rounded-xl bg-[#3044f0] hover:bg-[#2334c9] text-white disabled:opacity-40 transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
