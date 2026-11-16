'use client';

import React, { useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { Avatar } from '@/components/common/Avatar';
import { Copy, Check } from 'lucide-react';
import { playSuccessSound } from '@/utils/soundEffects';

export function SidebarRightFriends() {
  const { friends, rooms, setCurrentRoomId, setIsCreateModalOpen } = useMesa();
  const [copied, setCopied] = useState(false);

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

  const friendsList = Object.values(friends);

  return (
    <aside className="mesa-paper w-[300px] flex-shrink-0 rounded-3xl bg-[#f6f5f0] text-slate-950 flex flex-col justify-between p-5 hidden xl:flex select-none overflow-hidden">
      {/* Colegas */}
      <div className="space-y-4 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <h3 className="landing-display text-[15px] text-slate-950">Colegas de sala</h3>
          <span className="px-2.5 py-1 rounded-full bg-emerald-600/12 text-emerald-700 text-[11px] font-bold whitespace-nowrap">
            {friendsList.filter((f) => f.status !== 'ausente').length} online
          </span>
        </div>

        <div className="space-y-0.5">
          {friendsList.length === 0 && (
            <p className="text-sm text-slate-600 leading-relaxed">
              Quem entrar nas suas salas aparece aqui. Mande o código ou o link de uma sala para a turma.
            </p>
          )}
          {friendsList.map((friend) => {
            const isAway = friend.status === 'ausente';

            return (
              <div
                key={friend.id}
                data-testid="friend-row"
                data-presence={friend.presence || 'online'}
                onClick={() => {
                  if (friend.currentRoomId) {
                    setCurrentRoomId(friend.currentRoomId);
                  }
                }}
                className={`flex items-center justify-between px-2 py-2 rounded-2xl transition-colors ${
                  friend.currentRoomId ? 'hover:bg-slate-900/5 cursor-pointer group' : 'hover:bg-slate-900/[0.03]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
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

                {friend.currentRoomId && (
                  <span className="opacity-0 group-hover:opacity-100 text-[11px] text-[#3044f0] font-extrabold transition-opacity">Juntar-se</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Convite: um bloco cobalto, como a metade azul do login */}
      <div className="relative overflow-hidden bg-[#3044f0] text-white p-4 rounded-2xl mt-6 flex-shrink-0">
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
}
