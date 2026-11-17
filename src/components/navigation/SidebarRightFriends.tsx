'use client';

import React, { useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { Avatar } from '@/components/common/Avatar';
import { Copy, Check, UserPlus, MessageCircle, UserMinus, X, LogIn } from 'lucide-react';
import { playSuccessSound } from '@/utils/soundEffects';

export function SidebarRightFriends({ asDrawer = false }: { asDrawer?: boolean }) {
  const {
    friends,
    friendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    openDm,
    dmUnread,
    rooms,
    setCurrentRoomId,
    setIsCreateModalOpen,
    setIsFriendsDrawerOpen,
  } = useMesa();
  const [copied, setCopied] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [nickInput, setNickInput] = useState('');
  const [addFeedback, setAddFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [sendingReq, setSendingReq] = useState(false);

  const handleCopyInviteLink = () => {
    const room = rooms.find((r) => r.isOwner) || rooms[0];
    if (!room) {
      setIsCreateModalOpen(true);
      return;
    }
    navigator.clipboard.writeText(`${window.location.origin}/?room=${room.code}`);
    playSuccessSound();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nickInput.trim().replace(/^@+/, '');
    if (!clean || sendingReq) return;
    setSendingReq(true);
    setAddFeedback(null);
    const res = await sendFriendRequest({ nickname: clean });
    setSendingReq(false);
    if (!res.ok) {
      setAddFeedback({ ok: false, text: res.error || 'Não foi possível enviar.' });
      return;
    }
    setNickInput('');
    setAddFeedback({ ok: true, text: res.accepted ? 'Agora vocês são amigos!' : 'Pedido de amizade enviado!' });
  };

  const friendsList = Object.values(friends);
  const incoming = friendRequests.incoming || [];
  const outgoing = friendRequests.outgoing || [];

  const body = (
    <aside
      className={
        asDrawer
          ? 'mesa-paper w-full max-w-sm h-full bg-[#f6f5f0] text-slate-950 flex flex-col justify-between p-5 select-none overflow-hidden shadow-2xl'
          : 'mesa-paper w-[300px] flex-shrink-0 rounded-3xl bg-[#f6f5f0] text-slate-950 flex flex-col justify-between p-5 hidden xl:flex select-none overflow-hidden'
      }
    >
      <div className="space-y-4 min-h-0 flex-1 overflow-y-auto pr-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="landing-display text-[15px] text-slate-950">Amigos</h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-600/12 text-emerald-700 text-[11px] font-bold whitespace-nowrap">
              {friendsList.filter((f) => f.status !== 'ausente').length} online
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setShowAdd((v) => !v);
                setAddFeedback(null);
              }}
              title="Adicionar amigo pelo nickname"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                showAdd ? 'bg-[#3044f0] text-white' : 'bg-slate-900/5 hover:bg-slate-900/10 text-slate-800'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </button>
            {asDrawer && (
              <button
                type="button"
                onClick={() => setIsFriendsDrawerOpen(false)}
                title="Fechar"
                className="p-1.5 rounded-full text-slate-500 hover:text-slate-950 hover:bg-slate-900/5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Adicionar por nickname */}
        {showAdd && (
          <form onSubmit={handleAddFriend} className="p-2.5 rounded-2xl bg-white border border-slate-900/10 space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={nickInput}
                onChange={(e) => setNickInput(e.target.value)}
                placeholder="@nickname do amigo"
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-[#f6f5f0] border border-slate-900/10 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#3044f0]"
              />
              <button
                type="submit"
                disabled={!nickInput.trim() || sendingReq}
                className="px-3 py-1.5 rounded-xl bg-[#3044f0] hover:bg-[#2334c9] text-white text-xs font-bold disabled:opacity-40"
              >
                {sendingReq ? '...' : 'Enviar'}
              </button>
            </div>
            {addFeedback && (
              <p className={`text-[11px] font-semibold ${addFeedback.ok ? 'text-emerald-700' : 'text-rose-600'}`}>
                {addFeedback.text}
              </p>
            )}
          </form>
        )}

        {/* Pedidos recebidos */}
        {incoming.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Pedidos recebidos ({incoming.length})
            </p>
            {incoming.map((req) => (
              <div key={req.id} className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-white border border-slate-900/10">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar letter={req.user.avatarLetter} avatarUrl={req.user.avatarUrl} color={req.user.avatarColor} size="sm" />
                  <span className="text-xs font-bold text-slate-950 truncate">{req.user.name}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => void acceptFriendRequest(req.id)}
                    title="Aceitar pedido"
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void declineFriendRequest(req.id)}
                    title="Recusar pedido"
                    className="p-1.5 rounded-lg bg-slate-900/5 hover:bg-rose-600 hover:text-white text-slate-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pedidos enviados */}
        {outgoing.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Enviados ({outgoing.length})
            </p>
            {outgoing.map((req) => (
              <div key={req.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-2xl bg-white/70 border border-slate-900/10">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar letter={req.user.avatarLetter} avatarUrl={req.user.avatarUrl} color={req.user.avatarColor} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{req.user.name}</p>
                    <p className="text-[10px] text-slate-500">Aguardando resposta</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void declineFriendRequest(req.id)}
                  title="Cancelar pedido"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-900/5 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Lista de amigos */}
        <div className="space-y-0.5">
          {friendsList.length === 0 && (
            <p className="text-sm text-slate-600 leading-relaxed">
              Você ainda não adicionou amigos. Clique em <strong>Adicionar</strong> acima (ou no perfil de alguém na sala) para conversar e estudar juntos.
            </p>
          )}
          {friendsList.map((friend) => {
            const isAway = friend.status === 'ausente';
            const unread = dmUnread[friend.id] || 0;

            return (
              <div
                key={friend.id}
                data-testid="friend-row"
                data-presence={friend.presence || 'online'}
                onClick={() => void openDm(friend.id)}
                className="flex items-center justify-between gap-2 px-2 py-2 rounded-2xl hover:bg-slate-900/5 cursor-pointer group transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative flex-shrink-0">
                    <Avatar letter={friend.avatarLetter} avatarUrl={friend.avatarUrl} color={friend.avatarColor} size="sm" />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[#f6f5f0] ${
                        isAway ? 'bg-slate-400' : friend.presence === 'ocupado' ? 'bg-rose-500' : friend.presence === 'ausente' ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                    />
                  </div>

                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-sm font-bold text-slate-950 truncate">{friend.name}</span>
                    <span className="text-[11px] text-slate-500 line-clamp-1">{friend.statusText}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {friend.currentRoomId && (
                    <button
                      type="button"
                      onClick={() => {
                        if (asDrawer) setIsFriendsDrawerOpen(false);
                        setCurrentRoomId(friend.currentRoomId!);
                      }}
                      title="Entrar na sala do amigo"
                      className="p-1.5 rounded-lg text-[#3044f0] hover:bg-[#3044f0]/10 transition-colors"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void openDm(friend.id)}
                    title="Abrir conversa privada"
                    className="relative p-1.5 rounded-lg text-slate-600 hover:text-[#3044f0] hover:bg-slate-900/5 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-extrabold flex items-center justify-center">
                        {unread}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeFriend(friend.id)}
                    title="Desfazer amizade"
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-900/5 transition-all"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Convite: um bloco cobalto */}
      <div className="relative overflow-hidden bg-[#3044f0] text-white p-4 rounded-2xl mt-4 flex-shrink-0">
        <div className="relative z-10 space-y-2">
          <h4 className="landing-display text-base text-white">Chame um amigo</h4>
          <p className="text-xs text-white/85 leading-snug pr-4">
            {rooms.length > 0 ? 'Copie o link de uma sala sua e mande para a turma.' : 'Crie uma sala e mande o link para a turma.'}
          </p>

          <button
            onClick={handleCopyInviteLink}
            className="w-full mt-2 h-10 px-3 rounded-full bg-white hover:bg-[#f6f5f0] text-slate-950 text-xs font-extrabold flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Link copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{rooms.length > 0 ? 'Copiar link' : 'Criar sala'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );

  if (asDrawer) {
    return (
      <div
        className="fixed inset-0 z-50 flex justify-end bg-[#0b0f19]/60 animate-fadeIn"
        onClick={() => setIsFriendsDrawerOpen(false)}
      >
        <div className="h-full" onClick={(e) => e.stopPropagation()}>
          {body}
        </div>
      </div>
    );
  }

  return body;
}
