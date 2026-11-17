'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { Avatar } from '@/components/common/Avatar';
import { X, Send, Smile, LogIn } from 'lucide-react';

const QUICK_EMOJIS = ['😀', '😂', '❤️', '🔥', '👍', '🎉', '📚', '☕'];

/**
 * Chat privado (DM 1-a-1) entre amigos adicionados no Mesa.
 */
export function DirectMessageModal() {
  const {
    activeDmFriendId,
    closeDm,
    friends,
    dmMessages,
    sendDm,
    currentUser,
    setCurrentRoomId,
  } = useMesa();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const friend = activeDmFriendId ? friends[activeDmFriendId] : null;
  const list = activeDmFriendId ? dmMessages[activeDmFriendId] || [] : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [list.length, activeDmFriendId]);

  if (!activeDmFriendId || !friend) return null;

  const isAway = friend.status === 'ausente';

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    setError('');
    const res = await sendDm(friend.id, clean);
    setSending(false);
    if (!res.ok) {
      setError(res.error || 'Não foi possível enviar.');
      return;
    }
    setText('');
    setShowEmojis(false);
  };

  return (
    <div
      data-testid="dm-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0b0f19]/70 animate-fadeIn"
    >
      <div className="mesa-paper w-full max-w-lg h-[560px] max-h-[90vh] rounded-3xl bg-[#f6f5f0] text-slate-950 flex flex-col overflow-hidden shadow-[0_32px_72px_-20px_rgba(0,0,0,0.65)]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-white border-b border-slate-900/10 flex-shrink-0">
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

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {friend.currentRoomId && (
              <button
                type="button"
                onClick={() => {
                  const targetRoom = friend.currentRoomId!;
                  closeDm();
                  setCurrentRoomId(targetRoom);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#3044f0] hover:bg-[#2334c9] text-white text-xs font-bold transition-colors"
                title="Entrar na sala do amigo"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Juntar-se</span>
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
              <p className="mt-1 text-xs text-slate-500">Mande um oi para começar a conversar direto por aqui.</p>
            </div>
          )}

          {list.map((m) => {
            const mine = m.senderId === currentUser.id;
            const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm break-words ${
                    mine
                      ? 'bg-[#3044f0] text-white rounded-br-sm'
                      : 'bg-white text-slate-900 border border-slate-900/10 rounded-bl-sm'
                  }`}
                >
                  {m.gifUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.gifUrl} alt="GIF" className="rounded-xl max-h-48 mb-1.5" />
                  )}
                  {m.content && <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>}
                </div>
                <span className="mt-1 px-1 text-[10px] text-slate-500">{time}</span>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Barra de envio */}
        <form onSubmit={handleSend} className="relative p-3 bg-white border-t border-slate-900/10 flex-shrink-0">
          {error && <p className="text-xs text-rose-600 font-semibold mb-1.5 px-1">{error}</p>}
          {showEmojis && (
            <div className="flex items-center gap-1.5 mb-2 px-1 flex-wrap">
              {QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setText((prev) => prev + em)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-900/5 text-base flex items-center justify-center transition-colors"
                >
                  {em}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-2xl bg-[#f6f5f0] border border-slate-900/10 focus-within:border-[#3044f0] p-1.5">
            <button
              type="button"
              onClick={() => setShowEmojis((v) => !v)}
              title="Emojis"
              className={`p-2 rounded-xl transition-colors ${showEmojis ? 'text-[#3044f0] bg-slate-900/10' : 'text-slate-500 hover:text-[#3044f0]'}`}
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
