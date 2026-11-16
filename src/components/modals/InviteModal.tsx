'use client';

import React, { useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { Copy, Check, Send } from 'lucide-react';
import { ModalShell, FIELD_LABEL } from '@/components/common/ModalShell';
import { Avatar } from '@/components/common/Avatar';
import { playSuccessSound } from '@/utils/soundEffects';

export function InviteModal() {
  const {
    isInviteModalOpen,
    setIsInviteModalOpen,
    currentRoom,
    friends,
    invitedFriends,
    inviteFriend,
  } = useMesa();

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isInviteModalOpen || !currentRoom) return null;

  const roomCode = currentRoom.code;
  const displayCode = roomCode.includes('-')
    ? roomCode.replace('-', ' - ')
    : `${roomCode.slice(0, 4)} - ${roomCode.slice(4)}`;
  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/?room=${roomCode}`
    : `https://mesa.app/s/${roomCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    playSuccessSound();
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    playSuccessSound();
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendWhatsApp = () => {
    playSuccessSound();
    const text = encodeURIComponent(
      `Oi! Estou estudando na sala "${currentRoom?.name || 'Mesa'}" no Mesa. Entra aí comigo: ${inviteLink}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Colegas de outras salas que ainda não estão nesta
  const inviteCandidates = Object.values(friends).filter(
    (friend) =>
      !(currentRoom.memberIds || []).includes(friend.id) || invitedFriends[`${currentRoom.id}:${friend.id}`]
  );

  return (
    <ModalShell
      title="Convidar amigos"
      subtitle="Envie o link da sala ou convide seus colegas direto pela lista."
      onClose={() => setIsInviteModalOpen(false)}
      width="max-w-3xl"
    >
      <div className="md:pt-8">
        {/* Link */}
        <span className={FIELD_LABEL}>Link da sala</span>
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white border border-slate-900/15 mb-6">
          <span className="pl-3 text-sm text-slate-700 font-mono flex-1 truncate">{inviteLink}</span>
          <button
            onClick={handleCopyLink}
            className="h-10 px-5 rounded-full bg-[#0b0f19] hover:bg-slate-800 text-white font-extrabold text-xs flex items-center gap-1.5 transition-colors active:scale-95 flex-shrink-0"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar link</span>
              </>
            )}
          </button>
        </div>

        {/* WhatsApp */}
        <button
          onClick={handleSendWhatsApp}
          className="w-full h-12 px-4 rounded-full bg-[#22c55e] hover:bg-[#16a34a] text-white font-extrabold text-sm flex items-center justify-center gap-2.5 transition-colors active:scale-95 mb-7"
        >
          <Send className="w-4 h-4 rotate-45 stroke-[2.5]" />
          <span>Enviar pelo WhatsApp</span>
        </button>

        {/* Convite direto para colegas de outras salas */}
        {inviteCandidates.length > 0 && (
          <div>
            <span className={FIELD_LABEL}>Convidar da sua lista</span>

            <div className="space-y-2">
              {inviteCandidates.map((friend) => {
                const isInvited = invitedFriends[`${currentRoom.id}:${friend.id}`];
                return (
                  <div key={friend.id} className="flex items-center justify-between p-2.5 pl-3 rounded-2xl bg-white border border-slate-900/10">
                    <div className="flex items-center gap-3">
                      <Avatar letter={friend.avatarLetter} avatarUrl={friend.avatarUrl} color={friend.avatarColor} size="sm" />
                      <span className="text-sm font-bold text-slate-950">{friend.name}</span>
                    </div>

                    <button
                      onClick={() => !isInvited && inviteFriend(friend.id)}
                      className={`h-9 px-4 rounded-full text-xs font-extrabold transition-colors flex items-center gap-1.5 ${
                        isInvited ? 'bg-[#ffd027] text-slate-950' : 'bg-slate-900/5 hover:bg-slate-900/10 text-slate-900'
                      }`}
                    >
                      {isInvited ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Convite enviado</span>
                        </>
                      ) : (
                        <span>Convidar</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
