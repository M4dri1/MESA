'use client';

import React, { useState } from 'react';
import { useMesa } from '@/context/MesaContext';
import { RoomCard } from '@/components/rooms/RoomCard';
import { Sparkle } from '@/components/common/Sparkle';
import { Room } from '@/types';
import { Plus, Hash, BookOpen } from 'lucide-react';

export function MinhasSalasView() {
  const { rooms, setCurrentRoomId, setIsCreateModalOpen, setIsJoinCodeModalOpen } = useMesa();
  const [filter, setFilter] = useState<'todas' | 'estudando' | 'privadas'>('todas');

  const filteredRooms = rooms.filter((room) => {
    if (filter === 'estudando') return room.activeCount > 0;
    if (filter === 'privadas') return room.isPrivate;
    return true;
  });

  const handleEnterRoom = (room: Room) => {
    setCurrentRoomId(room.id);
  };

  return (
    <div className="relative flex-1 min-w-0 flex flex-col h-full overflow-y-auto px-5 md:px-10 pt-3 pb-12">
      <Sparkle className="right-[6%] top-6 h-7 w-7 md:h-9 md:w-9 text-[#ffd027]" />
      <Sparkle className="hidden md:block right-[22%] top-24 h-4 w-4 text-white/50" />
      <Sparkle className="hidden md:block left-[46%] top-3 h-3 w-3 text-white/40" />

      <div className="relative w-full space-y-8">
        {/* Cabeçalho: o mesmo título largo da tela inicial */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h1 className="landing-display text-4xl md:text-6xl text-white">Minhas salas</h1>
            <p className="text-base md:text-lg text-white/80 mt-3">Escolha uma sala para estudar ou crie a sua.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="h-12 px-6 whitespace-nowrap rounded-full bg-white hover:bg-[#f6f5f0] text-slate-950 font-extrabold text-sm flex items-center gap-2 transition-colors active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Criar sala</span>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" role="tablist">
          {(
            [
              ['todas', <>Todas ({rooms.length})</>],
              ['estudando', 'Estudando agora'],
              ['privadas', 'Privadas'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`h-10 px-5 rounded-full text-sm font-bold whitespace-nowrap flex-shrink-0 transition-colors ${
                filter === key ? 'bg-white text-slate-950' : 'text-white hover:bg-white/15'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Salas */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-5">
          {filteredRooms.map((room) => (
            <RoomCard key={room.id} room={room} onEnter={handleEnterRoom} />
          ))}
        </div>

        {filteredRooms.length === 0 && (
          <div className="text-center py-16 rounded-3xl border-2 border-dashed border-white/40">
            <BookOpen className="w-10 h-10 text-white/80 mx-auto mb-3" />
            <h3 className="landing-display text-xl text-white">Nenhuma sala encontrada</h3>
            <p className="text-sm text-white/80 mt-2">Crie sua primeira sala para estudar com seus amigos.</p>
          </div>
        )}
      </div>
    </div>
  );
}
