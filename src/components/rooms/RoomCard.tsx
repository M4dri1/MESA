'use client';

import React from 'react';
import { Room } from '@/types';
import { Lock, Globe, Trash2, Settings } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { mediaTransformStyle } from '@/utils/mediaTransform';
import { useMesa } from '@/context/MesaContext';

interface RoomCardProps {
  room: Room;
  onEnter: (room: Room) => void;
}

/** Cartão de uma sala: um cartaz (cor ou foto da sala, nome grande) dentro de uma folha de papel creme */
export function RoomCard({ room, onEnter }: RoomCardProps) {
  const { deleteRoom, openRoomSettings } = useMesa();
  const isOnline = room.activeCount > 0;
  const isCustomRoom = !!room.isOwner;
  const canEdit = room.myRole === 'owner' || room.myRole === 'admin';
  // Qualquer cor escolhida na criação vira a cor do cartaz; salas antigas seguem com o degradê pronto
  const customColor = /^#[0-9a-f]{6}$/i.test(room.color || '');

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Excluir a sala "${room.name}"? As mensagens e os arquivos dela serão apagados para todos.`)) {
      deleteRoom(room.id);
    }
  };

  return (
    <div
      onDoubleClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) onEnter(room);
      }}
      title="Clique duas vezes para abrir a sala"
      className="mesa-paper group relative flex flex-col rounded-3xl bg-[#f6f5f0] text-slate-950 p-2 cursor-pointer hover:-translate-y-1 hover:shadow-[0_24px_40px_-16px_rgba(11,15,25,0.55)] transition-all duration-150"
    >
      {/* O cartaz */}
      <div
        data-testid="room-card-poster"
        className={`relative h-40 p-3.5 flex flex-col justify-between overflow-hidden rounded-2xl ${customColor ? '' : `bg-gradient-to-br ${room.gradient}`}`}
        style={customColor ? { backgroundColor: room.color } : undefined}
      >
        {room.iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={room.iconUrl} alt="" style={mediaTransformStyle(room.iconUrl)} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
        )}
        {/* Escurece só embaixo, para o nome ler bem em cima de qualquer cor ou foto */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/65 via-black/5 to-transparent" />

        <div className="relative z-10 flex items-start justify-between gap-2">
          <span className="max-w-[60%] truncate px-2.5 py-1 rounded-full bg-black/45 text-white text-[10px] font-extrabold uppercase tracking-wide">
            {room.subject}
          </span>
          <div className="flex items-center rounded-full bg-black/45 text-white">
            {canEdit && (
              <button
                type="button"
                data-testid="room-card-settings"
                onClick={(e) => {
                  e.stopPropagation();
                  openRoomSettings(room.id);
                }}
                title="Configurações da sala"
                aria-label="Configurações da sala"
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
            {isCustomRoom && (
              <button
                type="button"
                onClick={handleDelete}
                title="Excluir sala"
                aria-label="Excluir sala"
                className="p-1.5 rounded-full hover:bg-rose-600 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="p-1.5" title={room.isPrivate ? 'Privada' : 'Aberta'}>
              {room.isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
            </span>
          </div>
        </div>

        <h3 translate="no" className="relative z-10 landing-display text-[22px] text-white line-clamp-2 [overflow-wrap:anywhere]">
          {room.name}
        </h3>
      </div>

      {/* Embaixo: quem está aí e o botão */}
      <div className="flex-1 px-3 pt-3.5 pb-2.5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-xs text-slate-700 font-semibold truncate">
                {isOnline ? `${room.activeCount} estudando agora` : 'Ninguém na sala agora'}
              </span>
            </div>

            {isOnline && room.members.length > 0 && (
              <div className="flex items-center -space-x-1.5">
                {room.members.slice(0, 4).map((member, idx) => (
                  <div key={member.id || idx} className="inline-flex ring-2 ring-[#f6f5f0] rounded-full" title={member.name}>
                    <Avatar letter={member.avatarLetter} avatarUrl={member.avatarUrl} color={member.avatarColor} size="sm" />
                  </div>
                ))}
                {room.members.length > 4 && (
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-[#f6f5f0]">
                    +{room.members.length - 4}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => onEnter(room)}
            className={`flex-shrink-0 h-10 px-6 rounded-full text-sm font-extrabold transition-colors ${
              isOnline ? 'bg-slate-950 hover:bg-slate-800 text-white' : 'border-2 border-slate-900/25 text-slate-900 hover:bg-slate-900/5'
            }`}
          >
            {isOnline ? 'Entrar' : 'Abrir'}
          </button>
        </div>
      </div>
    </div>
  );
}
